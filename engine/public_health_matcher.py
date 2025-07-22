"""Search public health data for studies related to a symptom."""
from __future__ import annotations

import json
from typing import List, Dict
from pathlib import Path

try:
    import requests
except Exception:  # pragma: no cover - requests may not be installed
    requests = None


BASE_URL_PUBMED = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
BASE_URL_CT = "https://clinicaltrials.gov/api/query/study_fields"

# Simple local fallback data for natural remedies and diet suggestions
_REMEDIES_PATH = Path(__file__).resolve().parents[1] / "docs" / "natural_remedies.json"
_DIET_PATH = Path(__file__).resolve().parents[1] / "docs" / "dietary_recs.json"


def _load_json(path: Path) -> dict:
    if path.exists():
        try:
            with open(path) as f:
                return json.load(f)
        except json.JSONDecodeError:
            return {}
    return {}


NATURAL_REMEDIES = _load_json(_REMEDIES_PATH)
DIETARY_RECS = _load_json(_DIET_PATH)


def _fetch_json(url: str, params: dict) -> dict:
    if not requests:
        raise RuntimeError("requests library not available")
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    return response.json()


def search_pubmed(symptom: str) -> List[Dict]:
    """Return a list of PubMed summaries for the symptom."""
    params = {"db": "pubmed", "term": symptom, "retmode": "json", "retmax": 5}
    data = _fetch_json(f"{BASE_URL_PUBMED}/esearch.fcgi", params)
    ids = data.get("esearchresult", {}).get("idlist", [])
    results = []
    if ids:
        summary = _fetch_json(
            f"{BASE_URL_PUBMED}/esummary.fcgi",
            {"db": "pubmed", "id": ",".join(ids), "retmode": "json"},
        )
        for k in summary.get("result", {}):
            if k == "uids":
                continue
            item = summary["result"][k]
            results.append(
                {
                    "title": item.get("title"),
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{item.get('uid')}/",
                    "source": "PubMed",
                    "category": "clinical trial" if "Trial" in item.get("pubtype", []) else "study",
                    "confidence": 0.7,
                }
            )
    return results


def search_clinical_trials(symptom: str) -> List[Dict]:
    """Return a list of clinical trial summaries."""
    params = {
        "expr": symptom,
        "fields": "NCTId,BriefTitle,Condition,InterventionName",
        "max_rnk": 5,
        "fmt": "json",
    }
    data = _fetch_json(BASE_URL_CT, params)
    studies = data.get("StudyFieldsResponse", {}).get("StudyFields", [])
    results = []
    for s in studies:
        results.append(
            {
                "title": s.get("BriefTitle", ["Unknown"])[0],
                "url": f"https://clinicaltrials.gov/ct2/show/{s.get('NCTId', [''])[0]}",
                "source": "ClinicalTrials.gov",
                "category": "clinical trial",
                "confidence": 0.8,
            }
        )
    return results


def natural_remedies(symptom: str) -> List[Dict]:
    """Return natural remedy recommendations."""
    remedies = NATURAL_REMEDIES.get(symptom.lower(), [])
    return [
        {
            "title": r,
            "source": "Local dataset",
            "category": "natural remedy",
            "confidence": 0.5,
        }
        for r in remedies
    ]


def dietary_recommendations(symptom: str) -> List[Dict]:
    """Return dietary recommendations."""
    recs = DIETARY_RECS.get(symptom.lower(), [])
    return [
        {
            "title": r,
            "source": "Local dataset",
            "category": "dietary recommendation",
            "confidence": 0.4,
        }
        for r in recs
    ]


def match_symptom(symptom: str) -> List[Dict]:
    """Aggregate results from various sources."""
    results: List[Dict] = []
    try:
        results.extend(search_pubmed(symptom))
    except Exception:
        pass
    try:
        results.extend(search_clinical_trials(symptom))
    except Exception:
        pass
    results.extend(natural_remedies(symptom))
    results.extend(dietary_recommendations(symptom))
    return results


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 public_health_matcher.py 'symptom'")
        sys.exit(1)

    matches = match_symptom(sys.argv[1])
    print(json.dumps(matches, indent=2))
