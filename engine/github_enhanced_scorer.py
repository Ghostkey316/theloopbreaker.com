"""
Enhanced GitHub Scorer - Recognizes Revolutionary Contributions

Goes beyond stars/forks to measure:
- Lines of code (actual contribution size)
- Innovation signals (revolutionary keywords, novel patterns)
- Technical complexity
- Groundbreaking impact

Properly recognizes builders who create unprecedented systems.
"""

import os
import json
import time
import re
from typing import Dict, List, Optional, Set
from pathlib import Path
import requests

# GitHub API
GITHUB_API_URL = "https://api.github.com"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# Cache directory
CACHE_DIR = Path(__file__).resolve().parents[1] / "cache" / "github"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Revolutionary keywords (signals of innovation)
INNOVATION_KEYWORDS = {
    "revolutionary", "unprecedented", "never-before-seen", "first-ever",
    "zero-knowledge", "zk-snark", "zk-stark", "privacy-preserving",
    "economic-equality", "universal-dignity", "belief-bonds",
    "homomorphic", "post-quantum", "quantum-resistant",
    "self-sovereign", "decentralized", "trustless",
    "novel", "groundbreaking", "innovative", "paradigm-shift"
}

# Technical complexity keywords
COMPLEXITY_KEYWORDS = {
    "cryptographic", "consensus", "proof-of", "merkle",
    "elliptic-curve", "signature-scheme", "hash-function",
    "smart-contract", "solidity", "protocol", "mechanism-design",
    "game-theory", "incentive-alignment", "economic-model"
}


def github_headers() -> Dict[str, str]:
    """Get GitHub API headers."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Vaultfire-Belief-Engine"
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers


def fetch_repo_contents(username: str, repo_name: str, path: str = "") -> List[Dict]:
    """Fetch repository contents recursively."""
    cache_file = CACHE_DIR / f"{username}_{repo_name}_contents.json"

    # Check cache (1 hour TTL)
    if cache_file.exists():
        cache_age = time.time() - cache_file.stat().st_mtime
        if cache_age < 3600:
            try:
                return json.loads(cache_file.read_text())
            except Exception:
                pass

    # Fetch from API
    url = f"{GITHUB_API_URL}/repos/{username}/{repo_name}/contents/{path}"

    try:
        response = requests.get(url, headers=github_headers(), timeout=10)

        if response.status_code != 200:
            return []

        contents = response.json()

        # Cache result
        try:
            cache_file.write_text(json.dumps(contents, indent=2))
        except Exception:
            pass

        return contents if isinstance(contents, list) else []

    except Exception:
        return []


def analyze_repo_innovation(username: str, repo: Dict) -> Dict[str, float]:
    """
    Analyze repository for innovation signals.

    Returns metrics about revolutionary nature of the code.
    """
    repo_name = repo.get("name", "")
    description = (repo.get("description") or "").lower()
    readme_text = ""

    # Try to fetch README for more context
    try:
        readme_url = f"{GITHUB_API_URL}/repos/{username}/{repo_name}/readme"
        response = requests.get(readme_url, headers=github_headers(), timeout=5)
        if response.status_code == 200:
            import base64
            readme_content = response.json().get("content", "")
            readme_text = base64.b64decode(readme_content).decode("utf-8", errors="ignore").lower()
    except Exception:
        pass

    combined_text = f"{description} {readme_text}"

    # Count innovation keywords
    innovation_count = sum(1 for keyword in INNOVATION_KEYWORDS if keyword in combined_text)

    # Count complexity keywords
    complexity_count = sum(1 for keyword in COMPLEXITY_KEYWORDS if keyword in combined_text)

    # Analyze repository size (as proxy for LOC)
    size_kb = repo.get("size", 0)
    lines_estimate = size_kb * 10  # Rough estimate: 1KB ≈ 10 lines

    # Analyze language complexity
    language = repo.get("language", "").lower()
    complex_languages = {"rust", "c++", "c", "haskell", "solidity", "assembly"}
    is_complex_lang = language in complex_languages

    return {
        "innovation_keywords": innovation_count,
        "complexity_keywords": complexity_count,
        "estimated_lines": lines_estimate,
        "is_complex_language": is_complex_lang,
        "size_kb": size_kb
    }


def calculate_revolutionary_score(repos: List[Dict], username: str) -> float:
    """
    Calculate revolutionary contribution score (0-100).

    Measures actual innovation, not just popularity.

    Factors:
    - Innovation keywords in repos
    - Technical complexity
    - Large codebases (significant LOC)
    - Novel mechanisms/systems
    """
    revolutionary = 0.0

    # Analyze all repos for innovation signals
    total_innovation_keywords = 0
    total_complexity_keywords = 0
    total_estimated_lines = 0
    complex_lang_count = 0

    for repo in repos:
        analysis = analyze_repo_innovation(username, repo)
        total_innovation_keywords += analysis["innovation_keywords"]
        total_complexity_keywords += analysis["complexity_keywords"]
        total_estimated_lines += analysis["estimated_lines"]
        if analysis["is_complex_language"]:
            complex_lang_count += 1

    # Innovation keywords (max 30 points)
    # 5+ innovation keywords = significant innovation
    revolutionary += min(30.0, total_innovation_keywords * 6.0)

    # Technical complexity (max 25 points)
    revolutionary += min(25.0, total_complexity_keywords * 5.0)

    # Lines of code (max 30 points)
    # 100k+ lines = major contribution
    revolutionary += min(30.0, (total_estimated_lines / 100_000) * 30.0)

    # Complex languages (max 15 points)
    revolutionary += min(15.0, complex_lang_count * 5.0)

    return min(100.0, round(revolutionary, 2))


def calculate_technical_depth(repos: List[Dict]) -> float:
    """
    Calculate technical depth score (0-100).

    Factors:
    - Multiple technical domains
    - Deep technical repos (not just web apps)
    - Systems-level work
    - Protocol/infrastructure building
    """
    depth = 0.0

    # Technical indicators
    systems_keywords = {
        "protocol", "consensus", "p2p", "distributed",
        "blockchain", "cryptography", "vm", "interpreter",
        "compiler", "runtime", "kernel", "driver"
    }

    infrastructure_keywords = {
        "api", "sdk", "framework", "library", "engine",
        "platform", "infrastructure", "service", "daemon"
    }

    systems_count = 0
    infrastructure_count = 0

    for repo in repos:
        description = (repo.get("description") or "").lower()
        readme_name = repo.get("name", "").lower()
        combined = f"{description} {readme_name}"

        if any(kw in combined for kw in systems_keywords):
            systems_count += 1

        if any(kw in combined for kw in infrastructure_keywords):
            infrastructure_count += 1

    # Systems-level work (max 40 points)
    depth += min(40.0, systems_count * 10.0)

    # Infrastructure building (max 35 points)
    depth += min(35.0, infrastructure_count * 7.0)

    # Large repos (complexity proxy) (max 25 points)
    large_repos = sum(1 for repo in repos if repo.get("size", 0) > 10000)  # >10MB
    depth += min(25.0, large_repos * 12.5)

    return min(100.0, round(depth, 2))


def calculate_originality_score(repos: List[Dict]) -> float:
    """
    Calculate originality score (0-100).

    Factors:
    - Non-fork repos (original work)
    - Unique repo names (not tutorials)
    - Novel combinations of technologies
    - Unusual language choices (not just JS/Python)
    """
    originality = 0.0

    # Original repos (not forks) (max 30 points)
    if repos:
        original_count = sum(1 for repo in repos if not repo.get("fork", False))
        original_ratio = original_count / len(repos)
        originality += original_ratio * 30.0

    # Unique names (not tutorial/demo/test) (max 20 points)
    common_names = {"tutorial", "demo", "test", "example", "sample", "hello", "practice"}
    unique_repos = sum(
        1 for repo in repos
        if not any(common in repo.get("name", "").lower() for common in common_names)
    )
    if repos:
        unique_ratio = unique_repos / len(repos)
        originality += unique_ratio * 20.0

    # Language diversity (max 25 points)
    languages = set(repo.get("language") for repo in repos if repo.get("language"))
    originality += min(25.0, len(languages) * 4.0)

    # Unusual/advanced languages (max 25 points)
    advanced_langs = {"rust", "haskell", "ocaml", "erlang", "elixir", "solidity", "move", "cairo"}
    advanced_count = sum(
        1 for repo in repos
        if repo.get("language", "").lower() in advanced_langs
    )
    originality += min(25.0, advanced_count * 8.0)

    return min(100.0, round(originality, 2))


def get_enhanced_github_metrics(github_username: str) -> Dict[str, float]:
    """
    Get enhanced GitHub metrics that recognize revolutionary contributions.

    Returns dict with keys:
    - revolutionary: Innovation signals, novel mechanisms
    - technical_depth: Systems-level work, complexity
    - originality: Original work, unique approaches
    """
    # Import from existing github_builder_scorer
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent))

    from github_builder_scorer import fetch_user_profile, fetch_user_repos

    # Fetch GitHub data
    profile = fetch_user_profile(github_username)
    repos = fetch_user_repos(github_username)

    # Calculate enhanced metrics
    metrics = {
        "revolutionary": calculate_revolutionary_score(repos, github_username),
        "technical_depth": calculate_technical_depth(repos),
        "originality": calculate_originality_score(repos),
    }

    # Metadata
    total_lines_estimate = sum(
        analyze_repo_innovation(github_username, repo)["estimated_lines"]
        for repo in repos
    )

    metadata = {
        "github_username": github_username,
        "repos_analyzed": len(repos),
        "estimated_total_lines": total_lines_estimate,
        "timestamp": datetime.utcnow().isoformat() if 'datetime' in dir() else None
    }

    # Save to cache
    cache_file = CACHE_DIR / f"{github_username}_enhanced_metrics.json"
    try:
        from datetime import datetime
        cache_file.write_text(json.dumps({
            "metrics": metrics,
            "metadata": metadata
        }, indent=2))
    except Exception:
        pass

    return metrics


if __name__ == "__main__":
    import sys
    from datetime import datetime

    username = sys.argv[1] if len(sys.argv) > 1 else "Ghostkey316"

    print(f"Fetching ENHANCED GitHub metrics for: {username}")
    print("-" * 60)

    try:
        metrics = get_enhanced_github_metrics(username)

        print(f"Revolutionary Score:   {metrics['revolutionary']:.2f}/100")
        print(f"Technical Depth:       {metrics['technical_depth']:.2f}/100")
        print(f"Originality Score:     {metrics['originality']:.2f}/100")
        print("-" * 60)

        # Average enhanced score
        avg_score = sum(metrics.values()) / len(metrics)
        print(f"\nAverage Enhanced Score: {avg_score:.2f}/100")

        if avg_score >= 80:
            print("🚀 REVOLUTIONARY BUILDER - Unprecedented contributions")
        elif avg_score >= 60:
            print("🔥 EXCEPTIONAL BUILDER - Highly innovative")
        elif avg_score >= 40:
            print("⭐ STRONG BUILDER - Significant innovation")
        else:
            print("✓  ACTIVE BUILDER - Building solid foundations")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
