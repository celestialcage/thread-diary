from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, col, select

from thread_diary_fastapi.core.database import get_session
from thread_diary_fastapi.models.models import Post, PostLink

router = APIRouter(tags=["links"])


@router.get("/links")
def get_archived_links(
    q: str | None = Query(default=None, description="제목, URL 또는 본문 검색어"),
    domain: str | None = Query(default=None, description="특정 도메인 필터(예: x.com)"),
    limit: int = Query(default=30, le=100),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_session),
):
    """
    저장된 모든 링크와 해당 링크가 포함된 원본 게시글/타래 위치 정보를 함께 반환함.
    """
    stmt = (
        select(PostLink, Post)
        .join(Post, col(PostLink.post_id) == Post.id)
        .order_by(col(PostLink.created_at).desc())
    )

    if domain:
        stmt = stmt.where(PostLink.domain == domain)

    if q:
        keyword = f"%{q}%"
        stmt = stmt.where(
            col(PostLink.og_title).ilike(keyword)
            | col(PostLink.url).ilike(keyword)
            | col(Post.content).ilike(keyword)
        )

    results = session.exec(stmt.offset(offset).limit(limit)).all()

    items = []
    for link, post in results:
        # 링크 카드 하단에 같이 보여줄 내 코멘트 스니펫 (URL 제거 후 앞 100자)
        snippet = post.content.replace(link.url, "").strip()
        if len(snippet) > 100:
            snippet = snippet[:100] + "..."

        items.append(
            {
                "link_id": link.id,
                "url": link.url,
                "og_title": link.og_title,
                "og_description": link.og_description,
                "og_image": link.og_image,
                "domain": link.domain,
                "saved_at": link.created_at,
                # 원본 타래 역추적용 메타데이터
                "post_id": post.id,
                "root_id": post.root_id or post.id,
                "post_snippet": snippet,
            }
        )

    return {"items": items, "count": len(items)}


@router.get("/posts/{post_id}/thread")
def get_thread_by_post_id(post_id: int, session: Session = Depends(get_session)):
    """
    특정 게시글(post_id)이 속한 전체 타래 스레드를 루트부터 시간순으로 반환함.
    링크 아카이브에서 원본 게시글로 점프할 때 사용함.
    """
    target_post = session.get(Post, post_id)
    if not target_post:
        raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다.")

    root_id = target_post.root_id or target_post.id

    # 동일한 root_id를 가진 모든 글을 작성 시간순으로 조회
    thread_posts = session.exec(
        select(Post).where(Post.root_id == root_id).order_by(col(Post.created_at).asc())
    ).all()

    return {
        "root_id": root_id,
        "target_post_id": target_post.id,  # 프론트에서 이 ID 위치로 스크롤 & 하이라이트
        "thread": [
            {
                "id": p.id,
                "parent_id": p.parent_id,
                "content": p.content,
                "created_at": p.created_at,
                "images": [{"id": img.id, "url": img.file_path} for img in p.images],
                "links": [
                    {
                        "id": lnk.id,
                        "url": lnk.url,
                        "og_title": lnk.og_title,
                        "og_description": lnk.og_description,
                        "og_image": lnk.og_image,
                        "domain": lnk.domain,
                    }
                    for lnk in p.links
                ],
            }
            for p in thread_posts
        ],
    }
