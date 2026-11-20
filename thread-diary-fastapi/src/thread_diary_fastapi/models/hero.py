# # DB 엔티티 (SQLModel table=True)
# from sqlmodel import Field, SQLModel


# class Hero(SQLModel, table=True):
#     __tablename__: str = "heroes"  # 실제 DB 테이블 이름 명시

#     id: int | None = Field(default=None, primary_key=True)
#     name: str = Field(index=True)
#     secret_name: str
#     age: int | None = None
#     # 예시: DB에만 저장되고 API 응답에는 절대 노출 안 할 컬럼
#     hashed_password: str | None = None
