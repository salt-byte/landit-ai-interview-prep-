"""
Web scraper for extracting JD content from job posting URLs.
Strategy: Tavily API (primary) -> httpx fallback.
"""
import httpx
import re
import json
import logging
from services.llm import parse_jd_from_url_content
from config import settings

logger = logging.getLogger(__name__)

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}


def _clean_html(text: str) -> str:
    """Strip HTML tags and clean up whitespace."""
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL)
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;|&#\d+;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_json_ld(html: str) -> str:
    """Try to extract structured job data from JSON-LD schema."""
    matches = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
    for match in matches:
        try:
            data = json.loads(match)
            if isinstance(data, list):
                data = next((d for d in data if d.get("@type") in ["JobPosting", "jobPosting"]), None)
            if data and data.get("@type") in ["JobPosting", "jobPosting"]:
                parts = []
                if data.get("title"):
                    parts.append(f"Title: {data['title']}")
                if data.get("hiringOrganization", {}).get("name"):
                    parts.append(f"Company: {data['hiringOrganization']['name']}")
                if data.get("description"):
                    desc = re.sub(r"<[^>]+>", " ", data["description"])
                    parts.append(f"Description: {desc}")
                return "\n".join(parts)
        except (json.JSONDecodeError, StopIteration):
            continue
    return ""


async def scrape_with_tavily(url: str) -> str:
    """Use Tavily Extract API to get clean page content. Bypasses most anti-bot."""
    if not settings.tavily_api_key:
        raise ValueError("TAVILY_API_KEY not set")

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            "https://api.tavily.com/extract",
            json={
                "api_key": settings.tavily_api_key,
                "urls": [url],
            },
        )
        resp.raise_for_status()
        data = resp.json()

        results = data.get("results", [])
        if results and results[0].get("raw_content"):
            return results[0]["raw_content"][:8000]
        if results and results[0].get("text"):
            return results[0]["text"][:8000]

    raise ValueError("Tavily returned no content")


async def scrape_with_httpx(url: str) -> str:
    """Fallback: direct HTTP fetch with browser headers."""
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True, http2=False) as client:
        resp = await client.get(url, headers=BROWSER_HEADERS)
        resp.raise_for_status()
        raw_html = resp.text

        # Try JSON-LD first
        json_ld = _extract_json_ld(raw_html)
        if json_ld and len(json_ld) > 100:
            return json_ld[:8000]

        text = _clean_html(raw_html)
        if len(text) > 200:
            return text[:8000]

        return f"Page returned minimal content. URL: {url}"


def _extract_info_from_url(url: str) -> str:
    """Extract useful hints from the URL path itself (company, title, ID)."""
    parts = []
    # Common patterns: workday, lever, greenhouse, ashby, etc.
    lower = url.lower()
    if "workday" in lower or "myworkdayjobs" in lower:
        # e.g. .../Tencent_Careers/job/US-California/Cloud-Media-Services-Intern_R106872
        segments = url.rstrip("/").split("/")
        for seg in segments:
            cleaned = seg.replace("-", " ").replace("_", " ").strip()
            if cleaned and len(cleaned) > 2 and not cleaned.startswith("http"):
                parts.append(cleaned)
    elif "lever.co" in lower or "greenhouse.io" in lower or "ashbyhq.com" in lower:
        segments = url.rstrip("/").split("/")
        for seg in segments[-3:]:
            cleaned = seg.replace("-", " ").replace("_", " ").strip()
            if cleaned and len(cleaned) > 2:
                parts.append(cleaned)
    return f"URL hints: {' | '.join(parts)}" if parts else ""


async def scrape_url(url: str) -> str:
    """Fetch URL content. Tries Tavily first, falls back to httpx."""
    # Strategy 1: Tavily API (handles anti-bot sites)
    try:
        content = await scrape_with_tavily(url)
        logger.info("URL scraped with Tavily: %s", url[:80])
        return content
    except Exception as e:
        logger.info("Tavily failed (%s), trying httpx fallback", e)

    # Strategy 2: Direct httpx with browser headers
    try:
        content = await scrape_with_httpx(url)
        logger.info("URL scraped with httpx: %s", url[:80])
        return content
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 403:
            return f"ACCESS_BLOCKED: This website blocked our request. Please copy and paste the job description manually. URL: {url}"
        return f"HTTP Error {e.response.status_code}: {url}"
    except Exception as e:
        return f"Failed to fetch URL: {e}"


async def extract_jd_from_url(url: str) -> dict:
    """Full pipeline: fetch URL -> scrape -> LLM extract JD fields."""
    page_content = await scrape_url(url)

    # If scraping failed or returned minimal content, enrich with URL hints
    is_thin = (
        page_content.startswith(("ACCESS_BLOCKED", "Failed", "HTTP Error", "Page returned minimal"))
        or len(page_content.strip()) < 300
    )

    if is_thin:
        url_hints = _extract_info_from_url(url)
        if url_hints:
            page_content = f"{url_hints}\n\n{page_content}"
        logger.info("Thin scrape result, enriched with URL hints for LLM")

    result = await parse_jd_from_url_content(url, page_content)
    return result
