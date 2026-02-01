# Repo Hygiene Notes

This repo is used as a **reference implementation** and a **standard template**. That means the repository itself needs to be legible and intentional.

## Duplicate file content
A duplicate-content scan (SHA256) is tracked in:
- `docs/AUDIT_DUPLICATE_FILES.txt`

Duplicates fall into a few categories:

### 1) Expected placeholders
- `.gitkeep`
- empty `__init__.py`
- placeholder `*.lock`

These exist to ensure directories are present and to preserve expected layout.

### 2) Template / empty-state JSON
Several JSON/log files are byte-identical. These are treated as **empty-state templates** (e.g., “no events yet”).

Policy:
- If a file is intended as a template: keep it, but keep it *clearly empty*.
- If a file is intended as a live artifact: it should not be tracked in git.

### 3) Real duplicates that should be consolidated
If we find files that are not templates/placeholders and are duplicated by accident, we should:
- consolidate to a single canonical file
- update references
- add a short note to the audit report

## What we do NOT do
- We do not delete files just to reduce duplicate count.
- We do not rename/move files if it will break existing code paths without a clear migration.

## Quick contributor checklist
Before pushing:
- `npm test`
- `npm run lint:guardrails`
- `npm run lint:values`
- (optional) `npm run preflight`
