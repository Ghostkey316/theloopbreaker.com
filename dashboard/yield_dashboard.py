"""Streamlit dashboard for visualising yield case studies."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pandas as pd
import streamlit as st

from yield_pipeline.converter import load_case_studies

st.set_page_config(page_title="Vaultfire Yield Dashboard", layout="wide")
st.title("Vaultfire Yield Case Studies")
st.caption("Ethical, scalable, transparent insights from mission activations.")

case_study_dir = Path(st.sidebar.text_input("Case study directory", "public/case_studies"))

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
