from __future__ import annotations

from pathlib import Path

from setuptools import find_packages, setup

PACKAGE_ROOT = Path(__file__).parent

setup(
    name="vaultfire-sdk",
    version="0.1.0",
    description="Dual Python/JS SDK for Vaultfire attestation pilots",
    long_description=(PACKAGE_ROOT / "README.md").read_text(encoding="utf-8"),
    long_description_content_type="text/markdown",
    packages=find_packages(include=["vaultfire_sdk", "vaultfire_sdk.*"]),
    package_dir={"": "."},
    include_package_data=True,
    python_requires=">=3.10",
    install_requires=[
        "numpy>=1.23",
    ],
)
