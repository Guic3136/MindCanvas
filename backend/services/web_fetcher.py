import httpx
from typing import Optional


async def fetch_webpage_text(url: str, max_length: int = 10000) -> str:
    """Fetch a webpage and extract its text content."""
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0"
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            html = response.text

        # Simple HTML-to-text extraction
        text = _html_to_text(html)
        if len(text) > max_length:
            text = text[:max_length] + f"\n\n[内容已截断，原始长度: {len(text)} 字符]"
        return text
    except httpx.HTTPStatusError as e:
        return f"[网页抓取失败: HTTP {e.response.status_code}]"
    except httpx.RequestError as e:
        return f"[网页抓取失败: {e}]"
    except Exception as e:
        return f"[网页解析失败: {e}]"


def _html_to_text(html: str) -> str:
    """Simple HTML tag stripping."""
    import re
    # Remove script and style tags and their contents
    html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove HTML comments
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    # Replace common block tags with newlines
    html = re.sub(r'</?(div|p|br|h[1-6]|li|tr)[^>]*>', '\n', html, flags=re.IGNORECASE)
    # Remove all remaining tags
    html = re.sub(r'<[^>]+>', '', html)
    # Decode HTML entities
    import html as html_module
    html = html_module.unescape(html)
    # Collapse multiple whitespace
    html = re.sub(r'\n\s*\n', '\n\n', html)
    html = re.sub(r'[ \t]+', ' ', html)
    return html.strip()
