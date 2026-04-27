import httpx
import os
import uuid
from typing import Optional


async def generate_image(
    api_key: str,
    prompt: str,
    base_url: str = "https://dashscope.aliyuncs.com/api/v1",
    model_id: str = "qwen-image-2.0-pro",
    size: str = "1024*1024",
    negative_prompt: str = "",
    n: int = 1,
    prompt_extend: bool = False,
) -> list[str]:
    """Generate images using Qwen-Image API. Returns list of local file paths."""

    # Support both base URL-only and full endpoint URL configurations
    if base_url.rstrip("/").endswith("/services/aigc/multimodal-generation/generation"):
        url = base_url.rstrip("/")
    else:
        url = f"{base_url.rstrip('/')}/services/aigc/multimodal-generation/generation"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model_id,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ]
        },
        "parameters": {
            "size": size,
            "prompt_extend": prompt_extend,
            "watermark": False,
        },
    }

    if negative_prompt:
        payload["parameters"]["negative_prompt"] = negative_prompt

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

        # Extract image URLs from response
        image_urls = []
        choices = data.get("output", {}).get("choices", [])
        for choice in choices:
            content = choice.get("message", {}).get("content", [])
            for item in content:
                if "image" in item:
                    image_urls.append(item["image"])

        # Download images to local storage
        uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads", "images")
        os.makedirs(uploads_dir, exist_ok=True)

        local_paths = []
        for img_url in image_urls[:n]:
            img_response = await client.get(img_url)
            img_response.raise_for_status()
            ext = ".png" if "png" in img_response.headers.get("content-type", "") else ".jpg"
            filename = f"{uuid.uuid4().hex}{ext}"
            filepath = os.path.join(uploads_dir, filename)
            with open(filepath, "wb") as f:
                f.write(img_response.content)
            local_paths.append(f"/uploads/images/{filename}")

    return local_paths


SIZE_MAP = {
    "方形图": "1024*1024",
    "竖屏图": "1024*1792",
    "横屏图": "1792*1024",
}
