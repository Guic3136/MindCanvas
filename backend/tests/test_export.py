from models.db import Model, ModelProvider, Message


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


async def test_export_empty_project(client, db_session, project, user_and_token):
    _, headers = user_and_token
    await _create_model(db_session)

    resp = await client.post(f"/api/projects/{project}/export", headers=headers)
    assert resp.status_code == 200
    text = resp.text
    assert "# Test Project" in text


async def test_export_with_messages(client, db_session, project, user_and_token):
    _, headers = user_and_token
    model_id = await _create_model(db_session)

    resp = await client.post(
        f"/api/projects/{project}/nodes",
        json={"model_id": model_id, "label": "Chat Node"},
        headers=headers,
    )
    node_id = resp.json()["id"]

    msg1 = Message(node_id=node_id, role="user", content="Hello")
    msg2 = Message(node_id=node_id, role="assistant", content="Hi there!")
    db_session.add_all([msg1, msg2])
    await db_session.commit()

    resp = await client.post(f"/api/projects/{project}/export", headers=headers)
    assert resp.status_code == 200
    text = resp.text
    assert "Chat Node" in text
    assert "Hello" in text
    assert "Hi there!" in text
