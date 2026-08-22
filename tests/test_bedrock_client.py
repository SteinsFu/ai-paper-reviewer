"""Tests for the thin Bedrock Converse-API wrappers."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

import bedrock_client


def _text_response(text: str) -> dict:
    return {"output": {"message": {"content": [{"text": text}]}}}


def _tool_response(payload: dict) -> dict:
    return {
        "output": {
            "message": {
                "content": [{"toolUse": {"name": "return_result", "input": payload}}]
            }
        }
    }


def test_converse_text_returns_content_text_and_forwards_params():
    client = MagicMock()
    client.converse.return_value = _text_response("hello there")

    out = bedrock_client.converse_text(
        model_id="model-x",
        system_prompt="be helpful",
        user_message="hi",
        temperature=0.7,
        max_tokens=128,
        client=client,
    )

    assert out == "hello there"
    kwargs = client.converse.call_args.kwargs
    assert kwargs["modelId"] == "model-x"
    assert kwargs["system"] == [{"text": "be helpful"}]
    assert kwargs["messages"] == [{"role": "user", "content": [{"text": "hi"}]}]
    assert kwargs["inferenceConfig"] == {"temperature": 0.7, "maxTokens": 128}


def test_converse_json_extracts_tool_input_and_wires_schema():
    client = MagicMock()
    client.converse.return_value = _tool_response({"ok": True, "n": 3})
    schema = {"type": "object", "properties": {"ok": {"type": "boolean"}}}

    out = bedrock_client.converse_json(
        model_id="model-x",
        system_prompt="return json",
        user_message="do it",
        schema=schema,
        tool_name="do_thing",
        tool_description="Do a thing.",
        client=client,
    )

    assert out == {"ok": True, "n": 3}
    tool_config = client.converse.call_args.kwargs["toolConfig"]
    tool_spec = tool_config["tools"][0]["toolSpec"]
    assert tool_spec["name"] == "do_thing"
    assert tool_spec["description"] == "Do a thing."
    assert tool_spec["inputSchema"] == {"json": schema}
    assert tool_config["toolChoice"] == {"tool": {"name": "do_thing"}}


def test_converse_json_raises_when_no_tool_use_block():
    client = MagicMock()
    client.converse.return_value = {
        "output": {"message": {"content": [{"text": "sorry, cannot comply"}]}}
    }

    with pytest.raises(RuntimeError, match="toolUse"):
        bedrock_client.converse_json(
            model_id="model-x",
            system_prompt="",
            user_message="",
            schema={"type": "object"},
            client=client,
        )


def test_get_client_skips_login_provider_when_bearer_token_set(monkeypatch):
    monkeypatch.setenv("AWS_BEARER_TOKEN_BEDROCK", "ABSKTEST")
    monkeypatch.setenv("AWS_REGION", "ap-southeast-2")
    captured: dict = {}

    def fake_client(service_name, **kwargs):
        captured["service_name"] = service_name
        captured["kwargs"] = kwargs
        return MagicMock()

    monkeypatch.setattr(bedrock_client.boto3, "client", fake_client)
    bedrock_client.get_client()

    assert captured["service_name"] == "bedrock-runtime"
    assert captured["kwargs"]["region_name"] == "ap-southeast-2"
    assert captured["kwargs"]["aws_access_key_id"] == "bedrock-api-key"
    assert captured["kwargs"]["aws_secret_access_key"] == "bedrock-api-key"


def test_haiku_and_sonnet_ids_are_ap_southeast_inference_profiles():
    assert bedrock_client.HAIKU_4_5.startswith("au.anthropic.claude-haiku-4-5-")
    assert bedrock_client.SONNET_4_5.startswith("au.anthropic.claude-sonnet-4-5-")
