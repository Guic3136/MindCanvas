import subprocess
import tempfile
import os
from typing import Literal


async def run_code(language: Literal["python", "javascript"], script: str, timeout: int = 10) -> str:
    """Run code in a temporary file with subprocess."""
    if language == "python":
        ext = ".py"
        cmd = ["python3", "-c", script]
    elif language == "javascript":
        ext = ".js"
        cmd = ["node", "-e", script]
    else:
        return f"[不支持的语言: {language}]"

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = result.stdout
        if result.stderr:
            output += "\n[stderr]\n" + result.stderr
        if result.returncode != 0:
            output += f"\n[exit code: {result.returncode}]"
        return output.strip() or "[无输出]"
    except subprocess.TimeoutExpired:
        return f"[执行超时 ({timeout}s)]"
    except FileNotFoundError:
        return f"[找不到 {cmd[0]} 解释器，请确保已安装]"
    except Exception as e:
        return f"[执行失败: {e}]"
