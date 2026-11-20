# # 실제 엔터프라이즈 라우터 (Controller 역할)
# from fastapi import APIRouter, Depends
# from sqlmodel import Session

# from thread_diary_fastapi.core.database import get_session
# from thread_diary_fastapi.schemas.hero import HeroCreate, HeroRead
# from thread_diary_fastapi.services import hero_service

# router = APIRouter()


# # --- CRUD API 엔드포인트 ---
# @router.get("/", response_model=list[HeroRead])
# def read_heroes(session: Session = Depends(get_session)):
#     """히어로 목록 조회 (응답에 hashed_password는 절대 안 나옴)"""
#     return hero_service.get_hero_list(session)


# @router.post("/", response_model=HeroRead)
# def create_hero(hero_create: HeroCreate, session: Session = Depends(get_session)):
#     """히어로 생성 라우터"""
#     return hero_service.register_hero(session, hero_create)
