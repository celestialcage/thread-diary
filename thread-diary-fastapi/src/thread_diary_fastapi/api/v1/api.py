# 라우터 (Controller 역할)
from fastapi import APIRouter

from thread_diary_fastapi.api.v1.endpoints import links, posts, tags, uploads, users

api_router = APIRouter()

api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(posts.router)
api_router.include_router(links.router)
api_router.include_router(uploads.router)
api_router.include_router(tags.router)
# api_router.include_router(heroes.router, prefix="/heroes", tags=["heroes"])
# api_router.include_router(items.router, prefix="/items", tags=["items"])
# api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
