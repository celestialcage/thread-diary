# uv run fastapi dev src/my_fastapi_project/main.py
# uv run uvicorn my_project.main:app --reload
# uv run uvicorn main:app --reload
# 앱 진입점 (Lifespan, 미들웨어 등)

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel

from thread_diary_fastapi.api.v1.api import api_router
from thread_diary_fastapi.core.database import engine


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 시작 시 테이블 자동 생성 (JPA ddl-auto=create 역할)
    create_db_and_tables()
    yield


app = FastAPI(title="my first FASTAPI project", lifespan=lifespan)

# 라우터 등록
app.include_router(api_router, prefix="/api/v1")

# 로컬 개발 환경(Vite React 기본 포트) CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 마운트 설정
# 업로드된 이미지를 프론트엔드 <img src="http://localhost:8000/uploads/..." />로 바로 띄우기 위해
Path("uploads").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/")
def root():
    return {"message": "Hi FastApi Server is running~"}
