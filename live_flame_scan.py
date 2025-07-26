import argparse
import json
import time
from pathlib import Path
from typing import Dict, List

from belief_trigger_engine import (
    activate_belief_reward,
    send_to_webhook,
)

try:
    from flask import Flask, jsonify, request
except Exception:  # pragma: no cover - Flask optional at runtime
    Flask = None  # type: ignore

DEFAULT_INPUT = Path("live_wallet_scores.json")
DEFAULT_LOG = Path("flame_log.json")


def _append(path: Path, entry: Dict) -> None:
    if path.exists():
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            data = []
    else:
        data = []
    data.append(entry)
    path.write_text(json.dumps(data, indent=2))


def process_scores(
    scores: Dict[str, int],
    log_path: Path = DEFAULT_LOG,
    webhook: str | None = None,
    chain: bool = False,
) -> List[Dict]:
    results: List[Dict] = []
    for wallet, score in scores.items():
        entry = activate_belief_reward(
            wallet,
            int(score),
            chain_log=chain,
            webhook=webhook,
        )
        results.append(entry)
        _append(log_path, entry)
    return results


def scan_loop(
    input_path: Path = DEFAULT_INPUT,
    log_path: Path = DEFAULT_LOG,
    iterations: int = 1,
    delay: float = 2.0,
    monitor: bool = False,
    webhook: str | None = None,
    chain: bool = False,
) -> None:
    count = 0
    while True:
        try:
            data = json.loads(input_path.read_text())
        except Exception:
            data = {}
        process_scores(data, log_path, webhook, chain)
        count += 1
        if not monitor and count >= iterations:
            break
        time.sleep(delay)


def create_app(log_path: Path = DEFAULT_LOG, webhook: str | None = None, chain: bool = False) -> "Flask":
    if not Flask:
        raise RuntimeError("Flask is not available")
    app = Flask(__name__)

    @app.route("/scan", methods=["GET", "POST"])
    def scan_endpoint():
        payload = request.get_json(silent=True) or {}
        if request.method == "GET":
            payload.update(request.args)
        scores = payload.get("scores", {})
        if isinstance(scores, str):
            try:
                scores = json.loads(scores)
            except Exception:
                scores = {}
        results = process_scores(scores, log_path, webhook, chain)
        return jsonify(results)

    @app.route("/activate", methods=["GET", "POST"])
    def activate_endpoint():
        payload = request.get_json(silent=True) or {}
        if request.method == "GET":
            payload.update(request.args)
        wallet = payload.get("wallet")
        score = int(payload.get("score", 0))
        result = activate_belief_reward(wallet, score, chain_log=chain, webhook=webhook)
        return jsonify(result)

    @app.route("/hook", methods=["POST"])
    def hook_endpoint():
        payload = request.get_json(silent=True) or {}
        wallet = payload.get("wallet")
        tier = payload.get("tier")
        score = payload.get("score")
        send_to_webhook(webhook, wallet, tier, int(score))
        return jsonify({"sent": bool(webhook)})

    return app


def main(argv: List[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Live flame scan")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    parser.add_argument("--iterations", type=int, default=1)
    parser.add_argument("--delay", type=float, default=2.0)
    parser.add_argument("--monitor", action="store_true")
    parser.add_argument("--webhook")
    parser.add_argument("--chain", action="store_true")
    parser.add_argument("--api", action="store_true", help="Run Flask API")
    args = parser.parse_args(argv)

    if args.api:
        app = create_app(args.log, args.webhook, args.chain)
        app.run()
    else:
        scan_loop(
            input_path=args.input,
            log_path=args.log,
            iterations=args.iterations,
            delay=args.delay,
            monitor=args.monitor,
            webhook=args.webhook,
            chain=args.chain,
        )


if __name__ == "__main__":
    main()
