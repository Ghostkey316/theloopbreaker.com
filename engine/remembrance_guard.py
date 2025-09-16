"""Vaultfire Fourth Law of Expansion: remembrance guard."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, MutableMapping, Optional, Sequence, Set

from .alignment_guard import evaluate_alignment

LAW_TITLE = "The Forgotten Flame: Those who lit the path shall not be left in the dark."


def _normalize(text: Optional[str]) -> str:
    if not text:
        return ""
    return " ".join(str(text).strip().lower().split())


def _resolve_contributor(record: MutableMapping[str, Any]) -> Optional[str]:
    for key in ("contributor", "user", "identity", "owner", "participant"):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _is_overlooked(record: MutableMapping[str, Any]) -> bool:
    if record.get("credited") is False:
        return True
    status = str(record.get("status", "")).lower()
    if status in {"overlooked", "pending-credit", "awaiting-attribution"}:
        return True
    for key in ("flags", "tags", "labels"):
        value = record.get(key)
        if isinstance(value, (list, tuple, set)):
            lowered = {str(item).lower() for item in value if item}
            if lowered & {"overlooked", "missing-credit", "ghost-overlooked"}:
                return True
    return False


@dataclass
class OverlookedContributor:
    """Internal structure capturing overlooked contribution context."""

    contributor: str
    insights: Set[str] = field(default_factory=set)
    sources: Set[str] = field(default_factory=set)
    tags: Set[str] = field(default_factory=set)
    sacrifice: float = 0.0
    early_support: bool = False
    ghost_tagged: bool = False
    entries: List[Dict[str, Any]] = field(default_factory=list)

    def update_from_record(self, record: MutableMapping[str, Any], source: str) -> None:
        self.sources.add(source)
        insight = _normalize(record.get("insight") or record.get("pattern") or record.get("text"))
        if insight:
            self.insights.add(insight)
        tags_value = record.get("tags") or record.get("labels")
        if isinstance(tags_value, (list, tuple, set)):
            for tag in tags_value:
                if tag:
                    self.tags.add(str(tag).lower())
        if record.get("tag"):
            self.tags.add(str(record["tag"]).lower())
        sacrifice = record.get("sacrifice_level", record.get("sacrifice"))
        if isinstance(sacrifice, (int, float)):
            self.sacrifice = max(self.sacrifice, float(sacrifice))
        if any(record.get(flag) for flag in ("early_support", "early_signal", "founding", "origin")):
            self.early_support = True
        if record.get("ghost_tagged") or record.get("ghost_tag"):
            self.ghost_tagged = True
        self.entries.append(deepcopy(dict(record)))

    def as_payload(self, goal_tags: Set[str]) -> Dict[str, Any]:
        tag_set = set(self.tags)
        aligned = sorted(goal_tags & tag_set) if goal_tags else []
        return {
            "contributor": self.contributor,
            "insights": sorted(self.insights),
            "sources": sorted(self.sources),
            "tags": sorted(tag_set),
            "sacrifice": round(self.sacrifice, 4),
            "early_support": self.early_support,
            "ghost_tagged": self.ghost_tagged,
            "goal_alignment": aligned,
            "entry_count": len(self.entries),
        }


class RemembranceGuard:
    """Implements Vaultfire's Fourth Law of Expansion."""

    def __init__(
        self,
        belief_logs: Sequence[MutableMapping[str, Any]],
        memory_chains: Sequence[MutableMapping[str, Any]],
        *,
        consensus_threshold: float = 0.66,
    ) -> None:
        self.consensus_threshold = consensus_threshold
        self.belief_logs: List[Dict[str, Any]] = [deepcopy(dict(item)) for item in belief_logs if isinstance(item, MutableMapping)]
        self.memory_chains: List[Dict[str, Any]] = [deepcopy(dict(chain)) for chain in memory_chains if isinstance(chain, MutableMapping)]
        self._belief_index: Dict[str, List[Dict[str, Any]]] = {}
        self._memory_index: Dict[str, List[Dict[str, Any]]] = {}
        self._memory_by_id: Dict[str, Dict[str, Any]] = {}
        self._mirror_archive: Dict[str, Dict[str, Any]] = {}
        self.remembrance_triggers: List[Dict[str, Any]] = []
        self.pending_yield_signals: List[Dict[str, Any]] = []
        self.last_manifest: List[Dict[str, Any]] = []
        self.last_checkpoint: Optional[Dict[str, Any]] = None
        self.last_memory_lock: Optional[Dict[str, Any]] = None
        self.loyalty_registry: Dict[str, Dict[str, Any]] = {}
        self._build_indexes()

    def _build_indexes(self) -> None:
        for record in self.belief_logs:
            key = _normalize(record.get("insight") or record.get("pattern") or record.get("text"))
            if key:
                self._belief_index.setdefault(key, []).append(record)
        for chain in self.memory_chains:
            entries = chain.get("entries")
            if not isinstance(entries, Sequence):
                continue
            chain_id = chain.get("chain_id") or chain.get("id") or "chain"
            for index, raw_entry in enumerate(entries):
                if not isinstance(raw_entry, MutableMapping):
                    continue
                entry = deepcopy(dict(raw_entry))
                entry_id = str(entry.get("id") or f"{chain_id}:{index}")
                entry["id"] = entry_id
                entry.setdefault("chain_id", chain_id)
                self._memory_by_id[entry_id] = entry
                key = _normalize(entry.get("insight") or entry.get("pattern") or entry.get("text"))
                if key:
                    self._memory_index.setdefault(key, []).append(entry)

    def detect_forgotten_contributions(
        self,
        expansion_batch: Sequence[MutableMapping[str, Any]],
    ) -> List[Dict[str, Any]]:
        triggers: List[Dict[str, Any]] = []
        for expansion in expansion_batch:
            if not isinstance(expansion, MutableMapping):
                continue
            pattern_key = _normalize(
                expansion.get("pattern")
                or expansion.get("insight")
                or expansion.get("text")
            )
            if not pattern_key:
                continue
            goal_tags = set()
            for key in ("goals", "tags", "labels"):
                values = expansion.get(key)
                if isinstance(values, (list, tuple, set)):
                    goal_tags.update(str(value).lower() for value in values if value)
            contributors: Dict[str, OverlookedContributor] = {}
            for record in self._belief_index.get(pattern_key, []):
                if not isinstance(record, MutableMapping) or not _is_overlooked(record):
                    continue
                contributor = _resolve_contributor(record)
                if not contributor:
                    continue
                bucket = contributors.setdefault(contributor, OverlookedContributor(contributor))
                bucket.update_from_record(record, "belief")
            for record in self._memory_index.get(pattern_key, []):
                if not isinstance(record, MutableMapping):
                    continue
                if not record.get("ghost_tagged"):
                    continue
                if not _is_overlooked(record):
                    continue
                contributor = _resolve_contributor(record)
                if not contributor:
                    continue
                bucket = contributors.setdefault(contributor, OverlookedContributor(contributor))
                bucket.update_from_record(record, "memory")
            if contributors:
                trigger = {
                    "label": LAW_TITLE,
                    "expansion_id": expansion.get("id"),
                    "pattern": pattern_key,
                    "contributors": [bucket.as_payload(goal_tags) for bucket in contributors.values()],
                    "goal_tags": sorted(goal_tags),
                }
                triggers.append(trigger)
        self.remembrance_triggers = triggers
        return triggers

    def route_loyalty_signals(
        self,
        triggers: Optional[Sequence[MutableMapping[str, Any]]] = None,
        *,
        base_multiplier: float = 1.0,
    ) -> List[Dict[str, Any]]:
        source_triggers: Sequence[MutableMapping[str, Any]] = triggers or self.remembrance_triggers
        signals: List[Dict[str, Any]] = []
        for trigger in source_triggers:
            if not isinstance(trigger, MutableMapping):
                continue
            pattern = trigger.get("pattern")
            for contributor in trigger.get("contributors", []):
                if not isinstance(contributor, MutableMapping):
                    continue
                contributor_id = contributor.get("contributor")
                if not contributor_id:
                    continue
                sacrifice = contributor.get("sacrifice") or 0.0
                if not isinstance(sacrifice, (int, float)):
                    sacrifice = 0.0
                early_bonus = 0.15 if contributor.get("early_support") else 0.0
                alignment = contributor.get("goal_alignment")
                alignment_bonus = 0.0
                if isinstance(alignment, (list, tuple, set)):
                    alignment_bonus = 0.05 * len(list(alignment))
                multiplier = base_multiplier + 0.1 * float(sacrifice) + early_bonus + alignment_bonus
                multiplier = max(base_multiplier, min(2.5, multiplier))
                payload = {
                    "contributor": contributor_id,
                    "multiplier": round(multiplier, 4),
                    "activation": "delayed",
                    "pattern": pattern,
                    "sources": list(contributor.get("sources", [])),
                }
                self.loyalty_registry[contributor_id] = {
                    "multiplier": payload["multiplier"],
                    "pending": True,
                    "pattern": pattern,
                    "law": LAW_TITLE,
                }
                signals.append(payload)
        self.pending_yield_signals.extend(deepcopy(signals))
        return signals

    def enforce_memory_preservation(
        self,
        requests: Sequence[MutableMapping[str, Any]],
        consensus_weight: Optional[float] = None,
    ) -> Dict[str, List[Dict[str, Any]]]:
        locked: List[Dict[str, Any]] = []
        allowed: List[Dict[str, Any]] = []
        for request in requests:
            if not isinstance(request, MutableMapping):
                continue
            memory_id = request.get("memory_id") or request.get("id")
            if not memory_id:
                continue
            memory_id = str(memory_id)
            entry = self._memory_by_id.get(memory_id)
            if not entry:
                continue
            weight = request.get("consensus_weight")
            if weight is None:
                weight = consensus_weight if consensus_weight is not None else 0.0
            try:
                provided = float(weight)
            except (TypeError, ValueError):
                provided = 0.0
            required = float(entry.get("consensus_required", self.consensus_threshold))
            tags = entry.get("tags")
            tag_set = {str(tag).lower() for tag in tags} if isinstance(tags, (list, tuple, set)) else set()
            is_key = bool(entry.get("key_breakthrough")) or ("breakthrough" in tag_set)
            action = request.get("action", "inspect")
            insight_text = entry.get("insight") or entry.get("pattern") or entry.get("text")

            guard_payload = {
                "memory_id": memory_id,
                "mission": insight_text,
                "mission_tags": sorted(tag_set),
                "action": action,
                "consensus_weight": provided,
                "required_consensus": required,
                "empathy_score": request.get("empathy_score"),
                "intent": request.get("intent"),
            }
            identity = request.get("identity")
            guard_identity = identity if isinstance(identity, Mapping) else None
            guard_result = evaluate_alignment(
                f"memory.{action}",
                guard_payload,
                identity=guard_identity,
                override_requested=bool(request.get("override")),
            )
            guard_summary = {
                "decision": guard_result["decision"],
                "reasons": guard_result["reasons"],
                "override": guard_result["override"],
                "drift": guard_result["drift"],
            }

            if not guard_result["allowed"]:
                lock_info = {
                    "memory_id": memory_id,
                    "required_consensus": required,
                    "provided_consensus": provided,
                    "action": action,
                    "insight": insight_text,
                    "reason": guard_result["reasons"][0]
                    if guard_result["reasons"]
                    else guard_result["decision"],
                    "alignment_guard": guard_summary,
                }
                locked.append(lock_info)
                self._mirror_archive[memory_id] = deepcopy(entry)
                continue
            if is_key and provided < required and action in {"delete", "override"}:
                lock_info = {
                    "memory_id": memory_id,
                    "required_consensus": required,
                    "provided_consensus": provided,
                    "action": action,
                    "insight": entry.get("insight") or entry.get("pattern") or entry.get("text"),
                    "reason": "consensus_not_met",
                    "alignment_guard": guard_summary,
                }
                locked.append(lock_info)
                self._mirror_archive[memory_id] = deepcopy(entry)
                continue
            if action in {"delete", "override"}:
                self._mirror_archive[memory_id] = deepcopy(entry)
                if action == "delete":
                    self._memory_by_id.pop(memory_id, None)
                elif action == "override" and request.get("replacement"):
                    replacement = deepcopy(dict(request["replacement"]))
                    replacement.setdefault("id", memory_id)
                    replacement.setdefault("chain_id", entry.get("chain_id"))
                    self._memory_by_id[memory_id] = replacement
            allowed.append(
                {
                    "memory_id": memory_id,
                    "action": action,
                    "consensus": provided,
                    "insight": insight_text,
                    "alignment_guard": guard_summary,
                }
            )
        report = {
            "locked": locked,
            "allowed": allowed,
            "mirrored": [deepcopy(entry) for entry in self._mirror_archive.values()],
        }
        self.last_memory_lock = report
        return report

    def restore_memories(
        self,
        memory_ids: Optional[Sequence[str]] = None,
        *,
        identity: Optional[Mapping[str, Any]] = None,
        override: bool = False,
    ) -> List[Dict[str, Any]]:
        if memory_ids is None:
            targets = list(self._mirror_archive.keys())
        else:
            targets = [str(item) for item in memory_ids]
        restored: List[Dict[str, Any]] = []
        for memory_id in targets:
            entry = self._mirror_archive.get(memory_id)
            if entry:
                restored_entry = deepcopy(entry)
                guard_payload = {
                    "memory_id": memory_id,
                    "mission": restored_entry.get("insight")
                    or restored_entry.get("pattern")
                    or restored_entry.get("text"),
                    "mission_tags": restored_entry.get("tags", []),
                    "action": "restore",
                }
                guard_result = evaluate_alignment(
                    "memory.restore",
                    guard_payload,
                    identity=identity,
                    override_requested=override,
                )
                if not guard_result["allowed"]:
                    continue
                restored_entry["alignment_guard"] = {
                    "decision": guard_result["decision"],
                    "reasons": guard_result["reasons"],
                    "override": guard_result["override"],
                    "drift": guard_result["drift"],
                }
                self._memory_by_id[memory_id] = restored_entry
                restored.append(restored_entry)
        return restored

    def generate_remembrance_manifest(
        self,
        iterations: Sequence[MutableMapping[str, Any]],
    ) -> List[Dict[str, Any]]:
        manifest: List[Dict[str, Any]] = []
        for iteration in iterations:
            if not isinstance(iteration, MutableMapping):
                continue
            iteration_id = iteration.get("version") or iteration.get("id") or iteration.get("label")
            entries = iteration.get("beliefs") or iteration.get("entries") or iteration.get("logs")
            if not isinstance(entries, Sequence):
                continue
            for entry in entries:
                if not isinstance(entry, MutableMapping):
                    continue
                tags = entry.get("tags") or entry.get("labels")
                if not isinstance(tags, (list, tuple, set)):
                    continue
                normalized_tags = sorted({str(tag).lower() for tag in tags if tag})
                if not normalized_tags:
                    continue
                if entry.get("rewarded") or entry.get("credited"):
                    continue
                manifest.append(
                    {
                        "iteration": iteration_id,
                        "contributor": entry.get("contributor") or entry.get("user") or entry.get("identity"),
                        "insight": entry.get("insight") or entry.get("pattern") or entry.get("text"),
                        "tags": normalized_tags,
                    }
                )
        self.last_manifest = manifest
        return manifest

    def run_expansion_checkpoint(
        self,
        iterations: Sequence[MutableMapping[str, Any]],
        expansion_batch: Optional[Sequence[MutableMapping[str, Any]]] = None,
    ) -> Dict[str, Any]:
        manifest = self.generate_remembrance_manifest(iterations)
        triggers = self.detect_forgotten_contributions(expansion_batch or [])
        checkpoint = {
            "law": LAW_TITLE,
            "manifest": manifest,
            "triggers": triggers,
            "status": "remembrance-checkpoint-complete",
        }
        self.last_checkpoint = checkpoint
        return checkpoint


__all__ = ["LAW_TITLE", "RemembranceGuard"]
