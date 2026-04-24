import httpx
from typing import Optional


async def fetch_webpage_text(url: str) -> str:
    """Fetch a webpage and extract its text content."""
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0"
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            html = response.text

        # Try markdownify first, fallback to regex
        text = _html_to_markdown(html)
        return text
    except httpx.HTTPStatusError as e:
        return f"[网页抓取失败: HTTP {e.response.status_code}]"
    except httpx.RequestError as e:
        return f"[网页抓取失败: {e}]"
    except Exception as e:
        return f"[网页解析失败: {e}]"


def _html_to_markdown(html: str) -> str:
    """Convert HTML to markdown. Try markdownify first, fallback to regex."""
    try:
        import markdownify
        md = markdownify.markdownify(html, heading_style="ATX", strip=["script", "style", "nav", "footer"])
        import re
        md = re.sub(r"\n{3,}", "\n\n", md)
        return md.strip()
    except ImportError:
        return _html_to_text_regex(html)


def _html_to_text_regex(html: str) -> str:
    """Simple HTML tag stripping (fallback)."""
    import re
    html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    html = re.sub(r'</?(div|p|br|h[1-6]|li|tr)[^>]*>', '\n', html, flags=re.IGNORECASE)
    html = re.sub(r'<[^>]+>', '', html)
    import html as html_module
    html = html_module.unescape(html)
    html = re.sub(r'\n\s*\n', '\n\n', html)
    html = re.sub(r'[ \t]+', ' ', html)
    return html.strip()
