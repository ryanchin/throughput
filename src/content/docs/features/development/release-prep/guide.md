---
sidebar_position: 2
title: "How to Use Release Prep"
---

# How to Use Release Prep

This guide walks you through generating release documentation from your completed sprint data.

## Step 1: Select Completed Work

Connect to Jira or Azure DevOps and select the sprint or release you want to document. The system pulls in all completed items with their descriptions, types, and metadata.

## Step 2: Choose Document Types

Select which documents to generate:

- **Release Notes** — Customer-facing summary of changes, organized by feature area
- **Decision Log** — Internal record of trade-offs and decisions made during development
- **Migration Guide** — Technical steps required for deployment, including database changes and API updates

You can generate one or all three from the same set of completed items.

## Step 3: Review and Edit

Each generated document is fully editable. Use AI refinement to adjust tone, add context, or reorganize sections.

## Step 4: Export and Distribute

Export as PDF or Word for distribution. Release notes can be formatted for different channels — internal wiki, customer newsletter, or changelog page.

## Tips

- Generate release notes at the end of every sprint, not just major releases — it builds a valuable changelog over time
- The decision log is most useful when your Jira tickets include "why" context, not just "what"
- Migration guides should be reviewed by the engineering team before distribution — the AI generates a starting point based on ticket descriptions
- Use the customer-facing release notes as a draft for your product marketing team to polish
