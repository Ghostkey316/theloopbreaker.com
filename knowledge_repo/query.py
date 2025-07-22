"""Utility functions to query natural treatment data."""
from __future__ import annotations

import json
from pathlib import Path
from typing import List, Dict

DATA_PATH = Path(__file__).resolve().parent / "data" / "treatments.json"


def load_data() -> List[Dict]:
    """Load treatment entries from the dataset."""
    with open(DATA_PATH) as f:
        return json.load(f)


def by_condition(condition: str) -> List[Dict]:
    """Return treatments matching a condition (case-insensitive)."""
    condition = condition.lower()
    entries = load_data()
    return [e for e in entries if e.get("condition", "").lower() == condition]


def by_ingredient(ingredient: str) -> List[Dict]:
    """Return treatments that use a given ingredient."""
    ingredient = ingredient.lower()
    entries = load_data()
    return [e for e in entries if ingredient in [i.lower() for i in e.get("ingredients", [])]]
