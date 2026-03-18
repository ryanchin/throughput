---
sidebar_position: 2
title: "How to Use the Business Case Builder"
---

# How to Use the Business Case Builder

This guide walks you through building a financial business case with cost/benefit analysis, financial scenarios, and an investment recommendation.

## Step 1: Provide Input

Describe the feature or initiative, or **import directly from Feasibility Analysis** to pre-fill development cost estimates. This is the recommended path — it saves time and ensures cost consistency.

### Examples of Great Input

**When writing manually (not importing from Feasibility):**
- "We're proposing a self-serve analytics dashboard for enterprise customers. Estimated development cost: 3 engineers for 12 weeks ($180K loaded). Expected impact: reduces 40% of CSM-generated custom report requests (currently 200/month at $150/report), enables upsell of analytics tier at $500/month to 30% of enterprise accounts (currently 340 accounts), and reduces churn by 2% based on exit survey data showing analytics gaps as the #3 churn driver."

**When overriding estimates, provide real data:**
- Infrastructure costs: "We'll need a dedicated ClickHouse cluster at $2,400/month, not the default estimate"
- Revenue projections: "Our sales team has confirmed 15 enterprise accounts at $12K ARR in the pipeline for this feature specifically"

## Step 2: Review the Output

The Business Case Builder generates:

- **Cost Analysis** — Development, infrastructure, maintenance, and operational costs
- **Benefit Analysis** — Revenue impact, cost savings, efficiency gains
- **Three Financial Scenarios** — Conservative, moderate, and optimistic projections
- **Financial Metrics** — NPV, IRR, ROI, and payback period for each scenario
- **Investment Recommendation** — With confidence level and key assumptions

## Step 3: Override Estimates

Click any cost or benefit estimate to override it with your own numbers. All financial metrics recalculate in real time when you change an input.

## Step 4: Review Sensitivity Analysis

The sensitivity analysis highlights which assumptions have the biggest impact on your NPV. Variables that could swing NPV by more than 10% are flagged — these are the assumptions you need to validate most carefully.

## Step 5: Export for Executive Review

Export the complete business case as a PDF. The export includes all three scenarios, key metrics, sensitivity analysis, and the investment recommendation.

## Tips

- Always start from a Feasibility Analysis import — it ensures your development cost estimates are grounded in technical decomposition
- Focus stakeholder discussions on the sensitivity analysis — it tells you where uncertainty matters most
- Use the conservative scenario for budget requests and the moderate scenario for planning
- Override estimates wherever your team has better data — the AI provides defaults, not gospel
