# Community Natural Treatments Database

This folder stores a community-driven dataset of natural and alternative treatments. Entries are version controlled and contributed via pull requests.

## Data Format
- **condition**: health issue that the treatment targets
- **treatment**: short name for the remedy
- **ingredients**: list of core ingredients
- **effectiveness_score**: 0-1 scale based on supporting evidence
- **source**: open-access study or community reference

See `data/treatments.json` for sample entries. Use `query.py` to filter by condition or ingredient.

## Contributing
1. Fork the repository and create a new branch.
2. Add your treatment to `data/treatments.json` following the existing structure.
3. Open a pull request describing your source and evidence.

## Disclaimers
- This information is for educational purposes only.
- It is **not** a substitute for professional medical advice.
- Effectiveness scores are community reported and may not be independently verified.
