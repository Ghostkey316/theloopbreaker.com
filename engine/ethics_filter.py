import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
LISTINGS_PATH = BASE_DIR / "dashboards" / "marketplace_listings.json"
RANKED_PATH = BASE_DIR / "dashboards" / "marketplace_ranked.json"
WALLET_PATH = BASE_DIR / "dashboards" / "wallet_insights.json"
REVIEWS_PATH = BASE_DIR / "dashboards" / "community_reviews.json"
TOKEN_PATH = BASE_DIR / "dashboards" / "tokenomics_fairness.json"


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


def _avg(values: list[float]) -> float:
    if not values:
        return 3.0
    return sum(values) / len(values)


def calculate_score(listing: dict, wallets: dict, reviews: dict, tokenomics: dict) -> dict:
    seller = listing.get("seller", {})
    name = seller.get("name")
    wallet_info = wallets.get(name, {})
    flagged = wallet_info.get("flagged", False)

    transparency = 1.0 if listing.get("ethics_verified") else 0.5
    if flagged:
        transparency = max(transparency - 0.5, 0.0)

    rev_scores = reviews.get(listing.get("id"), [])
    truthfulness = _avg(rev_scores) / 5.0
    user_care = min(len(rev_scores) / 10, 1.0) * truthfulness

    token_score = tokenomics.get(listing.get("id"), 3) / 5.0
    fair_rewards = token_score

    total = (transparency + truthfulness + user_care + fair_rewards) / 4 * 100
    return {
        "transparency": round(transparency, 2),
        "truthfulness": round(truthfulness, 2),
        "user_care": round(user_care, 2),
        "fair_rewards": round(fair_rewards, 2),
        "ethics_score": round(total, 2),
    }


def rank_listings() -> list[dict]:
    listings = _load_json(LISTINGS_PATH, [])
    wallets = _load_json(WALLET_PATH, {})
    reviews = _load_json(REVIEWS_PATH, {})
    tokenomics = _load_json(TOKEN_PATH, {})

    ranked = []
    for item in listings:
        score = calculate_score(item, wallets, reviews, tokenomics)
        ranked.append({**item, **score})

    ranked.sort(key=lambda x: x["ethics_score"], reverse=True)
    _write_json(RANKED_PATH, ranked)
    return ranked


if __name__ == "__main__":
    data = rank_listings()
    print(json.dumps(data, indent=2))
