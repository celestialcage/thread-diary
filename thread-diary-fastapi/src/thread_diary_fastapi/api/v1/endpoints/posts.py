from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, col, select

from thread_diary_fastapi.core.database import get_session
from thread_diary_fastapi.models.models import Post, PostImage, PostLink, PostTag, Tag
from thread_diary_fastapi.services.og_scraper import fetch_multiple_ogs
from thread_diary_fastapi.services.parser import extract_urls_and_tags

from pathlib import Path


router = APIRouter(prefix="/posts", tags=["posts"])

# 라우트 등록 순서 주의
# : FastAPI에서 @router.get("/{post_id}") 같은 동적 경로 라우트보다
# @router.get("/heatmap")을 반드시 위쪽에 선언해야
# "heatmap" 문자열이 post_id 정수 파싱 에러(422 Unprocessable Entity)를 일으키지 않음

# 한국 시간(KST) 기준 날짜 보정
# : 앞서 Post 모델에서 datetime.utcnow로 저장했다면,
# 새벽 0시~9시 사이에 쓴 글이 전날 날짜로 집계되지 않도록
# SQLite의 datetime(..., '+9 hours')로 KST 보정 후 date() 함수를 적용하는 것이 정확함

# --- 응답 / 요청 스키마 ---


class ImageOut(BaseModel):
    id: int
    url: str


class LinkOut(BaseModel):
    id: int
    url: str
    og_title: str | None = None
    og_description: str | None = None
    og_image: str | None = None
    domain: str | None = None


class PostOut(BaseModel):
    id: int
    parent_id: int | None
    root_id: int
    content: str
    created_at: datetime
    images: list[ImageOut] = []
    links: list[LinkOut] = []


class FeedResponse(BaseModel):
    threads: list[list[PostOut]]  # 프론트엔드 PostItem[][] 구조와 1:1 매칭
    next_cursor: int | None = None  # 다음 페이지 요청 시 넘길 root_id 커서
    has_more: bool = False


class DailyCountResponse(BaseModel):
    date: str
    count: int


class CreatePostRequest(BaseModel):
    content: str
    parent_id: int | None = None
    image_ids: list[int] = []


# --- 1. 잔디 히트맵 API (동적 경로보다 위에 배치) ---


# 주의: /{post_id} 같은 동적 경로 라우트보다 반드시 위에 위치해야 함!
@router.get("/heatmap", response_model=list[DailyCountResponse])
def get_activity_heatmap(
    days: int = Query(
        default=180, ge=7, le=365, description="조회할 최근 일수 (기본 180일)"
    ),
    session: Session = Depends(get_session),
):
    """
    최근 N일 동안의 날짜별(KST 기준) 게시글 작성 수를 집계하여 반환함
    """
    since_dt = datetime.now(UTC) - timedelta(days=days)

    # UTC 저장 기준을 한국 시간(+9 hours)으로 보정한 뒤 'YYYY-MM-DD' 문자열 추출
    kst_date_expr = func.date(func.datetime(Post.created_at, "+9 hours"))

    stmt = (
        select(kst_date_expr.label("date"), func.count(col(Post.id)).label("count"))
        .where(col(Post.created_at) >= since_dt)
        .group_by(kst_date_expr)
        .order_by(kst_date_expr.asc())
    )

    results = session.exec(stmt).all()

    return [
        DailyCountResponse(date=date_val, count=count_val)
        for date_val, count_val in results
        if date_val is not None
    ]


# --- 2. 메인 타임라인 피드 조회 API ---


@router.get("", response_model=FeedResponse)
def get_timeline_feed(
    tag: str | None = Query(default=None, description="필터링할 해시태그명 ('#' 제외)"),
    date: str | None = Query(
        default=None, description="특정 날짜 필터 (YYYY-MM-DD, KST)"
    ),
    cursor: int | None = Query(
        default=None, description="이전 페이지의 마지막 root_id"
    ),
    limit: int = Query(default=20, ge=1, le=50),
    session: Session = Depends(get_session),
):
    """
    루트 글 기준으로 타래를 묶어 최신순으로 반환함.
    - tag 또는 date 조건이 주어지면 해당 조건을 만족하는 글이 포함된 타래 전체를 불러옴.
    """
    # 1단계: 조건에 맞는 고유 root_id 목록 추출 쿼리 구성
    root_stmt = select(Post.root_id).where(col(Post.root_id).is_not(None))

    if tag:
        root_stmt = (
            root_stmt.join(PostTag, col(Post.id) == col(PostTag.post_id))
            .join(Tag, col(PostTag.tag_id) == col(Tag.id))
            .where(col(Tag.name) == tag.lstrip("#"))
        )

    if date:
        kst_date_expr = func.date(func.datetime(Post.created_at, "+9 hours"))
        root_stmt = root_stmt.where(kst_date_expr == date)

    if cursor is not None:
        root_stmt = root_stmt.where(col(Post.root_id) < cursor)

    # 중복 제거 및 최신 타래 순 정렬 (다음 페이지 존재 여부 확인을 위해 limit + 1개 조회)
    root_stmt = root_stmt.distinct().order_by(col(Post.root_id).desc()).limit(limit + 1)

    matched_root_ids = [r for r in session.exec(root_stmt).all() if r is not None]

    has_more = len(matched_root_ids) > limit
    target_root_ids = matched_root_ids[:limit]

    if not target_root_ids:
        return FeedResponse(threads=[], next_cursor=None, has_more=False)

    # 2단계: 선택된 root_id들에 속한 모든 게시글 + 이미지 + 링크를 한 번에 로드 (N+1 방지)
    posts_stmt = (
        select(Post)
        .where(col(Post.root_id).in_(target_root_ids))
        .options(selectinload(Post.images), selectinload(Post.links))
        .order_by(
            col(Post.root_id).desc(), col(Post.created_at).asc(), col(Post.id).asc()
        )
    )
    all_posts = session.exec(posts_stmt).all()

    # 3단계: root_id 단위로 그룹핑 (타래 내부 글들은 시간순 정렬 유지)
    grouped: dict[int, list[PostOut]] = {rid: [] for rid in target_root_ids}
    for p in all_posts:
        rid = p.root_id or p.id
        if rid not in grouped:
            continue
        grouped[rid].append(
            PostOut(
                id=p.id,
                parent_id=p.parent_id,
                root_id=rid,
                content=p.content,
                created_at=p.created_at,
                images=[
                    ImageOut(id=img.id, url=img.file_path)
                    for img in sorted(p.images, key=lambda x: x.display_order)
                ],
                links=[
                    LinkOut(
                        id=lnk.id,
                        url=lnk.url,
                        og_title=lnk.og_title,
                        og_description=lnk.og_description,
                        og_image=lnk.og_image,
                        domain=lnk.domain,
                    )
                    for lnk in p.links
                ],
            )
        )

    threads = [grouped[rid] for rid in target_root_ids if grouped[rid]]
    next_cursor = target_root_ids[-1] if has_more else None

    return FeedResponse(threads=threads, next_cursor=next_cursor, has_more=has_more)


# --- 3. 새 글 및 타래 답글 작성 API (이미지 연결 포함) ---


@router.post("")
async def create_post(
    payload: CreatePostRequest,
    session: Session = Depends(get_session),
):
    # 1. 본문에서 URL과 #해시태그 추출
    urls, tag_names = extract_urls_and_tags(payload.content)

    # 2. 타래(Thread)의 root_id 결정
    root_id = None
    if payload.parent_id:
        parent_post = session.get(Post, payload.parent_id)
        if not parent_post:
            raise HTTPException(
                status_code=404, detail="부모 게시글을 찾을 수 없습니다."
            )

        root_id = parent_post.root_id or parent_post.id

    # 3. 게시글 먼저 저장해 ID 확보
    new_post = Post(
        content=payload.content, parent_id=payload.parent_id, root_id=root_id
    )
    session.add(new_post)
    session.flush()  # DB 커밋 전 auto-increment ID 발급

    # 루트 글인 경우 자기 자신의 ID를 root_id로 설정
    if new_post.root_id is None:
        new_post.root_id = new_post.id

    # 임시 업로드된 이미지들을 현재 게시글에 연결
    if payload.image_ids:
        images = session.exec(
            select(PostImage).where(col(PostImage.id).in_(payload.image_ids))
        ).all()
        for idx, img in enumerate(images):
            img.post_id = new_post.id
            img.display_order = idx

    # db flush 했어도 타입 체커한테 id 생겼는지 알려줄 겸 에러 처리
    post_id = new_post.id
    if post_id is None:
        raise RuntimeError("게시글 ID가 생성되지 않았습니다.")

    # 4. 해시태그 조회 또는 신규 생성 후 연결
    for name in tag_names:
        tag = session.exec(select(Tag).where(col(Tag.name) == name)).first()
        if not tag:
            tag = Tag(name=name)
            session.add(tag)
            session.flush()
        # db flush 했어도 타입 체커한테 id 생겼는지 알려줄 겸 에러 처리
        if tag.id is None:
            continue
        session.add(PostTag(post_id=post_id, tag_id=tag.id))

    # 5. 추출된 URL들의 OG 메타데이터 비동기 파싱 및 저장 (OG 링크 메타데이터 추출 및 저장)
    if urls:
        og_results = await fetch_multiple_ogs(urls)
        for og in og_results:
            url = og.get("url")
            if not url:
                continue
            session.add(
                PostLink(
                    post_id=post_id,
                    url=url,
                    og_title=og.get("og_title"),
                    og_description=og.get("og_description"),
                    og_image=og.get("og_image"),
                    domain=og.get("domain"),
                )
            )

    session.commit()
    session.refresh(new_post)

    return PostOut(
        id=post_id,
        parent_id=new_post.parent_id,
        root_id=new_post.root_id,
        content=new_post.content,
        created_at=new_post.created_at,
        images=[ImageOut(id=i.id, url=i.file_path) for i in new_post.images],
        links=[
            LinkOut(
                id=l.id,
                url=l.url,
                og_title=l.og_title,
                og_description=l.og_description,
                og_image=l.og_image,
                domain=l.domain,
            )
            for l in new_post.links
        ],
    )


# --- 삭제 ---


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    session: Session = Depends(get_session),
):
    """
    게시글을 삭제하며, 하위 타래가 존재할 경우 부모-자식 연결 및 root_id를 안전하게 재정렬합니다.
    연결된 로컬 디스크의 이미지 파일도 함께 정리합니다.
    """
    target = session.get(Post, post_id)
    if not target:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

    # 1. 현재 글을 직전 부모로 삼고 있는 하위 답글들 조회
    direct_children = session.exec(
        select(Post)
        .where(col(Post.parent_id) == target.id)
        .order_by(col(Post.created_at).asc(), col(Post.id).asc())
    ).all()

    if direct_children:
        if target.parent_id is None:
            # 케이스 A: 삭제 대상이 타래의 루트 글인 경우
            # 가장 먼저 달린 첫 번째 답글을 새로운 루트 글로 승격
            new_root = direct_children[0]
            new_root.parent_id = None
            new_root.root_id = new_root.id
            session.add(new_root)

            # 나머지 직계 자식들은 새 루트 아래로 붙임
            for sibling in direct_children[1:]:
                sibling.parent_id = new_root.id
                session.add(sibling)

            # 기존 타래에 속했던 모든 후손 글들의 root_id를 새 루트 ID로 일괄 갱신
            all_descendants = session.exec(
                select(Post).where(
                    col(Post.root_id) == target.id,
                    col(Post.id) != target.id,
                )
            ).all()
            for desc in all_descendants:
                desc.root_id = new_root.id
                session.add(desc)
        else:
            # 케이스 B: 타래 중간에 낀 답글인 경우 -> 자식들을 삭제 글의 부모에게 바로 연결
            for child in direct_children:
                child.parent_id = target.parent_id
                session.add(child)

    # 2. 로컬 디스크에 저장된 첨부 이미지 파일 물리 삭제
    for img in target.images:
        # img.file_path 예: "/uploads/2026/11/abc.png" -> 상대 경로 "uploads/2026/11/abc.png"
        local_path = Path(img.file_path.lstrip("/"))
        if local_path.exists():
            local_path.unlink(missing_ok=True)

    # 3. DB 게시글 삭제 (cascade 설정에 의해 PostImage, PostLink, PostTag 자동 삭제)
    session.delete(target)
    session.commit()

    return {"deleted_id": post_id, "status": "ok"}
