import openai
from typing import AsyncGenerator


async def stream_chat(
    base_url: str,
    api_key: str,
    model_id: str,
    messages: list,
) -> AsyncGenerator[str, None]:
    """Stream chat completion tokens from any OpenAI-compatible API."""
    client = openai.AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=120.0)
    stream = await client.chat.completions.create(
        model=model_id,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
