# 1. 게시글 & 타래 모델
from datetime import UTC, datetime

from sqlmodel import Field, Relationship, SQLModel


class Post(SQLModel, table=True):
    __tablename__: str = "posts"

    id: int | None = Field(default=None, primary_key=True)
    parent_id: int | None = Field(default=None, foreign_key="posts.id")
    root_id: int | None = Field(default=None, foreign_key="posts.id", index=True)
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # 관계 설정 (JPA의 @OneToMany 매핑과 동일)
    images: list[PostImage] = Relationship(
        back_populates="post", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    links: list[PostLink] = Relationship(
        back_populates="post", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    tags: list[PostTag] = Relationship(
        back_populates="post", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


# 2. 해시태그 마스터 모델
class Tag(SQLModel, table=True):
    __tablename__: str = "tags"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=50, unique=True, index=True)
    is_pinned: bool = Field(default=False)

    post_tags: list[PostTag] = Relationship(back_populates="tag")


# 3. 게시글-해시태그 매핑 모델 (N:M)
class PostTag(SQLModel, table=True):
    __tablename__: str = "post_tags"

    post_id: int = Field(foreign_key="posts.id", primary_key=True)
    tag_id: int = Field(foreign_key="tags.id", primary_key=True)

    post: Post | None = Relationship(back_populates="tags")
    tag: Tag | None = Relationship(back_populates="post_tags")


# 4. 첨부 이미지 모델
class PostImage(SQLModel, table=True):
    __tablename__: str = "post_images"

    id: int | None = Field(default=None, primary_key=True)
    post_id: int | None = Field(default=None, foreign_key="posts.id")  # orphan 처리...
    file_path: str = Field(max_length=255)
    original_name: str | None = Field(default=None, max_length=255)
    display_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    post: Post | None = Relationship(back_populates="images")


class PostLink(SQLModel, table=True):
    __tablename__: str = "post_links"

    id: int | None = Field(default=None, primary_key=True)
    post_id: int = Field(foreign_key="posts.id")
    url: str
    og_title: str | None = Field(default=None, max_length=255)
    og_description: str | None = Field(default=None)
    og_image: str | None = Field(default=None)
    domain: str | None = Field(default=None, max_length=100)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)

    post: Post | None = Relationship(back_populates="links")
