from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Session, col, select

from thread_diary_fastapi.core.database import get_session
from thread_diary_fastapi.models.models import PostTag, Tag


router = APIRouter(prefix="tags", tags=["tags"])


class TagOut(BaseModel):
    id: int
    name: str
    is_pinned: bool
    post_count: int


@router.get("", response_model=list[TagOut])
def get_tags(
    pinned_only: bool = Query(
        default=False, description="상단 탭에 고정된 태그만 조회 여부"
    ),
    session: Session = Depends(get_session),
):
    """
    해시태그 목록을 게시글 수와 함께 반환함.
    정렬 순서: 1) 핀 고정 여부(is_pinned DESC) -> 2) 사용 빈도(post_count DESC) -> 3) 이름순
    """
    post_count_expr = func.count(col(PostTag.post_id)).label("post_count")

    stmt = (
        select(Tag.id, Tag.name, Tag.is_pinned, post_count_expr)
        .outerjoin(PostTag, col(Tag.id) == col(PostTag.tag_id))
        .group_by(col(Tag.id))
    )

    if pinned_only:
        stmt = stmt.where(col(Tag.is_pinned).is_(True))

    stmt = stmt.order_by(
        col(Tag.is_pinned).desc(), post_count_expr.desc(), col(Tag.name).asc()
    )

    results = session.exec(stmt).all()

    return [
        TagOut(
            id=row.id, name=row.name, is_pinned=row.is_pinned, post_count=row.post_count
        )
        for row in results
    ]


@router.patch("/{tag_id}/pin", response_model=TagOut)
def toggle_tag_pin(tag_id: int, session: Session = Depends(get_session)):
    """
    특정 해시태그의 상단 탭 고정(is_pinned) 상태를 반전(토글)합니다.
    """
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="해시태그를 찾을 수 없습니다.")

    tag.is_pinned = not tag.is_pinned
    session.add(tag)
    session.commit()
    session.refresh(tag)

    # 현재 해당 태그가 연결된 게시글 수 조회
    count_stmt = select(func.count(col(PostTag.post_id))).where(
        col(PostTag.tag_id) == tag.id
    )
    post_cout = session.exec(count_stmt).one()

    return TagOut(
        id=tag.id, name=tag.name, is_pinned=tag.is_pinned, post_count=post_cout
    )
