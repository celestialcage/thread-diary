# # DB 쿼리 모음 (Repository 역할)
# from sqlmodel import Session, select

# from thread_diary_fastapi.models.hero import Hero
# from thread_diary_fastapi.schemas.hero import HeroCreate


# def get_heroes_db(session: Session) -> list[Hero]:
#     return list(session.exec(select(Hero)).all())


# def create_hero_db(session: Session, hero_create: HeroCreate) -> Hero:
#     # DTO 데이터를 DB 엔티티 객체로 변환
#     db_hero = Hero(
#         name=hero_create.name,
#         secret_name=hero_create.secret_name,
#         age=hero_create.age,
#         hashed_password=f"fake-hashed-{hero_create.password}",  # 비밀번호 해싱 시뮬레이션
#     )

#     session.add(db_hero)
#     session.commit()
#     session.refresh(db_hero)
#     return db_hero
