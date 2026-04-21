import os
os.makedirs("data", exist_ok=True)

import asyncio
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.database import init_db, async_session
from core.security import hash_password
from models.db import User


async def seed():
    await init_db()
    async with async_session() as db:
        admin = User(username="admin", password_hash=hash_password("admin123"), is_admin=True)
        db.add(admin)
        await db.commit()
        print("Admin user created: admin / admin123")


if __name__ == "__main__":
    asyncio.run(seed())
