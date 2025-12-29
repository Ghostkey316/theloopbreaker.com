"""
X (Twitter) Social Proof Scorer

Fetches real X/Twitter activity and converts it into belief metrics.
Measures community impact, thought leadership, and social proof.

Note: Requires X API credentials (free tier available).
Get credentials at: https://developer.twitter.com/en/portal/dashboard
"""

import os
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path
import requests

# X API v2
X_API_URL = "https://api.twitter.com/2"
X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN", "")  # Required

# Cache directory
CACHE_DIR = Path(__file__).resolve().parents[1] / "cache" / "twitter"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def x_headers() -> Dict[str, str]:
    """Get X API headers."""
    if not X_BEARER_TOKEN:
        raise ValueError(
            "X_BEARER_TOKEN not set. "
            "Get one at: https://developer.twitter.com/en/portal/dashboard"
        )

    return {
        "Authorization": f"Bearer {X_BEARER_TOKEN}",
        "User-Agent": "Vaultfire-Belief-Engine"
    }


def fetch_user_by_username(username: str) -> Dict:
    """Fetch X user profile by username."""
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
    url = f"{X_API_URL}/users/by/username/{username}"
    params = {
        "user.fields": "created_at,description,public_metrics,verified,verified_type"
    }

    try:
        response = requests.get(url, headers=x_headers(), params=params, timeout=10)

        if response.status_code != 200:
            raise ValueError(f"X user not found: {username} (status: {response.status_code})")

        data = response.json()
        user_data = data.get("data", {})

        # Cache result
        try:
            cache_file.write_text(json.dumps(user_data, indent=2))
        except Exception:
            pass

        return user_data

    except Exception as e:
        raise ValueError(f"Failed to fetch X user {username}: {e}")


def fetch_user_tweets(user_id: str, limit: int = 100) -> List[Dict]:
    """Fetch recent tweets from user."""
    cache_file = CACHE_DIR / f"{user_id}_tweets.json"

    # Check cache (30 minute TTL)
    if cache_file.exists():
        cache_age = time.time() - cache_file.stat().st_mtime
        if cache_age < 1800:
            try:
                return json.loads(cache_file.read_text())
            except Exception:
                pass

    # Fetch from API
    url = f"{X_API_URL}/users/{user_id}/tweets"
    params = {
        "max_results": min(limit, 100),
        "tweet.fields": "created_at,public_metrics,referenced_tweets",
        "exclude": "retweets"
    }

    try:
        response = requests.get(url, headers=x_headers(), params=params, timeout=10)

        if response.status_code != 200:
            return []

        data = response.json()
        tweets = data.get("data", [])

        # Cache result
        try:
            cache_file.write_text(json.dumps(tweets, indent=2))
        except Exception:
            pass

        return tweets

    except Exception:
        return []


def calculate_social_loyalty(profile: Dict, tweets: List[Dict]) -> float:
    """
    Calculate social loyalty (0-100).

    Factors:
    - Account age (long-term presence)
    - Follower count (community size)
    - Following ratio (not spam/bot)
    - Sustained activity
    """
    loyalty = 0.0

    metrics = profile.get("public_metrics", {})

    # Account age (max 30 points)
    created_at = datetime.strptime(profile["created_at"], "%Y-%m-%dT%H:%M:%S.%fZ")
    age_days = (datetime.utcnow() - created_at).days
    age_years = age_days / 365.0
    loyalty += min(30.0, age_years * 10.0)  # 3 years = 30 points

    # Follower count (max 40 points)
    followers = metrics.get("followers_count", 0)
    # Logarithmic scale: 100 = 20 pts, 1000 = 30 pts, 10000 = 40 pts
    import math
    if followers > 0:
        follower_score = min(40.0, math.log10(followers) * 13.3)
        loyalty += follower_score

    # Following ratio (max 15 points)
    # Healthy ratio = not following way more than followers
    following = metrics.get("following_count", 0)
    if followers > 0 and following > 0:
        ratio = followers / following
        if ratio >= 1.0:
            loyalty += 15.0
        elif ratio >= 0.5:
            loyalty += 10.0
        elif ratio >= 0.2:
            loyalty += 5.0

    # Tweet count (sustained activity) (max 15 points)
    tweet_count = metrics.get("tweet_count", 0)
    if tweet_count > 0:
        activity_score = min(15.0, math.log10(tweet_count) * 5.0)
        loyalty += activity_score

    return min(100.0, round(loyalty, 2))


def calculate_social_impact(profile: Dict, tweets: List[Dict]) -> float:
    """
    Calculate social impact (0-100).

    Factors:
    - Total engagement (likes + retweets + replies)
    - Average engagement per tweet
    - Viral content (high-engagement tweets)
    - Community reach
    """
    impact = 0.0

    metrics = profile.get("public_metrics", {})

    # Follower base (max 30 points)
    followers = metrics.get("followers_count", 0)
    import math
    if followers > 0:
        follower_impact = min(30.0, math.log10(followers) * 10.0)
        impact += follower_impact

    # Tweet engagement (max 40 points)
    if tweets:
        total_likes = sum(t.get("public_metrics", {}).get("like_count", 0) for t in tweets)
        total_retweets = sum(t.get("public_metrics", {}).get("retweet_count", 0) for t in tweets)
        total_replies = sum(t.get("public_metrics", {}).get("reply_count", 0) for t in tweets)

        total_engagement = total_likes + (total_retweets * 2) + total_replies  # Retweets worth 2x
        avg_engagement = total_engagement / len(tweets)

        # Scale: avg 10 engagement = 20 pts, 50 = 30 pts, 100+ = 40 pts
        if avg_engagement > 0:
            engagement_score = min(40.0, math.log10(avg_engagement + 1) * 20.0)
            impact += engagement_score

    # Viral content (max 15 points)
    if tweets:
        max_likes = max((t.get("public_metrics", {}).get("like_count", 0) for t in tweets), default=0)
        if max_likes > 100:
            viral_score = min(15.0, math.log10(max_likes) * 5.0)
            impact += viral_score

    # Listed count (credibility) (max 15 points)
    listed = metrics.get("listed_count", 0)
    if listed > 0:
        listed_score = min(15.0, math.log10(listed + 1) * 7.5)
        impact += listed_score

    return min(100.0, round(impact, 2))


def calculate_thought_leadership(profile: Dict, tweets: List[Dict]) -> float:
    """
    Calculate thought leadership (0-100).

    Factors:
    - Original content ratio (not just replies/retweets)
    - Tweet quality (engagement per tweet)
    - Verified status
    - Bio/description clarity
    """
    leadership = 0.0

    # Has bio (max 20 points)
    if profile.get("description"):
        leadership += 20.0

    # Verified (max 15 points)
    if profile.get("verified") or profile.get("verified_type"):
        leadership += 15.0

    # Original content ratio (max 35 points)
    if tweets:
        original_tweets = [
            t for t in tweets
            if not t.get("referenced_tweets")  # Not a reply or quote
        ]
        if tweets:
            original_ratio = len(original_tweets) / len(tweets)
            leadership += original_ratio * 35.0

    # Quality over quantity (max 30 points)
    if tweets:
        # High engagement on original content = thought leader
        original_tweets = [
            t for t in tweets
            if not t.get("referenced_tweets")
        ]
        if original_tweets:
            avg_likes = sum(
                t.get("public_metrics", {}).get("like_count", 0)
                for t in original_tweets
            ) / len(original_tweets)

            import math
            if avg_likes > 0:
                quality_score = min(30.0, math.log10(avg_likes + 1) * 15.0)
                leadership += quality_score

    return min(100.0, round(leadership, 2))


def calculate_social_frequency(tweets: List[Dict]) -> float:
    """
    Calculate social frequency (0-100).

    Factors:
    - Recent tweet activity (last 7 days, 30 days)
    - Consistent posting
    """
    frequency = 0.0

    if not tweets:
        return 0.0

    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)

    # Recent activity (last 7 days) (max 50 points)
    recent_7d = sum(
        1 for t in tweets
        if datetime.strptime(t["created_at"], "%Y-%m-%dT%H:%M:%S.%fZ") > seven_days_ago
    )
    frequency += min(50.0, recent_7d * 10.0)  # 5 tweets = 50 points

    # Recent activity (last 30 days) (max 30 points)
    recent_30d = sum(
        1 for t in tweets
        if datetime.strptime(t["created_at"], "%Y-%m-%dT%H:%M:%S.%fZ") > thirty_days_ago
    )
    frequency += min(30.0, recent_30d * 2.0)  # 15 tweets = 30 points

    # Consistency (max 20 points)
    if len(tweets) >= 10:
        # Check if tweets are spread over time (not all at once)
        dates = [datetime.strptime(t["created_at"], "%Y-%m-%dT%H:%M:%S.%fZ") for t in tweets]
        dates.sort()
        date_spread = (dates[-1] - dates[0]).days
        if date_spread > 7:
            frequency += 20.0
        elif date_spread > 3:
            frequency += 10.0

    return min(100.0, round(frequency, 2))


def get_social_metrics(x_username: str) -> Dict[str, float]:
    """
    Get complete social proof metrics for an X/Twitter username.

    Returns dict with keys:
    - loyalty: Long-term presence, follower count
    - impact: Engagement, viral content, community reach
    - leadership: Original content, verified, thought leadership
    - frequency: Recent activity, consistency
    """
    # Fetch X data
    profile = fetch_user_by_username(x_username)
    user_id = profile.get("id")

    tweets = []
    if user_id:
        tweets = fetch_user_tweets(user_id, limit=100)

    # Calculate metrics
    metrics = {
        "loyalty": calculate_social_loyalty(profile, tweets),
        "impact": calculate_social_impact(profile, tweets),
        "leadership": calculate_thought_leadership(profile, tweets),
        "frequency": calculate_social_frequency(tweets),
    }

    # Metadata
    metadata = {
        "x_username": x_username,
        "followers": profile.get("public_metrics", {}).get("followers_count", 0),
        "following": profile.get("public_metrics", {}).get("following_count", 0),
        "tweet_count": profile.get("public_metrics", {}).get("tweet_count", 0),
        "verified": profile.get("verified", False),
        "account_age_days": (
            datetime.utcnow() -
            datetime.strptime(profile["created_at"], "%Y-%m-%dT%H:%M:%S.%fZ")
        ).days,
        "timestamp": datetime.utcnow().isoformat()
    }

    # Save to cache
    cache_file = CACHE_DIR / f"{x_username}_social_metrics.json"
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

    username = sys.argv[1] if len(sys.argv) > 1 else "elonmusk"

    print(f"Fetching social metrics for X: @{username}")
    print("-" * 60)

    try:
        metrics = get_social_metrics(username)

        print(f"Social Loyalty:        {metrics['loyalty']:.2f}/100")
        print(f"Social Impact:         {metrics['impact']:.2f}/100")
        print(f"Thought Leadership:    {metrics['leadership']:.2f}/100")
        print(f"Social Frequency:      {metrics['frequency']:.2f}/100")
        print("-" * 60)

        # Average social score
        avg_score = sum(metrics.values()) / len(metrics)
        print(f"\nAverage Social Score: {avg_score:.2f}/100")

        if avg_score >= 80:
            print("🔥 EXCEPTIONAL SOCIAL PRESENCE")
        elif avg_score >= 60:
            print("⭐ STRONG SOCIAL PRESENCE")
        elif avg_score >= 40:
            print("✓  ACTIVE SOCIAL PRESENCE")
        else:
            print("○  EMERGING SOCIAL PRESENCE")

    except Exception as e:
        print(f"Error: {e}")
        print("\nNote: Requires X_BEARER_TOKEN environment variable.")
        print("Get one at: https://developer.twitter.com/en/portal/dashboard")
        sys.exit(1)
