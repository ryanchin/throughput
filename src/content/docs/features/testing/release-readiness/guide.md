---
sidebar_position: 2
title: "How to Use Release Readiness"
---

# How to Use Release Readiness

This guide walks you through assessing whether a release is safe to ship using live project data.

## Step 1: Select the Release

Choose the sprint or release you want to evaluate. The system pulls in completed items, open defects, and sprint metrics from your connected Jira or Azure DevOps instance.

## Step 2: Configure Quality Gates

Set the quality gates that must be met for a release to pass. Common gates include:

- **Zero open critical/blocker defects**
- **Sprint completion above threshold** (e.g., 80% of committed points delivered)
- **No regressions** — Previously resolved defects have not reopened
- **Documentation complete** — Release notes and migration guides are ready

Adjust thresholds to match your organization's risk tolerance.

## Step 3: Review the Assessment

The dashboard shows:

- **Quality gate status** — Pass/fail for each configured gate
- **Open defect summary** — By severity, with links to the source issues
- **Sprint completion metrics** — Points committed vs. delivered
- **Risk flags** — Items that introduce risk even if gates pass
- **Go/No-Go recommendation** — With confidence level and supporting evidence

## Step 4: Generate Release Report

Generate a release readiness report for sign-off. The report includes all gate statuses, risk assessment, defect summary, and the final recommendation — ready for stakeholder approval.

## Tips

- Configure quality gates once and reuse across sprints — consistency is more valuable than perfection
- Don't ignore "Conditional Go" recommendations — they indicate manageable but real risk
- Run Release Readiness as part of your standard release process, not as an afterthought
- Use the generated report as your release sign-off artifact for auditing and compliance
