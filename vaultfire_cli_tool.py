import argparse
import hashlib
import json
import logging
import urllib.request
from importlib import import_module
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROTOCOL_DIR = BASE_DIR / "belief_protocols"
PLUGIN_DIR = BASE_DIR / "vaultfire_cli_plugins"

logger = logging.getLogger(__name__)


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


# ---------------------------------------------------------------------------
# Command implementations
# ---------------------------------------------------------------------------

def cmd_init(args: argparse.Namespace) -> None:
    """Initialize a new belief protocol."""
    path = PROTOCOL_DIR / f"{args.name}.json"
    if path.exists() and not args.force:
        print(f"protocol already exists: {args.name}")
        return
    data = {"name": args.name, "traits": [], "ethics": [], "loyalty": [], "contributors": {}}
    _write_json(path, data)
    print(f"initialized protocol {args.name}")


def cmd_add(args: argparse.Namespace) -> None:
    """Add traits, ethics, or loyalty tags."""
    path = PROTOCOL_DIR / f"{args.name}.json"
    data = _load_json(path, None)
    if data is None:
        print(f"protocol not found: {args.name}")
        return
    if args.trait:
        for t in args.trait:
            if t not in data.get("traits", []):
                data.setdefault("traits", []).append(t)
    if args.ethic:
        for e in args.ethic:
            if e not in data.get("ethics", []):
                data.setdefault("ethics", []).append(e)
    if args.loyalty:
        for l in args.loyalty:
            if l not in data.get("loyalty", []):
                data.setdefault("loyalty", []).append(l)
    _write_json(path, data)
    print(f"updated {args.name}")


def cmd_gen_id(args: argparse.Namespace) -> None:
    """Generate contributor ID linked to ENS."""
    path = PROTOCOL_DIR / f"{args.name}.json"
    data = _load_json(path, None)
    if data is None:
        print(f"protocol not found: {args.name}")
        return
    from engine.identity_resolver import resolve_identity
    wallet = resolve_identity(args.ens) or "unknown"
    cid = hashlib.sha256(args.ens.encode()).hexdigest()[:10]
    contributors = data.setdefault("contributors", {})
    contributors[cid] = {"ens": args.ens, "wallet": wallet}
    _write_json(path, data)
    print(cid)


def cmd_export(args: argparse.Namespace) -> None:
    """Export manifesto in JSON or markdown format."""
    path = PROTOCOL_DIR / f"{args.name}.json"
    data = _load_json(path, None)
    if data is None:
        print(f"protocol not found: {args.name}")
        return
    if args.format == "json":
        text = json.dumps(data, indent=2)
    else:
        lines = [f"# {data.get('name')}\n"]
        if data.get("traits"):
            lines.append("## Personality Traits")
            for t in data["traits"]:
                lines.append(f"- {t}")
            lines.append("")
        if data.get("ethics"):
            lines.append("## Ethics")
            for e in data["ethics"]:
                lines.append(f"- {e}")
            lines.append("")
        if data.get("loyalty"):
            lines.append("## Loyalty Tags")
            for l in data["loyalty"]:
                lines.append(f"- {l}")
            lines.append("")
        text = "\n".join(lines)
    if args.output:
        Path(args.output).write_text(text)
        print(f"exported manifesto to {args.output}")
    else:
        print(text)


def cmd_push(args: argparse.Namespace) -> None:
    """Push protocol data to remote registry."""
    path = PROTOCOL_DIR / f"{args.name}.json"
    data = _load_json(path, None)
    if data is None:
        print(f"protocol not found: {args.name}")
        return
    req = urllib.request.Request(
        args.url,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        resp_text = resp.read().decode().strip()
        print(resp_text or "pushed")


# ---------------------------------------------------------------------------
# Plugin loader
# ---------------------------------------------------------------------------

def load_plugins(subparsers: argparse._SubParsersAction) -> None:
    if PLUGIN_DIR.exists():
        for path in PLUGIN_DIR.glob("*.py"):
            mod_name = f"vaultfire_cli_plugins.{path.stem}"
            try:
                module = import_module(mod_name)
                if hasattr(module, "register"):
                    module.register(subparsers)
            except Exception:
                logger.exception("Failed to load plugin %s", mod_name)
                continue


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="vaultfire-cli", description="Belief protocol manager")
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="Initialize belief protocol")
    p_init.add_argument("name", help="Protocol name")
    p_init.add_argument("--force", action="store_true", help="Overwrite if exists")
    p_init.set_defaults(func=cmd_init)

    p_add = sub.add_parser("add", help="Add traits or ethics")
    p_add.add_argument("name", help="Protocol name")
    p_add.add_argument("--trait", action="append")
    p_add.add_argument("--ethic", action="append")
    p_add.add_argument("--loyalty", action="append")
    p_add.set_defaults(func=cmd_add)

    p_id = sub.add_parser("gen-id", help="Generate contributor id")
    p_id.add_argument("name", help="Protocol name")
    p_id.add_argument("ens", help="Contributor ENS")
    p_id.set_defaults(func=cmd_gen_id)

    p_exp = sub.add_parser("export", help="Export manifesto")
    p_exp.add_argument("name", help="Protocol name")
    p_exp.add_argument("--format", choices=["json", "markdown"], default="json")
    p_exp.add_argument("--output")
    p_exp.set_defaults(func=cmd_export)

    p_push = sub.add_parser("push", help="Push updates to registry")
    p_push.add_argument("name", help="Protocol name")
    p_push.add_argument("url", help="Registry endpoint")
    p_push.set_defaults(func=cmd_push)

    load_plugins(sub)

    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
