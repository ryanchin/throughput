---
sidebar_position: 2
title: "How to Use the Epic Creator"
---

# How to Use the Epic Creator

This guide walks you through generating a complete epic with decomposed features and user stories.

## Step 1: Provide Input

- **Title** (required) — Clear name for the epic
- **Description** (required) — What this epic covers and why it matters

Import context from Ideation, Scope Definition, Goal sessions, PRDs, or Competitive Analysis. Optionally attach knowledge bases and files.

### Examples of Great Input

**Title:** "Enterprise Customer Health Dashboard"

**Description:** "Build a comprehensive customer health scoring system that aggregates product usage, support ticket volume, NPS responses, and billing data into a single dashboard. Enable CSMs to set custom health thresholds per account tier, receive automated alerts when accounts trend toward at-risk status, and generate executive summary reports for QBRs."

## Step 2: Review the Generated Hierarchy

The output includes the epic decomposed into features, each with user stories containing:

- **Acceptance criteria** in Gherkin (Given/When/Then) format
- **Definition of Done** checklists
- **Business value** justification
- **Story point estimates**
- **Dependency graph** showing relationships between items

## Step 3: Refine

- Use **AI refinement** to adjust scope, detail level, or acceptance criteria
- **Version history** tracks all changes with revert capability

## Step 4: Export

- **PDF export** — For documentation and stakeholder review
- **Jira export** — Push individual items directly to Jira

**Note:** When importing from another flow, generation proceeds immediately without presenting clarifying questions — make sure your source material is solid.

## Tips

- Import from a PRD for the most structured output — PRD sections map naturally to features and stories
- Review the dependency graph before pushing to Jira — dependencies should be reflected in your sprint sequencing
- Enable team recommendations (requires Jira integration with teams configured) to get team match scores
