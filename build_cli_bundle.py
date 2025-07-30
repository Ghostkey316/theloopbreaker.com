import argparse
import json
import zipfile
from pathlib import Path
import logging

from activate_global_kernel import activate as activate_kernel
from activate_live_training import activate as activate_live

logger = logging.getLogger(__name__)

# optional import - file may not exist
def log_proof(proof_path: str) -> None:
    try:
        module = __import__(proof_path.replace('.py', '').replace('/', '.'))
        if hasattr(module, 'confirm'):
            module.confirm()
    except Exception:
        logger.exception("Failed to log proof module %s", proof_path)

def build_cli_bundle(output: Path, modules: list[str]) -> None:
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zf:
        # always include main CLI
        zf.write('vaultfire_cli.py')
        for mod in modules:
            if mod == 'live_training':
                zf.write('activate_live_training.py')
            elif mod == 'belief_engine':
                for path in ['engine/belief_graph.py', 'engine/belief_validation.py']:
                    if Path(path).exists():
                        zf.write(path)
            elif mod == 'immutable_log':
                zf.write('engine/immutable_log.py')


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description='Build Vaultfire CLI bundle')
    parser.add_argument('--identity', default='Ghostkey-316', help='Identity tag')
    parser.add_argument('--output', default='cli_bundle.zip', help='Output zip file')
    parser.add_argument('--include', default='', help='Comma separated modules')
    parser.add_argument('--proof', default='vaultfire-proof.codex', help='Proof module')
    args = parser.parse_args(argv)

    modules = [m.strip() for m in args.include.split(',') if m.strip()]

    state = activate_kernel(args.identity)
    if 'live_training' in modules:
        activate_live()

    log_proof(args.proof)

    build_cli_bundle(Path(args.output), modules)

    print(json.dumps({'bundle': args.output, 'kernel_state': state, 'modules': modules}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
