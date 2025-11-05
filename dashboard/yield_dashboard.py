"""Streamlit dashboard for visualising yield case studies."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st

from yield_pipeline.converter import load_case_studies

st.set_page_config(page_title="Vaultfire Yield Dashboard", layout="wide")
st.title("Vaultfire Yield Case Studies")
st.caption("Ethical, scalable, transparent insights from mission activations.")

case_study_dir = Path(st.sidebar.text_input("Case study directory", "public/case_studies"))
component_name = st.sidebar.text_input("React component name", "YieldMobileInsights")
preview_limit = st.sidebar.slider("Mobile card count", min_value=3, max_value=12, value=5)

try:
    studies = load_case_studies(case_study_dir)
except FileNotFoundError:
    st.error("No case studies found. Run the pipeline first.")
    st.stop()

if not studies:
    st.warning("Case study directory is empty. Generate insights to continue.")
    st.stop()

data = [study.model_dump(mode="json") for study in studies]
frame = pd.DataFrame(data)
frame["timestamp"] = pd.to_datetime(frame["timestamp"])

segments = sorted(frame["belief_segment"].unique())
selected_segments = st.sidebar.multiselect("Belief segments", segments, default=segments)
start_date = st.sidebar.date_input("Start date", value=frame["timestamp"].min().date())
end_date = st.sidebar.date_input("End date", value=frame["timestamp"].max().date())

mask = (
    frame["belief_segment"].isin(selected_segments)
    & (frame["timestamp"] >= datetime.combine(start_date, datetime.min.time()))
    & (frame["timestamp"] <= datetime.combine(end_date, datetime.max.time()))
)
filtered = frame.loc[mask]

st.metric("Total missions", len(filtered))
st.metric("Average Ghostscore ROI", round(filtered["ghostscore_roi"].mean(), 2))

st.bar_chart(filtered.groupby("yield_classification")["ghostscore_roi"].mean())
st.dataframe(filtered.sort_values("timestamp", ascending=False), use_container_width=True)


def _build_react_component(name: str, dataset: pd.DataFrame) -> str:
    highlights = dataset.sort_values("timestamp", ascending=False).head(preview_limit)
    records = highlights[[
        "mission_hash",
        "belief_segment",
        "ghostscore_roi",
        "yield_classification",
        "trigger_summary",
    ]].to_dict(orient="records")
    insights_json = json.dumps(records, indent=2)
    return f"""import React from 'react';

const {name} = () => {{
  const insights = {insights_json};
  return (
    <section className=\"vf-mobile-yield\">
      {{insights.map((entry) => (
        <article key={{entry.mission_hash}} className=\"vf-mobile-card\">
          <h3>{{entry.belief_segment}}</h3>
          <p className=\"vf-mission\">Mission: {{entry.mission_hash.slice(0, 10)}}&hellip;</p>
          <p className=\"vf-roi\">Ghostscore ROI: {{entry.ghostscore_roi.toFixed(2)}}%</p>
          <p className=\"vf-yield\">Yield class: {{entry.yield_classification}}</p>
          <p className=\"vf-trigger\">Trigger: {{entry.trigger_summary}}</p>
        </article>
      ))}}
    </section>
  );
}};

export default {name};
"""


component_source = _build_react_component(component_name, filtered)
st.subheader("Mobile React component export")
st.code(component_source, language="javascript")
st.download_button(
    label="Download React component",
    file_name=f"{component_name}.jsx",
    mime="text/javascript",
    data=component_source,
)
