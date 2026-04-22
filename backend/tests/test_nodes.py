from models.db import Model, ModelProvider
from core.security import encrypt_value


async def _create_model(db_session):
    provider = ModelProvider(name="Test Provider", base_url="http://test")
    provider.api_key = "test-key-1234567890"
    db_session.add(provider)
    await db_session.commit()
    await db_session.refresh(provider)

    model = Model(provider_id=provider.id, model_id="test-model", display_name="Test Model")
    db_session.add(model)
    await db_session.commit()
    await db_session.refresh(model)
    return model.id


async def test_create_node(client, db_session, project, user_and_token):
    _, headers = user_and_token
    model_id = await _create_model(db_session)

    resp = await client.post(
        f"/api/projects/{project}/nodes",
        json={"model_id": model_id, "label": "Node A", "position_x": 100, "position_y": 200},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["label"] == "Node A"
    assert data["project_id"] == project
    return data["id"]


async def test_delete_node(client, db_session, project, user_and_token):
    _, headers = user_and_token
    model_id = await _create_model(db_session)

    resp = await client.post(
        f"/api/projects/{project}/nodes",
        json={"model_id": model_id, "label": "ToDelete"},
        headers=headers,
    )
    assert resp.status_code == 200
    node_id = resp.json()["id"]

    resp = await client.delete(f"/api/projects/{project}/nodes/{node_id}", headers=headers)
    assert resp.status_code == 200


async def test_create_edge(client, db_session, project, user_and_token):
    _, headers = user_and_token
    model_id = await _create_model(db_session)

    resp = await client.post(
        f"/api/projects/{project}/nodes",
        json={"model_id": model_id, "label": "Source"},
        headers=headers,
    )
    source_id = resp.json()["id"]

    resp = await client.post(
        f"/api/projects/{project}/nodes",
        json={"model_id": model_id, "label": "Target"},
        headers=headers,
    )
    target_id = resp.json()["id"]

    resp = await client.post(
        f"/api/projects/{project}/edges",
        json={"source_node_id": source_id, "target_node_id": target_id},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source_node_id"] == source_id
    assert data["target_node_id"] == target_id


async def test_create_self_referencing_edge(client, db_session, project, user_and_token):
    _, headers = user_and_token
    model_id = await _create_model(db_session)

    resp = await client.post(
        f"/api/projects/{project}/nodes",
        json={"model_id": model_id, "label": "Self Ref"},
        headers=headers,
    )
    node_id = resp.json()["id"]

    resp = await client.post(
        f"/api/projects/{project}/edges",
        json={"source_node_id": node_id, "target_node_id": node_id},
        headers=headers,
    )
    assert resp.status_code == 400


async def test_create_duplicate_edge(client, db_session, project, user_and_token):
    _, headers = user_and_token
    model_id = await _create_model(db_session)

    resp = await client.post(
        f"/api/projects/{project}/nodes", json={"model_id": model_id}, headers=headers,
    )
    source_id = resp.json()["id"]

    resp = await client.post(
        f"/api/projects/{project}/nodes", json={"model_id": model_id}, headers=headers,
    )
    target_id = resp.json()["id"]

    resp = await client.post(
        f"/api/projects/{project}/edges",
        json={"source_node_id": source_id, "target_node_id": target_id},
        headers=headers,
    )
    assert resp.status_code == 200

    resp = await client.post(
        f"/api/projects/{project}/edges",
        json={"source_node_id": source_id, "target_node_id": target_id},
        headers=headers,
    )
    assert resp.status_code == 409


async def test_create_cycle_edge(client, db_session, project, user_and_token):
    _, headers = user_and_token
    model_id = await _create_model(db_session)

    async def make_node(label):
        resp = await client.post(
            f"/api/projects/{project}/nodes",
            json={"model_id": model_id, "label": label},
            headers=headers,
        )
        return resp.json()["id"]

    node_a = await make_node("A")
    node_b = await make_node("B")
    node_c = await make_node("C")

    # A -> B
    resp = await client.post(
        f"/api/projects/{project}/edges",
        json={"source_node_id": node_a, "target_node_id": node_b},
        headers=headers,
    )
    assert resp.status_code == 200

    # B -> C
    resp = await client.post(
        f"/api/projects/{project}/edges",
        json={"source_node_id": node_b, "target_node_id": node_c},
        headers=headers,
    )
    assert resp.status_code == 200

    # C -> A (would create cycle)
    resp = await client.post(
        f"/api/projects/{project}/edges",
        json={"source_node_id": node_c, "target_node_id": node_a},
        headers=headers,
    )
    assert resp.status_code == 400
