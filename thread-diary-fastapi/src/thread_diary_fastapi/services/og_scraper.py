import asyncio
from urllib.parse import urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup
import httpx


# 일반 브라우저처럼 보이도록 User-Agent 헤더 설정 (일부 사이트 봇 차단 우회)
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-Kr,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}


def _extract_domain(url: str) -> str:
    netloc = urlparse(url).netloc
    return netloc.removeprefix("www.")


def _get_meta_content(soup: BeautifulSoup, property_name: str) -> str | None:
    # property="og:..." 또는 name="og:..." 둘 다 대응
    tag = soup.find("meta", property=property_name) or soup.find(
        "meta", attrs={"name": property_name}
    )
    if not tag:
        return None

    content = tag.get("content")
    # 타입 체커에게 content가 확실히 str임을 알려줘서 .strip() 경고를 없애줌
    if isinstance(content, str):
        stripped = content.strip()
        # content="" 또는 공백만 있는 경우 빈 문자열 대신 None을 반환, 반환 타입 str | None의 의도에 맞게 처리
        return stripped or None
    if isinstance(content, list):
        joined = " ".join(str(item) for item in content).strip()
        return joined or None

    return None


async def fetch_single_og(client: httpx.AsyncClient, url: str) -> dict[str, str | None]:
    """
    단일 URL에서 Open Graph 메타데이터(제목, 설명, 썸네일, 도메인)를 비동기로 파싱함.
    실패 시에도 예외를 던지지 않고 도메인 기반 기본 딕셔너리를 반환함.
    """
    domain = _extract_domain(url)
    fallback_result = {
        "url": url,
        "og_title": domain,
        "og_description": None,
        "og_image": None,
        "domain": domain,
    }

    # 스크래핑 요청 전용 URL 변환 (DB에 저장되는 url 변수는 원본 유지)
    target_url = _to_scrapable_url(url)

    try:
        response = await client.get(
            target_url, headers=DEFAULT_HEADERS, follow_redirects=True
        )
        if response.status_code >= 400:
            return fallback_result

        # HTML 응답이 아닌 경우 (예: 직접 이미지 링크, PDF 등) 파싱 생략
        content_type = response.headers.get("content-type", "")
        if "text/html" not in content_type:
            return fallback_result

        soup = BeautifulSoup(response.text, "html.parser")

        # 1. 제목 추출 (og:title -> twitter:title -> <title> 태그 -> 도메인 순 폴백)
        title = (
            _get_meta_content(soup, "og:title")
            or _get_meta_content(soup, "twitter:title")
            or (soup.title.string.strip() if soup.title and soup.title.string else None)
            or domain
        )

        # 2. 설명 추출 (og:description -> twitter:description -> meta description)
        description = (
            _get_meta_content(soup, "og:description")
            or _get_meta_content(soup, "twitter:description")
            or _get_meta_content(soup, "description")
        )

        # 3. 썸네일 이미지 추출 및 상대 경로(/img/thumb.png)를 절대 경로로 보정
        image = _get_meta_content(soup, "og:image") or _get_meta_content(
            soup, "twitter:image"
        )
        if image:
            image = urljoin(str(response.url), image)

        return {
            "url": url,
            "og_title": title[:255],
            "og_description": description,
            "og_image": image,
            "domain": domain[:100],
        }

    except Exception:
        # 타임아웃, SSL 오류, 네트워크 단절 시 글 저장이 막히지 않도록 기본값 반환
        return fallback_result


async def fetch_multiple_ogs(urls: list[str]) -> list[dict[str, str | None]]:
    """
    여러 개의 URL을 동시에 비동기로 스크래핑함. (최대 3.5초 타임아웃)
    """
    if not urls:
        return []

    timeout = httpx.Timeout(3.5, connect=2.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        tasks = [fetch_single_og(client, url) for url in urls]
        return await asyncio.gather(*tasks)


# --- X(트위터) 링크 OG 크롤링 보완 ---


def _to_scrapable_url(url: str) -> str:
    """
    X(트위터) 링크처럼 일반 크롤러를 차단하는 도메인은 OG 메타데이터 전용 프록시(fxtwitter)로
    우회하여 스크래핑하고, DB에는 원본 URL을 그대로 보존합니다.
    """
    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")

    if host in ("x.com", "twitter.com", "mobile.twitter.com", "mobile.x.com"):
        # 경로가 '/사용자명/status/트윗ID' 형태인 트윗 링크만 치환
        if "/status/" in parsed.path:
            replaced = parsed._replace(netloc="fxtwitter.com")
            return urlunparse(replaced)

    return url
