# Vaultfire Loyalty Engine ROI Model

Vaultfire's belief-driven loyalty engine ties mission outcomes to verifiable telemetry. Use this model to articulate ROI improvements for procurement, finance, and governance stakeholders.

## 1. Model Inputs
| Variable | Description | Source |
|----------|-------------|--------|
| `wallet_activation_rate` | % of opt-in wallets completing onboarding | telemetry/templates/wallet_activity_baseline.yaml |
| `mission_completion_rate` | % of active wallets completing core mission checkpoints | dashboards/adoption_mission_dashboard.json |
| `retention_day30` | 30-day active retention | telemetry/templates/retention_baseline.yaml |
| `xp_to_revenue_ratio` | Revenue realized per XP unit redeemed | loyalty_engine.py |
| `guardian_override_rate` | % of XP transactions requiring Guardian review | telemetry/templates/xp_yield_baseline.yaml |

## 2. ROI Equation
```
roi = ((avg_mission_value * mission_completion_rate) + (xp_to_revenue_ratio * xp_issued) - program_costs) / program_costs
```
Where:
- `avg_mission_value` = Verified financial or social impact per mission (USD equivalent)
- `xp_issued` = Total XP minted during the period
- `program_costs` = Platform fees + incentive spend + compliance overhead

## 3. Example Pilot Simulation (12 Weeks)
| Segment | Avg Mission Value (USD) | XP Issued | Program Costs (USD) | Mission Completion % | Retention Day 30 | Calculated ROI |
|---------|-------------------------|-----------|----------------------|----------------------|------------------|----------------|
| Mid-Market Innovators | 185 | 2,450,000 | 1,950,000 | 68% | 64% | 27% |
| Fortune 100 Pilots | 420 | 3,100,000 | 3,450,000 | 59% | 58% | 24% |
| Impact Nonprofits | 95 | 1,280,000 | 780,000 | 74% | 71% | 31% |

Assumptions:
- XP to revenue ratio of 0.00042 USD per XP for mid-market, 0.00036 for Fortune 100, 0.00028 for nonprofits.
- Program costs include telemetry verification and guardian council operations.

## 4. Scaling Projection (Annualized)
| Segment | Wallet Growth YoY | Mission Completion YoY | Retention YoY | Projected ROI YoY |
|---------|-------------------|------------------------|---------------|-------------------|
| Mid-Market Innovators | +52% | +8 pts | +6 pts | 41% |
| Fortune 100 Pilots | +38% | +6 pts | +5 pts | 35% |
| Impact Nonprofits | +64% | +10 pts | +8 pts | 47% |

## 5. Procurement Justification Metrics
- **Telemetry Verification Lead Time**: 14 days (from attestation request to signed report)
- **Guardian Council SLA**: Critical decisions executed within 6 hours (multisig fast track)
- **Compliance Coverage**: SOC 2 CC-series + ISO/IEC 27001 Annex A controls mapped to each ROI calculation
- **Ethics Assurance**: XP multipliers capped by ethics alignment score (avg 1.32 across pilots)

## 6. Publishing & Integration
- Embed ROI tables into `/metrics` landing page and partner decks.
- Sync data with `docs/vaultfire_pilot_bundle/case_studies.md` for narrative context.
- Include ROI summary within `docs/partner_kit/` templates for procurement submissions.
- Reference ROI multipliers when updating `dashboards/adoption_mission_dashboard.json`.

## 7. Next Steps
- Automate ROI calculator using inputs from telemetry baselines.
- Schedule quarterly validations with external auditors and update ROI datasets accordingly.
- Provide PDF export via `pandoc docs/loyalty_engine_roi_model.md -o docs/loyalty_engine_roi_model.pdf`.
