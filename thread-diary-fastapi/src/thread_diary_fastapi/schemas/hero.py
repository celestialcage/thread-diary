# Pydantic 데이터 검증/스키마 (DTO)
# 💡 API 요청/응답 검증 전용 (DTO)

from sqlmodel import SQLModel


# 공통 필드 정의 (상속용)
class HeroBase(SQLModel):
    name: str
    secret_name: str
    age: int | None = None


# 1. POST 요청 시 클라이언트가 보내야 하는 데이터 규격 (Request Body)
class HeroCreate(HeroBase):
    password: str  # 생성할 때만 필요한 비밀번호 등


# 2. 클라이언트에게 응답할 때 사용하는 데이터 규격 (Response Body - 비밀번호 제외!)
class HeroRead(HeroBase):
    id: int


# 3. PATCH/PUT 수정 요청 시 사용하는 데이터 규격 (선택적 입력 허용)
class HeroUpdate(SQLModel):
    name: str | None = None
    secret_name: str | None = None
    age: int | None = None
