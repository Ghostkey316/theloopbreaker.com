"""Velocity simulator projecting commits per week toward 1M users."""
from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass
class VelocityResult:
    commits_per_week: float
    projected_users: float
    weeks_to_goal: float


def simulate_velocity(commit_history: List[int], current_users: int, target_users: int = 1_000_000) -> VelocityResult:
    if not commit_history:
        raise ValueError("commit_history cannot be empty")
    avg_commits = sum(commit_history) / len(commit_history)
    growth_rate = max(1.02, 1 + avg_commits / 500)
    weeks = 0
    users = float(current_users)
    while users < target_users:
        users *= growth_rate
        weeks += 1
    return VelocityResult(commits_per_week=avg_commits, projected_users=users, weeks_to_goal=float(weeks))


if __name__ == "__main__":
    result = simulate_velocity([24, 28, 31, 27], current_users=250_000)
    print(
        "Sim:",
        f"{result.commits_per_week:.1f} commits/week,",
        f"weeks_to_goal={result.weeks_to_goal},",
        f"projected_users={result.projected_users:.0f}",
    )
