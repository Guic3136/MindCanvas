from core.security import hash_password, create_access_token
from models.db import User


async def test_list_projects(client, user_and_token):
    _, headers = user_and_token
    resp = await client.get("/api/projects", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


async def test_create_project(client, user_and_token):
    _, headers = user_and_token
    resp = await client.post("/api/projects", json={"name": "My Project"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "My Project"
    assert "id" in data


async def test_get_project(client, project, user_and_token):
    _, headers = user_and_token
    resp = await client.get(f"/api/projects/{project}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == project
    assert data["name"] == "Test Project"


async def test_delete_project(client, user_and_token):
    _, headers = user_and_token
    resp = await client.post("/api/projects", json={"name": "ToDelete"}, headers=headers)
    assert resp.status_code == 200
    pid = resp.json()["id"]

    resp = await client.delete(f"/api/projects/{pid}", headers=headers)
    assert resp.status_code == 200

    resp = await client.get(f"/api/projects/{pid}", headers=headers)
    assert resp.status_code == 404


async def test_cannot_access_others_project(client, db_session, user_and_token):
    _, headers_a = user_and_token

    resp = await client.post("/api/projects", json={"name": "UserA Project"}, headers=headers_a)
    assert resp.status_code == 200
    project_a_id = resp.json()["id"]

    user_b = User(username="userb", password_hash=hash_password("pass123"))
    db_session.add(user_b)
    await db_session.commit()
    await db_session.refresh(user_b)

    token_b = create_access_token({"sub": str(user_b.id)})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    resp = await client.get(f"/api/projects/{project_a_id}", headers=headers_b)
    assert resp.status_code == 404

    resp = await client.delete(f"/api/projects/{project_a_id}", headers=headers_b)
    assert resp.status_code == 404
