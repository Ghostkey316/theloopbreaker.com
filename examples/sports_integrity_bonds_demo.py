#!/usr/bin/env python3
"""
Sports Integrity Bonds - Real-World Scenario Demo

This demo shows how Sports Integrity Bonds would work with actual
sports scenarios from recent NBA/NFL seasons.

Philosophy: Making sports real and meaningful again through economic incentives.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum
from datetime import datetime, timedelta


class IntegrityLevel(Enum):
    TANKING = "Tanking"
    QUESTIONABLE = "Questionable"
    COMPETITIVE = "Competitive"
    ELITE = "Elite"


class TeamworkLevel(Enum):
    STAT_CHASER = "Stat Chaser"
    NEUTRAL = "Neutral"
    TEAM_PLAYER = "Team Player"
    CHAMPION = "Champion"


class ViolationType(Enum):
    NONE = "None"
    MATCH_FIXING = "Match Fixing"
    PED_USAGE = "PED Usage"
    GAMBLING = "Gambling Violation"
    LOAD_MANAGEMENT = "Load Management Abuse"
    TANKING = "Tanking Participation"


@dataclass
class EffortMetrics:
    hustle_score: int  # 0-100
    fourth_quarter_score: int  # 0-100
    back_to_back_score: int  # 0-100
    big_game_score: int  # 0-100

    def average(self) -> int:
        return (self.hustle_score + self.fourth_quarter_score +
                self.back_to_back_score + self.big_game_score) // 4


@dataclass
class TankingDetection:
    win_probability_delta: int  # 0-100 (higher = more tanking)
    suspicious_injury_score: int  # 0-100
    fourth_quarter_quit_score: int  # 0-100
    season_trajectory_score: int  # 0-100 (lower = gave up)

    def tanking_likelihood(self) -> int:
        """Returns 0-100 score where higher = more likely tanking"""
        return (self.win_probability_delta + self.suspicious_injury_score +
                self.fourth_quarter_quit_score + (100 - self.season_trajectory_score)) // 4


@dataclass
class ChemistryMetrics:
    assist_ratio: int  # 0-100
    defensive_effort: int  # 0-100
    bench_support: int  # 0-100
    plus_minus_differential: int  # 0-100

    def average(self) -> int:
        return (self.assist_ratio + self.defensive_effort +
                self.bench_support + self.plus_minus_differential) // 4


@dataclass
class WinningVsStats:
    performance_in_wins: int  # 0-100
    performance_in_losses: int  # 0-100
    clutch_performance: int  # 0-100
    sacrifice_score: int  # 0-100
    stat_padding_detected: bool = False

    def win_priority_score(self) -> int:
        """Higher score = prioritizes winning over stats"""
        win_loss_delta = abs(self.performance_in_wins - self.performance_in_losses)
        # Performing better in losses = stat padding indicator
        if self.performance_in_losses > self.performance_in_wins + 30:
            self.stat_padding_detected = True
            return 20  # Severe penalty

        base_score = (100 - win_loss_delta + self.clutch_performance + self.sacrifice_score) // 3
        return base_score


@dataclass
class CompetitiveIntegrityBond:
    team_name: str
    league: str
    season: str
    stake_amount: float
    created_at: datetime
    season_end_date: datetime
    effort_metrics: List[EffortMetrics] = field(default_factory=list)
    tanking_detections: List[TankingDetection] = field(default_factory=list)

    def calculate_integrity_level(self) -> IntegrityLevel:
        if not self.effort_metrics or not self.tanking_detections:
            return IntegrityLevel.QUESTIONABLE

        effort_score = sum(m.average() for m in self.effort_metrics) // len(self.effort_metrics)
        tanking_score = 100 - (sum(d.tanking_likelihood() for d in self.tanking_detections) //
                               len(self.tanking_detections))

        overall_score = (effort_score + tanking_score) // 2

        if overall_score >= 80:
            return IntegrityLevel.ELITE
        elif overall_score >= 60:
            return IntegrityLevel.COMPETITIVE
        elif overall_score >= 40:
            return IntegrityLevel.QUESTIONABLE
        else:
            return IntegrityLevel.TANKING

    def calculate_distribution(self) -> Dict[str, float]:
        level = self.calculate_integrity_level()

        if level == IntegrityLevel.TANKING:
            # 0% to team, 100% to fans
            return {
                "team_share": 0.0,
                "players_share": 0.0,
                "fans_share": self.stake_amount,
                "total": self.stake_amount
            }
        elif level == IntegrityLevel.QUESTIONABLE:
            # 10% appreciation, mostly to fans
            total = self.stake_amount * 1.1
            return {
                "team_share": total * 0.2,
                "players_share": total * 0.1,
                "fans_share": total * 0.7,
                "total": total
            }
        elif level == IntegrityLevel.COMPETITIVE:
            # 50% appreciation, shared
            total = self.stake_amount * 1.5
            return {
                "team_share": total * 0.4,
                "players_share": total * 0.3,
                "fans_share": total * 0.3,
                "total": total
            }
        else:  # ELITE
            # 100% appreciation
            total = self.stake_amount * 2.0
            return {
                "team_share": total * 0.5,
                "players_share": total * 0.3,
                "fans_share": total * 0.2,
                "total": total
            }


@dataclass
class TeamworkIntegrityBond:
    player_name: str
    team_name: str
    league: str
    season: str
    stake_amount: float
    created_at: datetime
    season_end_date: datetime
    chemistry_metrics: List[ChemistryMetrics] = field(default_factory=list)
    winning_metrics: List[WinningVsStats] = field(default_factory=list)

    def calculate_teamwork_level(self) -> TeamworkLevel:
        if not self.chemistry_metrics or not self.winning_metrics:
            return TeamworkLevel.NEUTRAL

        chemistry_score = sum(m.average() for m in self.chemistry_metrics) // len(self.chemistry_metrics)
        win_priority_score = sum(m.win_priority_score() for m in self.winning_metrics) // len(self.winning_metrics)

        overall_score = (chemistry_score + win_priority_score) // 2

        if overall_score >= 85:
            return TeamworkLevel.CHAMPION
        elif overall_score >= 70:
            return TeamworkLevel.TEAM_PLAYER
        elif overall_score >= 40:
            return TeamworkLevel.NEUTRAL
        else:
            return TeamworkLevel.STAT_CHASER

    def calculate_distribution(self) -> Dict[str, float]:
        level = self.calculate_teamwork_level()

        if level == TeamworkLevel.STAT_CHASER:
            # 0% to player, 100% to teammates
            return {
                "player_share": 0.0,
                "teammates_share": self.stake_amount,
                "fans_share": 0.0,
                "total": self.stake_amount
            }
        elif level == TeamworkLevel.NEUTRAL:
            # 10% appreciation, mostly to teammates
            total = self.stake_amount * 1.1
            return {
                "player_share": total * 0.3,
                "teammates_share": total * 0.5,
                "fans_share": total * 0.2,
                "total": total
            }
        elif level == TeamworkLevel.TEAM_PLAYER:
            # 60% appreciation
            total = self.stake_amount * 1.6
            return {
                "player_share": total * 0.6,
                "teammates_share": total * 0.3,
                "fans_share": total * 0.1,
                "total": total
            }
        else:  # CHAMPION
            # 120% appreciation
            total = self.stake_amount * 2.2
            return {
                "player_share": total * 0.6,
                "teammates_share": total * 0.3,
                "fans_share": total * 0.1,
                "total": total
            }


@dataclass
class FanBeliefBond:
    fan_name: str
    player_or_team_name: str
    bond_type: str  # "player" or "team"
    league: str
    stake_amount: float
    years: int
    created_at: datetime
    integrity_snapshots: List[int] = field(default_factory=list)  # 0-100 scores
    violation: Optional[ViolationType] = None

    def calculate_time_multiplier(self) -> float:
        if self.years >= 5:
            return 5.0
        elif self.years >= 3:
            return 4.0
        elif self.years >= 2:
            return 3.0
        elif self.years >= 1:
            return 2.0
        return 1.0

    def calculate_integrity_score(self) -> int:
        if not self.integrity_snapshots:
            return 50
        return sum(self.integrity_snapshots) // len(self.integrity_snapshots)

    def calculate_payout(self) -> float:
        if self.violation and self.violation != ViolationType.NONE:
            # Corruption detected - forfeit based on violation type
            penalties = {
                ViolationType.MATCH_FIXING: 1.0,  # 100% forfeit
                ViolationType.PED_USAGE: 0.8,  # 80% forfeit
                ViolationType.GAMBLING: 0.7,  # 70% forfeit
                ViolationType.LOAD_MANAGEMENT: 0.3,  # 30% forfeit
                ViolationType.TANKING: 0.5,  # 50% forfeit
            }
            return self.stake_amount * (1 - penalties.get(self.violation, 1.0))

        integrity_score = self.calculate_integrity_score()
        time_mult = self.calculate_time_multiplier()

        # Base multiplier based on integrity
        if integrity_score >= 85:
            base_mult = 2.0  # 200%
        elif integrity_score >= 70:
            base_mult = 1.5  # 150%
        elif integrity_score >= 50:
            base_mult = 1.0  # 100%
        elif integrity_score >= 30:
            base_mult = 0.5  # 50%
        else:
            return 0.0  # Too low

        # 5-year clean bonus
        clean_bonus = 1.2 if self.years >= 5 and integrity_score >= 80 else 1.0

        return self.stake_amount * base_mult * time_mult * clean_bonus


def print_section(title: str):
    print(f"\n{'=' * 80}")
    print(f" {title}")
    print(f"{'=' * 80}\n")


def scenario_1_elite_competitive_team():
    """Scenario 1: 2024 Denver Nuggets - Elite competitive team"""
    print_section("Scenario 1: Elite Competitive Team (2024 Denver Nuggets)")

    bond = CompetitiveIntegrityBond(
        team_name="Denver Nuggets",
        league="NBA",
        season="2024-25",
        stake_amount=10_000_000.0,  # $10M stake
        created_at=datetime(2024, 10, 1),
        season_end_date=datetime(2025, 4, 15)
    )

    # Add elite effort metrics
    bond.effort_metrics = [
        EffortMetrics(90, 95, 88, 98),  # Game 1
        EffortMetrics(92, 93, 90, 95),  # Game 2
        EffortMetrics(88, 90, 85, 92),  # Game 3
        EffortMetrics(91, 94, 89, 96),  # Average season
    ]

    # No tanking detected
    bond.tanking_detections = [
        TankingDetection(
            win_probability_delta=10,  # Met win expectations
            suspicious_injury_score=5,  # No suspicious rests
            fourth_quarter_quit_score=8,  # Minimal giving up
            season_trajectory_score=92  # Strong finish
        )
    ]

    level = bond.calculate_integrity_level()
    distribution = bond.calculate_distribution()

    print(f"Team: {bond.team_name}")
    print(f"Stake: ${bond.stake_amount:,.0f}")
    print(f"Integrity Level: {level.value}")
    print(f"\nDistribution:")
    print(f"  Team Share:    ${distribution['team_share']:,.2f} (50%)")
    print(f"  Players Share: ${distribution['players_share']:,.2f} (30%)")
    print(f"  Fans Share:    ${distribution['fans_share']:,.2f} (20%)")
    print(f"  Total Value:   ${distribution['total']:,.2f} (+100% appreciation)")
    print(f"\n✅ EVERYONE WINS when teams compete with elite effort!")


def scenario_2_tanking_team():
    """Scenario 2: 2024 Detroit Pistons - Obvious tanking"""
    print_section("Scenario 2: Tanking Team (2024 Detroit Pistons)")

    bond = CompetitiveIntegrityBond(
        team_name="Detroit Pistons",
        league="NBA",
        season="2023-24",
        stake_amount=10_000_000.0,
        created_at=datetime(2023, 10, 1),
        season_end_date=datetime(2024, 4, 15)
    )

    # Terrible effort metrics
    bond.effort_metrics = [
        EffortMetrics(20, 15, 25, 10),  # Not trying
        EffortMetrics(18, 12, 20, 8),
        EffortMetrics(22, 18, 23, 12),
        EffortMetrics(19, 14, 21, 9),
    ]

    # Obvious tanking
    bond.tanking_detections = [
        TankingDetection(
            win_probability_delta=70,  # Way below expectations
            suspicious_injury_score=85,  # Stars resting constantly
            fourth_quarter_quit_score=90,  # Gave up constantly
            season_trajectory_score=15  # Gave up early
        )
    ]

    level = bond.calculate_integrity_level()
    distribution = bond.calculate_distribution()

    print(f"Team: {bond.team_name}")
    print(f"Stake: ${bond.stake_amount:,.0f}")
    print(f"Integrity Level: {level.value}")
    print(f"\nDistribution:")
    print(f"  Team Share:    ${distribution['team_share']:,.2f} (0%)")
    print(f"  Players Share: ${distribution['players_share']:,.2f} (0%)")
    print(f"  Fans Share:    ${distribution['fans_share']:,.2f} (100% compensation)")
    print(f"  Total Value:   ${distribution['total']:,.2f}")
    print(f"\n❌ TANKING IS EXPENSIVE - Fans compensated for watching garbage basketball!")


def scenario_3_team_player():
    """Scenario 3: 2024 Nikola Jokic - Elite team player"""
    print_section("Scenario 3: Elite Team Player (Nikola Jokic 2023-24)")

    bond = TeamworkIntegrityBond(
        player_name="Nikola Jokic",
        team_name="Denver Nuggets",
        league="NBA",
        season="2023-24",
        stake_amount=1_000_000.0,
        created_at=datetime(2023, 10, 1),
        season_end_date=datetime(2024, 4, 15)
    )

    # Elite chemistry
    bond.chemistry_metrics = [
        ChemistryMetrics(95, 92, 98, 94),  # High assists, great defense, supports team
        ChemistryMetrics(93, 90, 96, 92),
        ChemistryMetrics(94, 91, 97, 93),
    ]

    # Prioritizes winning
    bond.winning_metrics = [
        WinningVsStats(
            performance_in_wins=95,
            performance_in_losses=90,  # Consistent
            clutch_performance=98,  # Shows up in big moments
            sacrifice_score=95,  # Takes charges, sets screens
            stat_padding_detected=False
        )
    ]

    level = bond.calculate_teamwork_level()
    distribution = bond.calculate_distribution()

    print(f"Player: {bond.player_name}")
    print(f"Team: {bond.team_name}")
    print(f"Stake: ${bond.stake_amount:,.0f}")
    print(f"Teamwork Level: {level.value}")
    print(f"\nDistribution:")
    print(f"  Player Share:     ${distribution['player_share']:,.2f} (60%)")
    print(f"  Teammates Share:  ${distribution['teammates_share']:,.2f} (30%)")
    print(f"  Fans Share:       ${distribution['fans_share']:,.2f} (10%)")
    print(f"  Total Value:      ${distribution['total']:,.2f} (+120% appreciation)")
    print(f"\n✅ ELITE TEAM PLAYER - Makes everyone better, maximum appreciation!")


def scenario_4_stat_chaser():
    """Scenario 4: Hypothetical stat padding player"""
    print_section("Scenario 4: Stat Chaser (Hypothetical)")

    bond = TeamworkIntegrityBond(
        player_name="Stat Chaser Example",
        team_name="Struggling Team",
        league="NBA",
        season="2024-25",
        stake_amount=1_000_000.0,
        created_at=datetime(2024, 10, 1),
        season_end_date=datetime(2025, 4, 15)
    )

    # Poor chemistry
    bond.chemistry_metrics = [
        ChemistryMetrics(30, 25, 20, 15),  # Low assists, poor defense, doesn't celebrate
        ChemistryMetrics(28, 22, 18, 12),
    ]

    # Obvious stat padding
    bond.winning_metrics = [
        WinningVsStats(
            performance_in_wins=50,  # Mediocre when winning
            performance_in_losses=95,  # Great stats in blowouts!
            clutch_performance=20,  # Disappears in big moments
            sacrifice_score=10,  # Won't sacrifice for team
            stat_padding_detected=True
        )
    ]

    level = bond.calculate_teamwork_level()
    distribution = bond.calculate_distribution()

    print(f"Player: {bond.player_name}")
    print(f"Team: {bond.team_name}")
    print(f"Stake: ${bond.stake_amount:,.0f}")
    print(f"Teamwork Level: {level.value}")
    print(f"\nDistribution:")
    print(f"  Player Share:     ${distribution['player_share']:,.2f} (0%)")
    print(f"  Teammates Share:  ${distribution['teammates_share']:,.2f} (100% compensation)")
    print(f"  Fans Share:       ${distribution['fans_share']:,.2f}")
    print(f"  Total Value:      ${distribution['total']:,.2f}")
    print(f"\n❌ STAT PADDING DETECTED - Teammates compensated for dealing with selfish play!")


def scenario_5_long_term_belief():
    """Scenario 5: 5-year fan belief in LeBron James"""
    print_section("Scenario 5: Long-Term Fan Belief (LeBron James 2018-2023)")

    bond = FanBeliefBond(
        fan_name="Loyal Fan",
        player_or_team_name="LeBron James",
        bond_type="player",
        league="NBA",
        stake_amount=10_000.0,  # $10k stake
        years=5,
        created_at=datetime(2018, 10, 1)
    )

    # 5 years of elite integrity snapshots
    bond.integrity_snapshots = [85, 88, 90, 87, 89]  # Consistent excellence
    bond.violation = None  # Clean record

    payout = bond.calculate_payout()
    time_mult = bond.calculate_time_multiplier()
    integrity_score = bond.calculate_integrity_score()

    print(f"Fan: {bond.fan_name}")
    print(f"Player: {bond.player_or_team_name}")
    print(f"Stake: ${bond.stake_amount:,.2f}")
    print(f"Years: {bond.years}")
    print(f"Integrity Score: {integrity_score}/100")
    print(f"Time Multiplier: {time_mult}x")
    print(f"5-Year Clean Bonus: +20%")
    print(f"\nPayout: ${payout:,.2f}")
    print(f"Return: {((payout / bond.stake_amount - 1) * 100):.1f}% gain")
    print(f"\n✅ LONG-TERM BELIEF REWARDED - 5 years of sustained integrity!")


def scenario_6_corruption_detected():
    """Scenario 6: Player caught gambling"""
    print_section("Scenario 6: Corruption Detected (Gambling Violation)")

    bond = FanBeliefBond(
        fan_name="Unlucky Fan",
        player_or_team_name="Corrupt Player",
        bond_type="player",
        league="NBA",
        stake_amount=5_000.0,
        years=1,
        created_at=datetime(2024, 10, 1)
    )

    # Started well, then caught gambling
    bond.integrity_snapshots = [80, 75]
    bond.violation = ViolationType.GAMBLING  # 70% forfeit

    payout = bond.calculate_payout()
    forfeited = bond.stake_amount - payout

    print(f"Fan: {bond.fan_name}")
    print(f"Player: {bond.player_or_team_name}")
    print(f"Stake: ${bond.stake_amount:,.2f}")
    print(f"Violation: {bond.violation.value}")
    print(f"\nPayout: ${payout:,.2f}")
    print(f"Forfeited: ${forfeited:,.2f} (70%)")
    print(f"Redistribution: Forfeited amount goes to other fans in pool")
    print(f"\n❌ ZERO TOLERANCE - Corruption destroys bonds!")


def scenario_7_load_management():
    """Scenario 7: Load management abuse"""
    print_section("Scenario 7: Load Management Abuse")

    bond = FanBeliefBond(
        fan_name="Disappointed Fan",
        player_or_team_name="Load Management Star",
        bond_type="player",
        league="NBA",
        stake_amount=3_000.0,
        years=2,
        created_at=datetime(2023, 10, 1)
    )

    # Decent when playing, but misses too many games
    bond.integrity_snapshots = [70, 65, 60]  # Declining due to absences
    bond.violation = ViolationType.LOAD_MANAGEMENT  # 30% forfeit

    payout = bond.calculate_payout()
    forfeited = bond.stake_amount - payout

    print(f"Fan: {bond.fan_name}")
    print(f"Player: {bond.player_or_team_name}")
    print(f"Stake: ${bond.stake_amount:,.2f}")
    print(f"Violation: {bond.violation.value}")
    print(f"\nPayout: ${payout:,.2f}")
    print(f"Forfeited: ${forfeited:,.2f} (30%)")
    print(f"\n⚠️ LOAD MANAGEMENT ABUSE - Fans paid to watch someone who doesn't show up!")


def main():
    print("\n")
    print("=" * 80)
    print(" SPORTS INTEGRITY BONDS - Real-World Scenario Demonstrations")
    print(" Making Sports Real and Meaningful Again")
    print("=" * 80)

    # Run all scenarios
    scenario_1_elite_competitive_team()
    scenario_2_tanking_team()
    scenario_3_team_player()
    scenario_4_stat_chaser()
    scenario_5_long_term_belief()
    scenario_6_corruption_detected()
    scenario_7_load_management()

    # Summary
    print_section("Summary: Why Sports Integrity Bonds Work")
    print("✅ ECONOMIC ALIGNMENT:")
    print("   - Teams earn more by competing than tanking")
    print("   - Players earn more by being team-first than stat chasing")
    print("   - Leagues earn more by maintaining integrity")
    print("   - Fans are rewarded for long-term belief in authentic players/teams")
    print()
    print("✅ COMMUNITY VERIFICATION:")
    print("   - Fans from BOTH teams must agree games are competitive")
    print("   - Teammates verify culture contribution (anonymous)")
    print("   - Geographic verification prevents brigading")
    print("   - NFT ticket stubs prove attendance")
    print()
    print("✅ ZERO TOLERANCE FOR CORRUPTION:")
    print("   - Match-fixing = 100% bond forfeiture")
    print("   - PEDs = 80% forfeiture")
    print("   - Gambling = 70% forfeiture")
    print("   - Load management abuse = 30% forfeiture")
    print("   - Tanking = fans compensated")
    print()
    print("✅ NO SURVEILLANCE:")
    print("   - Public stats only (already available)")
    print("   - Community attestation (what fans witnessed)")
    print("   - Anonymous aggregate surveys (no individual tracking)")
    print("   - Transparent algorithms (no black box)")
    print()
    print("=" * 80)
    print(" Sports can be REAL again. The technology exists.")
    print(" Now it's time to implement it.")
    print("=" * 80)
    print()


if __name__ == "__main__":
    main()
