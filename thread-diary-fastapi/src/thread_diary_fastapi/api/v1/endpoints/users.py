from fastapi import APIRouter

# 개별 라우터 생성
router = APIRouter()


@router.get("/")
def get_users():
    """유저 목록 조회 API"""
    return [{"id": 1, "name": "김코딩"}, {"id": 2, "name": "박파이썬"}]


@router.post("/")
def create_user(name: str):
    """유저 생성 API"""
    return {"message": f"환영합니다, {name}님.", "status": "success"}
