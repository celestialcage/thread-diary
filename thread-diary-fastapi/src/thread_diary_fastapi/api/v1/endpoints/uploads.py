from datetime import UTC, datetime
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session

from thread_diary_fastapi.core.database import get_session
from thread_diary_fastapi.models.models import PostImage


router = APIRouter(prefix="uploads", tags=["uploads"])

UPLOAD_ROOT = Path("uploads")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB 제한


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...), session: Session = Depends(get_session)
):
    # 1. 확장자 검증 (클립보드 붙여넣기 시 filename이 없을 수 있으므로 content_type 보조 확인)
    orig_name = file.filename or "pasted_image.png"
    ext = Path(orig_name).suffix.lower()
    if not ext and file.content_type:
        ext = f".{file.content_type.split('/')[-1]}"

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="지원하지 않는 이미지 형식입니다.")

    # 2. 용량 검증 및 바이트 읽기
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail="이미지 크기는 10MB 이하여야 합니다."
        )

    # 3. 연/월 디렉터리 생성 (예: uploads/2026/11/)
    now = datetime.now(UTC)
    sub_dir = UPLOAD_ROOT / f"{now.year}" / f"{now.month:02d}"
    sub_dir.mkdir(parents=True, exist_ok=True)

    # 4. UUID 파일명으로 로컬 디스크 저장
    saved_filename = f"{uuid.uuid4().hex}{ext}"
    saved_path = sub_dir / saved_filename
    saved_path.write_bytes(contents)

    # 웹 접근용 URL 경로 (OS 관계없이 슬래시 통일)
    public_url = f"/uploads/{now.year}/{now.month:02d}/{saved_filename}"

    # 5. DB에 임시 이미지 레코드 생성 (게시글 등록 시 post_id 연결)
    db_image = PostImage(
        post_id=None, file_path=public_url, original_name=orig_name[:255]
    )
    session.add(db_image)
    session.commit()
    session.refresh(db_image)

    return {
        "id": db_image.id,
        "url": db_image.file_path,
        "original_name": db_image.original_name,
    }
