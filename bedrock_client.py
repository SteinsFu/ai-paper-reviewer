"""Thin wrapper around Bedrock's Converse API used by the reviewer modules."""

from __future__ import annotations

import os
from typing import Any

import boto3

HAIKU_4_5 = "au.anthropic.claude-haiku-4-5-20251001-v1:0"
SONNET_4_5 = "au.anthropic.claude-sonnet-4-5-20250929-v1:0"


def get_client(region: str | None = None):
    return boto3.client(
        "bedrock-runtime",
        region_name=region or os.getenv("AWS_REGION", "ap-southeast-2"),
    )


def converse_text(
    model_id: str,
    system_prompt: str,
    user_message: str,
    *,
    temperature: float = 0.3,
    max_tokens: int = 4096,
    client: Any = None,
) -> str:
    client = client or get_client()
    response = client.converse(
        modelId=model_id,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": user_message}]}],
        inferenceConfig={"temperature": temperature, "maxTokens": max_tokens},
    )
    return response["output"]["message"]["content"][0]["text"]


def converse_json(
    model_id: str,
    system_prompt: str,
    user_message: str,
    schema: dict[str, Any],
    *,
    tool_name: str = "return_result",
    tool_description: str = "Return the structured result.",
    temperature: float = 0.1,
    max_tokens: int = 4096,
    client: Any = None,
) -> dict[str, Any]:
    """Force JSON output by requiring the model to call a single tool with `schema`."""
    client = client or get_client()
    response = client.converse(
        modelId=model_id,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": user_message}]}],
        toolConfig={
            "tools": [
                {
                    "toolSpec": {
                        "name": tool_name,
                        "description": tool_description,
                        "inputSchema": {"json": schema},
                    }
                }
            ],
            "toolChoice": {"tool": {"name": tool_name}},
        },
        inferenceConfig={"temperature": temperature, "maxTokens": max_tokens},
    )
    for block in response["output"]["message"]["content"]:
        if "toolUse" in block:
            return block["toolUse"]["input"]
    raise RuntimeError("Bedrock response did not include a toolUse block.")
