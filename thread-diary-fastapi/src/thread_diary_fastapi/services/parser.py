import re

# http:// 또는 https:// 로 시작하는 URL 정규식 (끝에 붙은 괄호나 마침표 등 문장부호 제외)
URL_PATTERN = re.compile(r"https?://[^\s<>\"'()]+")

# 공백 또는 줄바꿈 뒤에 오는 한글/영문/숫자/언더스코어 해시태그 정규식
HASHTAG_PATTERN = re.compile(r"(?:^|\s)#([가-힣a-zA-Z0-9_]{1,50})")


def extract_urls_and_tags(content: str) -> tuple[list[str], list[str]]:
    """
    본문 텍스트에서 (고유 URL 리스트, 고유 해시태그 리스트)를 순서대로 추출함.
    """
    # 1. URL 먼저 추출
    raw_urls = URL_PATTERN.findall(content)
    # URL 끝에 실수로 붙은 문장부호(.,!?) 정리 및 중복 제거(순서 유지)
    cleaned_urls = []
    for u in raw_urls:
        u = u.rstrip(".,!?")
        if u not in cleaned_urls:
            cleaned_urls.append(u)

    # 2. 해시태그 오탐 방지를 위해 본문에서 URL 문자열을 공백으로 치환 후 태그 추출
    content_without_urls = URL_PATTERN.sub(" ", content)
    raw_tags = HASHTAG_PATTERN.findall(content_without_urls)

    # 소문자 통일 또는 원형 유지 후 중복 제거 (순서 유지)
    unique_tags = []
    for tag in raw_tags:
        if tag not in unique_tags:
            unique_tags.append(tag)

    return cleaned_urls, unique_tags
