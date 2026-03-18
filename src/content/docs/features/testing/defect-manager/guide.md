---
sidebar_position: 2
title: "How to Use the Defect Manager"
---

# How to Use the Defect Manager

This guide walks you through triaging, classifying, and tracking defects with AI assistance.

## Step 1: Connect Your Data Source

Connect to Jira or Azure DevOps and select the project to pull defects from. The system imports all bug-type issues with their descriptions, priorities, and metadata.

## Step 2: Review AI-Assisted Triage

For each defect, the system provides:

- **Severity classification** — AI-suggested severity based on description, affected area, and user impact
- **Root cause analysis** — Likely root cause category (code defect, configuration, data, integration, etc.)
- **Duplicate detection** — Flags potential duplicates with similarity scores
- **Affected area** — Which part of the system is impacted

## Step 3: Take Action

- Accept or override AI classifications
- Group related defects by root cause pattern
- Assign priorities and owners
- Track resolution progress across sprints

## Step 4: Monitor Trends

Track defect trends over time:

- New vs. resolved defect rates
- Mean time to resolution by severity
- Root cause distribution — spot systemic patterns
- Quality trend direction — improving or degrading

## Tips

- Run duplicate detection before sprint planning — it often cuts the apparent defect count by 10-20%
- Pay attention to root cause patterns — if 40% of defects trace to the same subsystem, that's a systemic issue worth addressing
- Use severity classification as a starting point — your team's domain expertise should validate or override AI suggestions
- Feed Defect Manager data into Release Readiness for a complete quality picture before shipping
