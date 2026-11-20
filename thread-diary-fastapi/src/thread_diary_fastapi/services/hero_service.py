# # 비즈니스 로직 (Service 역할)
# from fastapi import HTTPException, status
# from sqlmodel import Session

# from thread_diary_fastapi.crud import hero as crud_hero
# from thread_diary_fastapi.schemas.hero import HeroCreate, HeroRead


# def get_hero_list(session: Session) -> list[HeroRead]:
#     # 필요하다면 여기서 데이터 가공이나 권한 체크 등을 수행
#     # DB에서 엔티티 목록을 가져옴 (FastAPI/SQLModel이 알아서 HeroRead 형태로 직렬화 지원)

#     # 리스트 컴프리헨션으로 변환
#     # 1. DB에서 모델 객체 리스트 조회
#     heroes = crud_hero.get_heroes_db(session)
#     # 2. 리스트 컴프리헨션을 돌며 HeroRead DTO로 변환
#     return [HeroRead.model_validate(hero) for hero in heroes]


# def register_hero(session: Session, hero_data: HeroCreate) -> HeroRead:
#     if hero_data.name.lower() == "yeon":
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="류연은 이 세계에 등록할 수 없음.",
#         )

#     # 추가적인 비즈니스 로직 (예: 비밀번호 해싱, 외부 로그 전송 등)이 들어갈 자리

#     hero = crud_hero.create_hero_db(session, hero_data)
#     # # 직접 dto <-> model 변환
#     # assert hero.id is not None

#     # read_hero = HeroRead(
#     #     id=hero.id,
#     #     name=hero.name,
#     #     secret_name=hero.secret_name,
#     #     age=hero.age,
#     # )

#     # 수동으로 하나씩 넣지 않고, ORM 객체를 그대로 검증/변환
#     read_hero = HeroRead.model_validate(hero)

#     # DB 저장 요청은 CRUD 계층에 위임
#     return read_hero
