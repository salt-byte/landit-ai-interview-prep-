"""
Web scraper for extracting JD content from job posting URLs.
Uses httpx with realistic browser simulation.
Falls back to multiple strategies when blocked.
"""
import httpx
import re
import json
from services.llm import parse_jd_from_url_content


BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
}


def _clean_html(text: str) -> str:
    """Strip HTML tags and clean up whitespace."""
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL)
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&#\d+;", " ", text)
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
                if data.get("jobLocation"):
                    loc = data["jobLocation"]
                    if isinstance(loc, dict):
                        addr = loc.get("address", {})
                        if isinstance(addr, dict):
                            parts.append(f"Location: {addr.get('addressLocality', '')} {addr.get('addressRegion', '')}")
                if data.get("description"):
                    desc = data["description"]
                    desc = re.sub(r"<[^>]+>", " ", desc)
                    parts.append(f"Description: {desc}")
                if data.get("qualifications"):
                    parts.append(f"Qualifications: {data['qualifications']}")
                return "\n".join(parts)
        except (json.JSONDecodeError, StopIteration):
            continue
    return ""


async def scrape_url(url: str) -> str:
    """Fetch URL content with realistic browser simulation."""
    try:
        async with httpx.AsyncClient(
            timeout=20.0,
            follow_redirects=True,
            http2=True,
        ) as client:
            resp = await client.get(url, headers=BROWSER_HEADERS)
            resp.raise_for_status()
            raw_html = resp.text

            # Strategy 1: Try JSON-LD structured data (most reliable)
            json_ld = _extract_json_ld(raw_html)
            if json_ld and len(json_ld) > 100:
                return json_ld[:8000]

            # Strategy 2: Clean HTML text
            text = _clean_html(raw_html)
            if len(text) > 200:
                return text[:8000]

            return f"Page returned minimal content. URL: {url}"

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 403:
            return f"ACCESS_BLOCKED: The website blocked our request (403 Forbidden). This site likely has bot protection. Please copy and paste the job description manually. URL: {url}"
        return f"HTTP Error {e.response.status_code} for URL: {url}"
    except Exception as e:
        return f"Failed to fetch URL ({type(e).__name__}): {e}"


async def extract_jd_from_url(url: str) -> dict:
    """Full pipeline: fetch URL -> scrape -> LLM extract JD fields."""
    page_content = await scrape_url(url)

    # If blocked, return a helpful message
    if page_content.startswith("ACCESS_BLOCKED") or page_content.startswith("Failed") or page_content.startswith("HTTP Error"):
        return {
            "title": "",
            "company": "",
            "jd": page_content,
            "team_info": "",
        }

    result = await parse_jd_from_url_content(url, page_content)
    return result
