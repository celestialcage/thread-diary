# DB 엔진 및 세션 의존성 관리

from sqlmodel import Session, create_engine

from thread_diary_fastapi.models import models

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url, connect_args={"check_same_thread": False}, echo=True)


def get_session():
    """FASTAPI Depends에서 사용할 DB 세션 주입 함수"""
    with Session(engine) as session:
        yield session
