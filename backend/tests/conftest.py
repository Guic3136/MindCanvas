import os
import pytest
import pytest_asyncio

# Fix passlib/bcrypt compatibility on Python 3.13
import bcrypt as _bcrypt
import passlib.handlers.bcrypt as _passlib_bcrypt
_passlib_bcrypt._bcrypt = _bcrypt

# Set test database URL before importing app
os.environ["MINDCANVAS_DATABASE_URL"] = "sqlite+aiosqlite:///./test_mindcanvas.db"

from httpx import AsyncClient, ASGITransport
from main import app
from core.database import get_db, Base, async_session
from core.security import hash_password
from models.db import User


@pytest_asyncio.fixture
async def db_session(test_engine):
    """Provide an AsyncSession connected to the test engine."""
    from sqlalchemy.ext.asyncio import AsyncSession
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        yield session


@pytest_asyncio.fixture
async def test_engine():
    """Create a test engine and ensure tables exist."""
    from sqlalchemy.ext.asyncio import create_async_engine
    engine = create_async_engine("sqlite+aiosqlite:///./test_mindcanvas.db")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(test_engine):
    """Create a test client using the test engine."""
    from sqlalchemy.ext.asyncio import AsyncSession

    async def _override_get_db():
        async with AsyncSession(test_engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def user_and_token(test_engine):
    """Create a user in the test database and return (user_id, auth_headers)."""
    from core.security import create_access_token
    from sqlalchemy.ext.asyncio import AsyncSession

    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        user = User(username="testuser", password_hash=hash_password("testpass123"))
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token({"sub": str(user.id)})
        return user.id, {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def project(client, user_and_token):
    _, headers = user_and_token
    resp = await client.post("/api/projects", json={"name": "Test Project"}, headers=headers)
    assert resp.status_code == 200
    return resp.json()["id"]
