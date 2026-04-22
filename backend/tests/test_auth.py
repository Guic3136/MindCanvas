import pytest
from core.security import hash_password, create_access_token
from models.db import User


async def test_register(client, db_session):
    user = User(username="newuser", password_hash=hash_password("password123"))
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    assert user.id is not None

    resp = await client.post("/api/auth/login", json={
        "username": "newuser",
        "password": "password123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_register_duplicate(client, db_session):
    user = User(username="dupuser", password_hash=hash_password("password123"))
    db_session.add(user)
    await db_session.commit()

    from sqlalchemy.exc import IntegrityError
    user2 = User(username="dupuser", password_hash=hash_password("otherpass"))
    db_session.add(user2)
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_login(client, db_session):
    user = User(username="loginuser", password_hash=hash_password("mypass"))
    db_session.add(user)
    await db_session.commit()

    resp = await client.post("/api/auth/login", json={
        "username": "loginuser",
        "password": "mypass",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client, db_session):
    user = User(username="wrongpass", password_hash=hash_password("correct"))
    db_session.add(user)
    await db_session.commit()

    resp = await client.post("/api/auth/login", json={
        "username": "wrongpass",
        "password": "incorrect",
    })
    assert resp.status_code == 401


async def test_me(client, db_session):
    user = User(username="meuser", password_hash=hash_password("pass123"))
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = create_access_token({"sub": str(user.id)})

    resp = await client.get("/api/auth/me", cookies={"access_token": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "meuser"
    assert data["id"] == user.id
