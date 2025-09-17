import argparse
import hashlib
import json
from pathlib import Path

from engine import storage
from engine.identity_resolver import resolve_identity
from engine.loyalty_engine import update_loyalty_ranks

BASE_DIR = Path(__file__).resolve().parent
ETHICS_PATH = BASE_DIR / "ethics" / "core.mdx"
CONFIG_PATH = BASE_DIR / "vaultfire-core" / "vaultfire_config.json"
SNAPSHOT_PATH = BASE_DIR / "dashboards" / "contributor_snapshot.json"
BINDINGS_PATH = BASE_DIR / "dashboards" / "contributor_bindings.json"
USER_LIST_PATH = BASE_DIR / "user_list.json"
SCORECARD_PATH = BASE_DIR / "user_scorecard.json"
PARTNERS_PATH = BASE_DIR / "partners.json"

ALIGNMENT_PHRASE = "Morals Before Metrics."


def _load_json(path: Path, default):
    return storage.load_data(path, default)


def _alignment_signature() -> str:
    normalized = ALIGNMENT_PHRASE.strip().lower().encode("utf-8")
    return hashlib.sha256(normalized).hexdigest()


def check_ethics() -> list[str]:
    errors = []
    if not ETHICS_PATH.exists() or ETHICS_PATH.stat().st_size == 0:
        errors.append("ethics core file missing or empty")
    cfg = _load_json(CONFIG_PATH, {})
    if not cfg.get("ethics_anchor", False):
        errors.append("ethics_anchor disabled in config")
    return errors


def check_loyalty_engine() -> list[str]:
    errors = []
    scorecard = _load_json(SCORECARD_PATH, None)
    if scorecard is None:
        errors.append("user_scorecard.json missing or invalid")
        return errors
    if not isinstance(scorecard, dict) or len(scorecard) < 5:
        errors.append("scorecard coverage below minimum partner readiness threshold")
    for user, entry in scorecard.items() if isinstance(scorecard, dict) else []:
        missing = [field for field in ("contributor_score", "contributor_tag", "wallet")
                   if field not in entry]
        if missing:
            errors.append(f"{user} missing fields: {', '.join(missing)}")
        loyalty = entry.get("loyalty")
        if loyalty is None or not isinstance(loyalty, (int, float)):
            errors.append(f"{user} loyalty metric missing or invalid")
    try:
        update_loyalty_ranks()
    except Exception as e:
        errors.append(f"loyalty_engine failure: {e}")
    return errors


def check_snapshot() -> list[str]:
    errors = []
    data = _load_json(SNAPSHOT_PATH, None)
    if data is None:
        errors.append("contributor snapshot missing or invalid")
    return errors


def check_contributor_bindings() -> list[str]:
    errors = []
    user_ids = _load_json(USER_LIST_PATH, None)
    if user_ids is None:
        errors.append("user_list.json missing or invalid")
        user_ids = []
    bindings = _load_json(BINDINGS_PATH, {})
    for user in user_ids:
        entry = bindings.get(user)
        if not entry:
            errors.append(f"no binding for user {user}")
            continue
        wallet = entry.get("wallet")
        if not wallet:
            errors.append(f"wallet missing for {user}")
            continue
        resolved = entry.get("resolved_wallet")
        expected = resolve_identity(wallet) or wallet
        if resolved != expected:
            errors.append(f"resolved wallet mismatch for {user}")
        if "contributor_xp" not in entry:
            errors.append(f"xp missing for {user}")
        if "loyalty_multiplier" not in entry:
            errors.append(f"multiplier missing for {user}")
    return errors


def check_partner_registry() -> list[str]:
    errors: list[str] = []
    partners = _load_json(PARTNERS_PATH, [])
    if not isinstance(partners, list) or len(partners) < 3:
        errors.append("partner registry missing production-scale entries")
        return errors
    seen: set[str] = set()
    expected_signature = _alignment_signature()
    for partner in partners:
        partner_id = partner.get("partner_id")
        if not partner_id:
            errors.append("partner entry missing partner_id")
            continue
        if partner_id in seen:
            errors.append(f"duplicate partner_id detected: {partner_id}")
        seen.add(partner_id)
        signature = partner.get("alignment_signature")
        if signature != expected_signature:
            errors.append(f"alignment signature mismatch for {partner_id}")
        resolved = partner.get("resolved_wallet")
        if not resolved:
            errors.append(f"resolved_wallet missing for {partner_id}")
    return errors


def run_integrity_check() -> dict:
    return {
        "ethics": check_ethics(),
        "loyalty_engine": check_loyalty_engine(),
        "snapshot": check_snapshot(),
        "contributor_bindings": check_contributor_bindings(),
        "partner_registry": check_partner_registry(),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run system integrity checks")
    parser.add_argument("--activation-hook", action="store_true",
                        help="invoke universal activation hook")
    parser.add_argument("--partner-id")
    parser.add_argument("--wallet", action="append", dest="wallets",
                        help="wallet identifier, may be repeated")
    parser.add_argument("--phrase", default=ALIGNMENT_PHRASE,
                        help="alignment phrase")
    parser.add_argument("--silent", action="store_true",
                        help="suppress console output")
    parser.add_argument("--test-mode", action="store_true",
                        help="do not persist changes")
    args = parser.parse_args(argv)

    if args.activation_hook:
        if not args.partner_id or not args.wallets:
            parser.error("--activation-hook requires --partner-id and --wallet")
        import importlib
        spa = importlib.import_module("simulate_partner_activation")
        result = spa.activation_hook(
            args.partner_id or "",
            args.wallets or [],
            args.phrase,
            silent=True,
            test_mode=args.test_mode,
        )
        if not args.silent:
            print(json.dumps(result, indent=2))
        return 0 if result["status"] == "PASS" else 1

    result = run_integrity_check()
    print(json.dumps(result, indent=2))
    issues = [msg for msgs in result.values() for msg in msgs]
    if issues:
        if not args.silent:
            print("Integrity check issues detected:")
            for category, msgs in result.items():
                for msg in msgs:
                    print(f"- {category}: {msg}")
        return 1
    else:
        if not args.silent:
            print("All systems operational")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
