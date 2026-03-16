"""
Web scraper for extracting JD content from job posting URLs.
Uses httpx for async HTTP requests.
"""
import httpx
import re
from services.llm import parse_jd_from_url_content


async def scrape_url(url: str) -> str:
    """Fetch URL content and return cleaned text."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            text = resp.text

            # Basic HTML tag stripping
            text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL)
            text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"\s+", " ", text).strip()
            return text[:8000]
    except Exception as e:
        return f"Failed to fetch URL: {e}"


async def extract_jd_from_url(url: str) -> dict:
    """Full pipeline: fetch URL → scrape → LLM extract JD fields."""
    page_content = await scrape_url(url)
    if page_content.startswith("Failed"):
        return {
            "title": "",
            "company": "",
            "jd": f"Could not fetch URL: {url}. Please paste the JD manually.",
            "team_info": "",
        }
    result = await parse_jd_from_url_content(url, page_content)
    return result
