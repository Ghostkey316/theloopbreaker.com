"""Codex Overdrive V2 functional modules."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
LOG_DIR = BASE_DIR / "logs"
JOURNAL_DIR = BASE_DIR / "journals"
LOG_DIR.mkdir(exist_ok=True)
JOURNAL_DIR.mkdir(exist_ok=True)

DECISION_LOG_PATH = LOG_DIR / "user_decisions.json"
EMO_FEEDBACK_PATH = LOG_DIR / "emotional_feedback.json"
LEGACY_PATH = LOG_DIR / "legacy_history.json"


def _load_json(path: Path, default):
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


class MoralIntelligenceCoreV2:
    """Alignment checker tied to decision logs."""

    def review(self, user_id: str, text: str) -> bool:
        """Check ``text`` and log the decision result."""
        passed = "hype" not in text.lower()
        log = _load_json(DECISION_LOG_PATH, [])
        log.append({
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "user_id": user_id,
            "text": text,
            "passed": passed,
        })
        _write_json(DECISION_LOG_PATH, log)
        return passed


class LifeMirrorEngine:
    """Record life events for protocol chapters."""

    def record_event(self, user_id: str, summary: str, emotion: str | None = None) -> None:
        path = JOURNAL_DIR / f"life_mirror_{user_id}.json"
        data = _load_json(path, [])
        entry = {
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "summary": summary,
        }
        if emotion:
            entry["emotion"] = emotion
            emo = _load_json(EMO_FEEDBACK_PATH, [])
            emo.append({"user_id": user_id, **entry})
            _write_json(EMO_FEEDBACK_PATH, emo)
        data.append(entry)
        _write_json(path, data)

    def chapters(self, user_id: str) -> list:
        path = JOURNAL_DIR / f"life_mirror_{user_id}.json"
        return _load_json(path, [])


class AmbientXPSync:
    """Issue XP based on ambient actions."""

    SCORECARD_PATH = BASE_DIR / "user_scorecard.json"

    def sync(self, user_id: str, amount: int = 1) -> int:
        """Increment ``user_id`` XP by ``amount`` and return new total."""
        data = _load_json(self.SCORECARD_PATH, {})
        entry = data.setdefault(user_id, {})
        entry["xp"] = entry.get("xp", 0) + amount
        _write_json(self.SCORECARD_PATH, data)
        return entry["xp"]


class SocialAlchemySystem:
    """Reward community support actions."""

    KARMA_PATH = LOG_DIR / "karma_flow.json"

    def reward_support(self, user_id: str, points: int) -> None:
        data = _load_json(self.KARMA_PATH, {})
        data[user_id] = data.get(user_id, 0) + points
        _write_json(self.KARMA_PATH, data)


class LearningForgeMode:
    """Apply upgrades unlocked through quizzes."""

    UPGRADE_PATH = LOG_DIR / "learning_forge.json"

    def apply_upgrade(self, user_id: str, score: int) -> None:
        upgrades = _load_json(self.UPGRADE_PATH, {})
        level = upgrades.get(user_id, 0)
        if score >= 80:
            level += 1
        upgrades[user_id] = level
        _write_json(self.UPGRADE_PATH, upgrades)


class CodexSelfHealingLayer:
    """Detect and heal minor module issues."""

    def check_modules(self) -> bool:
        # Simplistic integrity check: ensure dashboard manifest exists
        manifest = BASE_DIR / "dashboards" / "protocol_status.json"
        if not manifest.exists():
            return False
        return True


class LegacyTracker:
    """Archive meaningful growth events."""

    def archive_session(self, user_id: str, note: str) -> None:
        data = _load_json(LEGACY_PATH, [])
        data.append({
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "user_id": user_id,
            "note": note,
        })
        _write_json(LEGACY_PATH, data)
