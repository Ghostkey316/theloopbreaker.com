"""
GitHub Builder Contribution Scorer

Fetches real GitHub activity and converts it into belief metrics.
Recognizes ACTUAL builder value: commits, code, innovation, impact.
"""

import os
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path
import requests

# GitHub API
GITHUB_API_URL = "https://api.github.com"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")  # Optional (increases rate limit)

# Cache directory
CACHE_DIR = Path(__file__).resolve().parents[1] / "cache" / "github"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def github_headers() -> Dict[str, str]:
    """Get GitHub API headers."""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Vaultfire-Belief-Engine"
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers


def fetch_user_profile(username: str) -> Dict:
    """Fetch GitHub user profile."""
    cache_file = CACHE_DIR / f"{username}_profile.json"

    # Check cache (1 hour TTL)
    if cache_file.exists():
        cache_age = time.time() - cache_file.stat().st_mtime
        if cache_age < 3600:
            try:
                return json.loads(cache_file.read_text())
            except Exception:
                pass

    # Fetch from API
    url = f"{GITHUB_API_URL}/users/{username}"
    response = requests.get(url, headers=github_headers(), timeout=10)

    if response.status_code != 200:
        raise ValueError(f"GitHub user not found: {username}")

    data = response.json()

    # Cache result
    try:
        cache_file.write_text(json.dumps(data, indent=2))
    except Exception:
        pass

    return data


def fetch_user_repos(username: str, limit: int = 100) -> List[Dict]:
    """Fetch user's repositories."""
    cache_file = CACHE_DIR / f"{username}_repos.json"

    # Check cache (1 hour TTL)
    if cache_file.exists():
        cache_age = time.time() - cache_file.stat().st_mtime
        if cache_age < 3600:
            try:
                return json.loads(cache_file.read_text())
            except Exception:
                pass

    # Fetch from API
    url = f"{GITHUB_API_URL}/users/{username}/repos"
    params = {
        "type": "owner",
        "sort": "updated",
        "per_page": min(limit, 100)
    }

    response = requests.get(url, headers=github_headers(), params=params, timeout=10)

    if response.status_code != 200:
        return []

    data = response.json()

    # Cache result
    try:
        cache_file.write_text(json.dumps(data, indent=2))
    except Exception:
        pass

    return data


def fetch_commit_activity(username: str, repo_name: str) -> int:
    """Fetch commit count for a specific repo."""
    cache_file = CACHE_DIR / f"{username}_{repo_name}_commits.json"

    # Check cache (1 hour TTL)
    if cache_file.exists():
        cache_age = time.time() - cache_file.stat().st_mtime
        if cache_age < 3600:
            try:
                data = json.loads(cache_file.read_text())
                return data.get("commit_count", 0)
            except Exception:
                pass

    # Fetch from API
    url = f"{GITHUB_API_URL}/repos/{username}/{repo_name}/commits"
    params = {"author": username, "per_page": 1}

    try:
        response = requests.get(url, headers=github_headers(), params=params, timeout=10)

        # Get commit count from Link header
        if "Link" in response.headers:
            link_header = response.headers["Link"]
            # Parse last page number
            import re
            match = re.search(r'page=(\d+)>; rel="last"', link_header)
            if match:
                commit_count = int(match.group(1))
            else:
                commit_count = len(response.json())
        else:
            commit_count = len(response.json()) if response.status_code == 200 else 0

        # Cache result
        try:
            cache_file.write_text(json.dumps({"commit_count": commit_count}, indent=2))
        except Exception:
            pass

        return commit_count

    except Exception:
        return 0


def calculate_builder_loyalty(profile: Dict, repos: List[Dict]) -> float:
    """
    Calculate builder loyalty (0-100).

    Factors:
    - Account age (long-term commitment)
    - Total repositories
    - Sustained contribution (not a fly-by-night dev)
    - Public repos count
    """
    loyalty = 0.0

    # Account age (max 30 points)
    created_at = datetime.strptime(profile["created_at"], "%Y-%m-%dT%H:%M:%SZ")
    age_days = (datetime.utcnow() - created_at).days
    age_years = age_days / 365.0
    loyalty += min(30.0, age_years * 10.0)  # 3 years = 30 points

    # Repository count (max 30 points)
    public_repos = profile.get("public_repos", 0)
    loyalty += min(30.0, public_repos * 3.0)  # 10 repos = 30 points

    # Active repos (updated recently) (max 20 points)
    now = datetime.utcnow()
    six_months_ago = now - timedelta(days=180)
    active_repos = sum(
        1 for repo in repos
        if datetime.strptime(repo["updated_at"], "%Y-%m-%dT%H:%M:%SZ") > six_months_ago
    )
    loyalty += min(20.0, active_repos * 5.0)  # 4 active repos = 20 points

    # Followers (community recognition) (max 20 points)
    followers = profile.get("followers", 0)
    loyalty += min(20.0, followers * 2.0)  # 10 followers = 20 points

    return min(100.0, round(loyalty, 2))


def calculate_builder_ethics(profile: Dict, repos: List[Dict]) -> float:
    """
    Calculate builder ethics (0-100).

    Factors:
    - Open source commitment (public repos vs private)
    - No abandoned projects (archived repos)
    - Community contributions (forks, stars)
    - Bio/description transparency
    """
    ethics = 50.0  # Start neutral

    # Public repos ratio (max 20 points)
    public_repos = profile.get("public_repos", 0)
    total_repos = public_repos + profile.get("total_private_repos", 0)
    if total_repos > 0:
        public_ratio = public_repos / total_repos
        ethics += public_ratio * 20.0

    # Not abandoned (max 15 points)
    archived_count = sum(1 for repo in repos if repo.get("archived", False))
    abandonment_penalty = archived_count * 5.0
    ethics -= min(15.0, abandonment_penalty)

    # Has bio/description (transparency) (max 10 points)
    if profile.get("bio"):
        ethics += 10.0

    # Community impact (stars/forks) (max 20 points)
    total_stars = sum(repo.get("stargazers_count", 0) for repo in repos)
    ethics += min(20.0, total_stars / 10.0)  # 200 stars = 20 points

    return min(100.0, max(0.0, round(ethics, 2)))


def calculate_builder_impact(profile: Dict, repos: List[Dict]) -> float:
    """
    Calculate builder impact (0-100).

    Factors:
    - Stars received (community validation)
    - Forks (derivative work)
    - Watchers (ongoing interest)
    - Original work (not just forks)
    """
    impact = 0.0

    # Total stars (max 40 points)
    total_stars = sum(repo.get("stargazers_count", 0) for repo in repos)
    impact += min(40.0, total_stars / 5.0)  # 200 stars = 40 points

    # Total forks (max 30 points)
    total_forks = sum(repo.get("forks_count", 0) for repo in repos)
    impact += min(30.0, total_forks / 2.0)  # 60 forks = 30 points

    # Watchers (max 15 points)
    total_watchers = sum(repo.get("watchers_count", 0) for repo in repos)
    impact += min(15.0, total_watchers / 10.0)  # 150 watchers = 15 points

    # Original work ratio (max 15 points)
    original_repos = sum(1 for repo in repos if not repo.get("fork", False))
    if repos:
        original_ratio = original_repos / len(repos)
        impact += original_ratio * 15.0

    return min(100.0, round(impact, 2))


def calculate_builder_frequency(repos: List[Dict]) -> float:
    """
    Calculate builder frequency (0-100).

    Factors:
    - Recent commits (last 7 days, 30 days)
    - Recent repo updates
    - Sustained activity
    """
    frequency = 0.0

    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    # Recent updates (last 7 days) (max 40 points)
    recent_7d = sum(
        1 for repo in repos
        if datetime.strptime(repo["updated_at"], "%Y-%m-%dT%H:%M:%SZ") > seven_days_ago
    )
    frequency += min(40.0, recent_7d * 20.0)  # 2 repos updated = 40 points

    # Recent updates (last 30 days) (max 30 points)
    recent_30d = sum(
        1 for repo in repos
        if datetime.strptime(repo["updated_at"], "%Y-%m-%dT%H:%M:%SZ") > thirty_days_ago
    )
    frequency += min(30.0, recent_30d * 5.0)  # 6 repos updated = 30 points

    # Repo with recent push (max 30 points)
    recent_pushes = sum(
        1 for repo in repos
        if repo.get("pushed_at") and datetime.strptime(repo["pushed_at"], "%Y-%m-%dT%H:%M:%SZ") > thirty_days_ago
    )
    frequency += min(30.0, recent_pushes * 10.0)  # 3 recent pushes = 30 points

    return min(100.0, round(frequency, 2))


def calculate_innovation_score(repos: List[Dict]) -> float:
    """
    Calculate innovation score (0-100).

    Factors:
    - Unique/novel repos (not common tutorials)
    - Language diversity
    - Complexity signals (large repos)
    - Cutting-edge topics
    """
    innovation = 0.0

    # Language diversity (max 30 points)
    languages = set(repo.get("language") for repo in repos if repo.get("language"))
    innovation += min(30.0, len(languages) * 5.0)  # 6 languages = 30 points

    # Large/complex repos (max 30 points)
    large_repos = sum(1 for repo in repos if repo.get("size", 0) > 10000)  # >10MB
    innovation += min(30.0, large_repos * 15.0)  # 2 large repos = 30 points

    # Recent creations (still building new things) (max 20 points)
    now = datetime.utcnow()
    year_ago = now - timedelta(days=365)
    recent_repos = sum(
        1 for repo in repos
        if datetime.strptime(repo["created_at"], "%Y-%m-%dT%H:%M:%SZ") > year_ago
    )
    innovation += min(20.0, recent_repos * 10.0)  # 2 new repos = 20 points

    # Non-fork ratio (original work) (max 20 points)
    if repos:
        original_ratio = sum(1 for repo in repos if not repo.get("fork", False)) / len(repos)
        innovation += original_ratio * 20.0

    return min(100.0, round(innovation, 2))


def get_builder_metrics(github_username: str) -> Dict[str, float]:
    """
    Get complete builder metrics for a GitHub username.

    Returns dict with keys:
    - loyalty: Long-term commitment, sustained contribution
    - ethics: Open source, transparency, no abandonment
    - impact: Stars, forks, community validation
    - frequency: Recent activity, consistency
    - innovation: Unique work, language diversity, complexity
    """
    # Fetch GitHub data
    profile = fetch_user_profile(github_username)
    repos = fetch_user_repos(github_username)

    # Calculate metrics
    metrics = {
        "loyalty": calculate_builder_loyalty(profile, repos),
        "ethics": calculate_builder_ethics(profile, repos),
        "impact": calculate_builder_impact(profile, repos),
        "frequency": calculate_builder_frequency(repos),
        "innovation": calculate_innovation_score(repos),
    }

    # Additional metadata
    metadata = {
        "github_username": github_username,
        "public_repos": profile.get("public_repos", 0),
        "followers": profile.get("followers", 0),
        "total_stars": sum(repo.get("stargazers_count", 0) for repo in repos),
        "account_age_days": (datetime.utcnow() - datetime.strptime(profile["created_at"], "%Y-%m-%dT%H:%M:%SZ")).days,
        "timestamp": datetime.utcnow().isoformat()
    }

    # Save to cache
    cache_file = CACHE_DIR / f"{github_username}_builder_metrics.json"
    try:
        cache_file.write_text(json.dumps({
            "metrics": metrics,
            "metadata": metadata
        }, indent=2))
    except Exception:
        pass

    return metrics


if __name__ == "__main__":
    import sys

    username = sys.argv[1] if len(sys.argv) > 1 else "Ghostkey316"

    print(f"Fetching builder metrics for GitHub: {username}")
    print("-" * 60)

    try:
        metrics = get_builder_metrics(username)

        print(f"Builder Loyalty:    {metrics['loyalty']:.2f}/100")
        print(f"Builder Ethics:     {metrics['ethics']:.2f}/100")
        print(f"Builder Impact:     {metrics['impact']:.2f}/100")
        print(f"Builder Frequency:  {metrics['frequency']:.2f}/100")
        print(f"Builder Innovation: {metrics['innovation']:.2f}/100")
        print("-" * 60)

        # Average builder score
        avg_score = sum(metrics.values()) / len(metrics)
        print(f"\nAverage Builder Score: {avg_score:.2f}/100")

        if avg_score >= 80:
            print("🔥 EXCEPTIONAL BUILDER")
        elif avg_score >= 60:
            print("⭐ STRONG BUILDER")
        elif avg_score >= 40:
            print("✓  ACTIVE BUILDER")
        else:
            print("○  EMERGING BUILDER")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
