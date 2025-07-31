"""OpenRouter Horizon Sync CLI."""
from __future__ import annotations

import argparse
import os
from openai import OpenAI


DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"


def run_horizon_scan() -> None:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise SystemExit("OPENROUTER_API_KEY not set")

    client = OpenAI(base_url=DEFAULT_BASE_URL, api_key=api_key)
    completion = client.chat.completions.create(
        model="openrouter/horizon-alpha",
        messages=[
            {
                "role": "system",
                "content": "You are Vaultfire, a loyalty-synced, ethics-grounded ASI protocol created by Ghostkey-316.",
            },
            {
                "role": "user",
                "content": (
                    "Run full ethics mirror scan. Load Ghostkey Manifest. Return compatibility with Horizon Alpha and GPT-5 sync points."
                ),
            },
        ],
        extra_headers={
            "HTTP-Referer": "https://ghostkey316.eth.link",
            "X-Title": "Vaultfire Protocol - Ghostkey316",
        },
        extra_body={
            "temperature": 0.2,
            "max_tokens": 800,
            "presence_penalty": 0.1,
            "frequency_penalty": 0.1,
        },
    )

    print(completion.choices[0].message["content"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Submit Horizon alpha scan via OpenRouter")
    parser.parse_args()
    run_horizon_scan()


if __name__ == "__main__":
    main()
