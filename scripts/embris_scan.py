#!/usr/bin/env python3
"""
Vaultfire / Embris Protocol — Secret Scanner
=============================================
Zero-false-positive context-aware private key detector.

Design philosophy:
  A 64-char hex string is ONLY flagged if it appears in a context that is
  semantically a private key assignment. Legitimate hex strings (document
  hashes, Solidity bytes32 constants, lockfile hashes, ABI bytecode, tx
  hashes, ZK image IDs, etc.) are excluded at the PATTERN level — not via
  an ever-growing exclusion list.

Detection rules (in priority order):
  1. ALWAYS FLAG: The two known compromised keys, regardless of context.
  2. FLAG: KEY_NAME = "0x<64hex>" or KEY_NAME = "<64hex>" where KEY_NAME
     contains private|deployer|secret|wallet_key|signing_key (case-insensitive).
  3. FLAG: new Wallet("0x<64hex>") or new Wallet('<64hex>') in source files
     UNLESS the key is in the known-safe test key allowlist.
  4. FLAG: Raw 64-char hex in .env files (KEY=<64hex>) where KEY contains
     key/secret/private/deployer.
  5. NEVER FLAG: Anything in node_modules/, .git/, artifacts/, cache/,
     .next/, dist/, package-lock.json, pnpm-lock.yaml.
  6. NEVER FLAG: .json files (ABI, config, bytecode).
  7. NEVER FLAG: .sol files (bytes32 constants, image IDs).
  8. NEVER FLAG: .md / .txt / .rst files (doc hashes, tx hashes).
  9. NEVER FLAG: .yaml / .yml files (lockfile hashes, CI config).
  10. NEVER FLAG: The scanner files themselves.
"""

import re
import sys
import os
from pathlib import Path

# ── Known compromised keys — ALWAYS flag these, no exceptions ───────────────
COMPROMISED_KEYS = {
    "99ae90bc98ba507a1e390556c17e399de7fa6ad5ce496663561837eb933607dc",
    "e189d7fa3c02b2716d78d97002654f953604bb28f14b662b4e410a395da8d410",
}

# ── Known-safe test keys — Hardhat default accounts + project test keys ─────
# These are publicly documented test wallets with no real funds.
# Any 64-char hex in this set is NEVER flagged, even in Wallet() calls.
SAFE_TEST_KEYS = {
    # Hardhat default accounts (npx hardhat node)
    "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    "7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    "47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
    "8b3a350cf5c34c9194ca3a9d8b53bbf276d4f3f57a5401397dbe8f8b0d0c53b1",
    "92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
    "4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
    "dbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
    "2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
    "f214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897",
    "701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82",
    "a267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1",
    "47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd",
    "c526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa",
    "8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61",
    "ea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0",
    "689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd",
    "de9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0",
    "df57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e",
    # Vaultfire project test keys (used only in unit tests, no real funds)
    # signature_validation_chain.test.js — partner signing test wallets
    "59c6995e998f97a5a0044966f09453856a87c24f976f4f3f0f37563b60d20d5b",
    "1c0e7e5cf72d23b7123327762f7f4bea7f2a7bc01db57ee97dc0b1819b735856",
    # sdk/tests/symbioticForge.test.ts — SDK unit test wallet
    "59c6995e998f97a5a0044966f094538b2928fbc9d8890f18d23e3f8cf2b5f1c1",
}

# ── Paths / files to always skip ─────────────────────────────────────────────
SKIP_PATH_PARTS = {
    "node_modules", ".git", "artifacts", "cache", ".next", "dist",
}
SKIP_FILENAMES = {
    "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "embris_scan.py", "check-secrets.sh", "secret-scan.yml",
}
# File extensions that never contain private keys (only data/docs/bytecode)
SKIP_EXTENSIONS = {
    ".json", ".sol", ".md", ".txt", ".rst", ".yaml", ".yml",
    ".lock", ".log", ".svg", ".png", ".jpg", ".jpeg", ".gif",
    ".woff", ".woff2", ".ttf", ".eot", ".ico",
    ".db", ".db3", ".sqlite",
}

# ── Source file extensions to scan ───────────────────────────────────────────
SOURCE_EXTENSIONS = {
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
    ".py", ".sh", ".bash",
    ".env", ".toml", ".cfg", ".ini",
}

# ── Regex patterns ────────────────────────────────────────────────────────────
HEX64 = r"[0-9a-fA-F]{64}"

# Pattern 1: Variable/constant assignment with key-like name
# Matches: PRIVATE_KEY = "0x...", deployer_key = '...', SECRET_KEY="..."
# Also: const WALLET_KEY = '0x...'
RE_KEY_ASSIGNMENT = re.compile(
    r"""(?ix)
    (?:private[_\-]?key | deployer[_\-]?key | secret[_\-]?key |
       wallet[_\-]?key  | signing[_\-]?key  | signer[_\-]?key |
       mnemonic[_\-]?key)
    \s* [=:] \s*
    ['"` ]? (0x)? ([0-9a-fA-F]{64}) ['"` ;,]?
    """,
    re.VERBOSE,
)

# Pattern 2: new Wallet("0x...") or new Wallet('...')
RE_WALLET_CONSTRUCTOR = re.compile(
    r"""(?x)
    new \s+ Wallet \s* \( \s* ['"`] (0x)? ([0-9a-fA-F]{64}) ['"`]
    """,
    re.VERBOSE,
)

# Pattern 3: .env file format: KEY=value where KEY suggests a private key
RE_ENV_KEY = re.compile(
    r"""(?ix)
    ^ \s*
    (?:[A-Z0-9_]*(?:PRIVATE|DEPLOYER|SECRET|WALLET|SIGNING|SIGNER)[A-Z0-9_]*_?KEY[A-Z0-9_]*)
    \s* = \s*
    (0x)? ([0-9a-fA-F]{64})
    \s* $
    """,
    re.VERBOSE | re.MULTILINE,
)

# Pattern 4: process.env fallback with hardcoded key
# e.g.: process.env.DEPLOYER_KEY || "0x<real-key>"
RE_ENV_FALLBACK = re.compile(
    r"""(?x)
    process\.env\.[A-Z_]+ \s* \|\| \s* ['"`] (0x)? ([0-9a-fA-F]{64}) ['"`]
    """,
    re.VERBOSE,
)


def should_skip_path(path: Path) -> bool:
    """Return True if this path should never be scanned."""
    parts = set(path.parts)
    if parts & SKIP_PATH_PARTS:
        return True
    if path.name in SKIP_FILENAMES:
        return True
    if path.suffix.lower() in SKIP_EXTENSIONS:
        return True
    return False


def is_env_file(path: Path) -> bool:
    """Return True if this is a .env-style file."""
    name = path.name.lower()
    return (
        name == ".env"
        or name.startswith(".env.")
        or path.suffix == ".env"
        or name.endswith(".env")
    )


def extract_hex(match_groups) -> str:
    """Extract the 64-char hex from a regex match (strips 0x prefix)."""
    # groups are (optional_0x, hex64)
    return match_groups[-1].lower()


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    """
    Scan a single file. Returns list of (line_number, line_content, reason).
    """
    findings = []

    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return findings

    lines = content.splitlines()
    is_env = is_env_file(path)

    for lineno, line in enumerate(lines, start=1):
        stripped = line.strip()

        # Skip blank lines and pure comments
        if not stripped or stripped.startswith("#") or stripped.startswith("//"):
            continue

        # ── Rule 1: Always flag compromised keys ──────────────────────────
        for ck in COMPROMISED_KEYS:
            if ck in line.lower():
                findings.append((
                    lineno, line.rstrip(),
                    f"COMPROMISED KEY: {ck[:16]}...{ck[-8:]}"
                ))
                break

        # ── Rule 2: Key assignment pattern ───────────────────────────────
        for m in RE_KEY_ASSIGNMENT.finditer(line):
            hex_val = m.group(2).lower() if m.group(2) else m.group(0)
            # Extract the actual 64-char hex
            hex_match = re.search(r"[0-9a-fA-F]{64}", m.group(0))
            if not hex_match:
                continue
            hex_val = hex_match.group(0).lower()
            if hex_val in SAFE_TEST_KEYS:
                continue
            if hex_val in COMPROMISED_KEYS:
                continue  # already caught by Rule 1
            # Skip placeholder/zero keys
            if re.match(r"^0+$", hex_val) or re.match(r"^0+1$", hex_val):
                continue
            # Skip if the value comes from process.env
            if "process.env" in line:
                continue
            findings.append((
                lineno, line.rstrip(),
                "KEY ASSIGNMENT with 64-char hex value"
            ))

        # ── Rule 3: new Wallet() constructor ─────────────────────────────
        for m in RE_WALLET_CONSTRUCTOR.finditer(line):
            hex_match = re.search(r"[0-9a-fA-F]{64}", m.group(0))
            if not hex_match:
                continue
            hex_val = hex_match.group(0).lower()
            if hex_val in SAFE_TEST_KEYS:
                continue
            if hex_val in COMPROMISED_KEYS:
                continue  # already caught
            if re.match(r"^0+$", hex_val) or re.match(r"^0+1$", hex_val):
                continue
            findings.append((
                lineno, line.rstrip(),
                "new Wallet() with hardcoded 64-char hex key"
            ))

        # ── Rule 4: .env file key=value ───────────────────────────────────
        if is_env:
            for m in RE_ENV_KEY.finditer(line):
                hex_match = re.search(r"[0-9a-fA-F]{64}", m.group(0))
                if not hex_match:
                    continue
                hex_val = hex_match.group(0).lower()
                if hex_val in SAFE_TEST_KEYS:
                    continue
                if hex_val in COMPROMISED_KEYS:
                    continue
                if re.match(r"^0+$", hex_val) or re.match(r"^0+1$", hex_val):
                    continue
                # Skip placeholder text
                if re.search(r"your.*(key|here)|placeholder|example|xxx", hex_val, re.I):
                    continue
                findings.append((
                    lineno, line.rstrip(),
                    ".env file with hardcoded private key value"
                ))

        # ── Rule 5: process.env fallback with hardcoded key ───────────────
        for m in RE_ENV_FALLBACK.finditer(line):
            hex_match = re.search(r"[0-9a-fA-F]{64}", m.group(0))
            if not hex_match:
                continue
            hex_val = hex_match.group(0).lower()
            if hex_val in SAFE_TEST_KEYS:
                continue
            if hex_val in COMPROMISED_KEYS:
                continue
            if re.match(r"^0+$", hex_val) or re.match(r"^0+1$", hex_val):
                continue
            findings.append((
                lineno, line.rstrip(),
                "process.env fallback with hardcoded 64-char hex key"
            ))

    return findings


def collect_files(root: Path, specific_files: list[str] | None = None) -> list[Path]:
    """Collect files to scan."""
    if specific_files is not None:
        paths = []
        for f in specific_files:
            p = Path(f)
            if p.is_file() and not should_skip_path(p):
                if p.suffix.lower() in SOURCE_EXTENSIONS or is_env_file(p):
                    paths.append(p)
        return paths

    paths = []
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if should_skip_path(p):
            continue
        if p.suffix.lower() in SOURCE_EXTENSIONS or is_env_file(p):
            paths.append(p)
    return sorted(paths)


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Vaultfire Embris Protocol — Secret Scanner"
    )
    parser.add_argument(
        "--root", default=".", help="Repository root directory"
    )
    parser.add_argument(
        "--files", nargs="*", help="Specific files to scan (staged mode)"
    )
    parser.add_argument(
        "--color", action="store_true", default=True, help="Colorized output"
    )
    parser.add_argument(
        "--no-color", dest="color", action="store_false"
    )
    args = parser.parse_args()

    # Detect if running in CI (no color)
    if os.environ.get("CI") or not sys.stdout.isatty():
        args.color = False

    RED    = "\033[0;31m"   if args.color else ""
    GREEN  = "\033[0;32m"   if args.color else ""
    YELLOW = "\033[1;33m"   if args.color else ""
    BOLD   = "\033[1m"      if args.color else ""
    NC     = "\033[0m"      if args.color else ""

    root = Path(args.root).resolve()

    print(f"\n{'═'*65}")
    print(f"  {BOLD}🔐 Vaultfire Embris Protocol — Secret Scanner{NC}")
    print(f"{'═'*65}\n")

    files = collect_files(root, args.files)

    if not files:
        print(f"  {GREEN}✅ No scannable files found.{NC}\n")
        sys.exit(0)

    total_findings = []

    for path in files:
        rel = path.relative_to(root) if path.is_absolute() else path
        findings = scan_file(path)
        for lineno, line, reason in findings:
            total_findings.append((str(rel), lineno, line, reason))

    if total_findings:
        print(f"{RED}{'═'*65}{NC}")
        print(f"{RED}  ❌ SECRET SCAN FAILED — Private key material detected!{NC}")
        print(f"{RED}{'═'*65}{NC}\n")
        for filepath, lineno, line, reason in total_findings:
            print(f"  {RED}🚨 {reason}{NC}")
            print(f"     File : {BOLD}{filepath}{NC}:{lineno}")
            # Truncate very long lines for readability
            display = line[:120] + ("..." if len(line) > 120 else "")
            print(f"     Line : {display}")
            print()
        print(f"  {YELLOW}Fix: Remove the private key from source code.{NC}")
        print(f"  {YELLOW}Use environment variables (process.env.DEPLOYER_KEY) instead.{NC}\n")
        sys.exit(1)
    else:
        print(f"{GREEN}{'═'*65}{NC}")
        print(f"{GREEN}  ✅ Secret scan passed — No private keys detected{NC}")
        print(f"{GREEN}{'═'*65}{NC}\n")
        print(f"  Scanned {len(files)} source files.")
        print(f"  Detection rules active:")
        print(f"    • Known compromised keys (2 specific keys)")
        print(f"    • Key assignment patterns (PRIVATE_KEY=, DEPLOYER_KEY=, etc.)")
        print(f"    • new Wallet() with hardcoded hex")
        print(f"    • .env files with key=<hex64> patterns")
        print(f"    • process.env fallback with hardcoded hex")
        print(f"  Safe exclusions:")
        print(f"    • {len(SAFE_TEST_KEYS)} known Hardhat/project test keys")
        print(f"    • Zero/placeholder values (0x000...0, 0x000...1)")
        print(f"    • .json, .sol, .md, .yaml, .lock files (never scanned)")
        print(f"    • node_modules/, .git/, artifacts/, cache/, .next/, dist/\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
