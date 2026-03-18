---
sidebar_position: 2
title: "How to Use the Feasibility Analyzer"
---

# How to Use the Feasibility Analyzer

This guide walks you through evaluating whether a feature is technically buildable — with effort estimates, timelines, risks, and a Go/No-Go recommendation.

## Step 1: Describe the Feature

Provide a feature description (minimum 100 characters) or import from:

- **Epic Generator** — Pull in a generated epic
- **Feature Generator** — Pull in a generated feature
- **Ideation Engine** — Pull in a top-scoring idea

Optionally add technical constraints and target user information.

### Examples of Great Input

**Feature Description:**
- "Build a real-time collaborative document editor supporting up to 50 concurrent users per document. Must include presence indicators, cursor tracking, conflict resolution, and version history. Documents range from 1-50 pages. Must integrate with our existing React frontend and Node.js backend. Needs offline support with sync-on-reconnect."
- "Add a role-based access control system to our multi-tenant SaaS platform. Support custom roles with granular permissions at the resource level. Must integrate with Okta and Azure AD for SSO. Need audit logging for all permission changes. Current system has 200+ API endpoints that need authorization checks."

**Technical Constraints:**
- "Backend is Python/FastAPI on AWS ECS. Database is PostgreSQL 15 with ~2TB of data. Cannot introduce new infrastructure dependencies without DevOps approval. Must maintain backward compatibility with API v2 clients for 6 months."

## Step 2: Review the Results

The output includes:

- **Component Breakdown** — Each technical piece with hour estimates
- **Three Timeline Scenarios** — Optimistic, realistic, pessimistic with sprint counts, team size, and parallelization details
- **Risk Assessment** — Each risk scored by probability and impact
- **Skills Required** — Proficiency levels and person-weeks per skill
- **Technology Stack** — Auto-detected technologies needed
- **Go/No-Go/Conditional Recommendation** — With a confidence level

## Step 3: Edit Estimates

You can manually adjust hour estimates on editable components. This is useful when your team has specific knowledge about effort that the AI might not capture.

## Step 4: Refine and Export

- Use **AI refinement** to ask questions or request re-analysis with different assumptions
- **Export as PDF** for stakeholder presentations
- Continue to the **Business Case Builder** to turn effort estimates into financial projections (import pre-fills development costs)

## Tips

- Import from Ideation or Epic Generator when possible — pre-populated context produces more accurate estimates
- Always review the risk assessment — high-probability, high-impact risks are your decision drivers
- Use the pessimistic timeline for planning and the optimistic timeline for best-case communication
- Edit component estimates when your team has direct experience — the AI provides a starting point, not the final word
