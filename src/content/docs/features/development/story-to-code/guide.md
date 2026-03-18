---
sidebar_position: 2
title: "How to Use Story to Code"
---

# How to Use Story to Code

This guide walks you through converting a user story into production-ready code scaffolded to your tech stack and conventions.

## Step 1: Provide the Story

Enter the user story you want to implement. You can type it directly or import from a Story Creator, Feature Creator, or Epic Creator session.

### Examples of Great Input

**User Story:**
- "As a Customer Success Manager, I want to view a 90-day health score trend line for any account so that I can identify whether the account is improving or declining and prepare accordingly for the next check-in. Acceptance criteria: Given I am viewing an account detail page, When I navigate to the Health tab, Then I see a line chart showing the daily health score for the past 90 days with the current score highlighted."

**Tech Stack Context:**
- "Frontend: React 18 with TypeScript, Tailwind CSS, Recharts for data visualization. Backend: Node.js with Express, PostgreSQL with Prisma ORM. Testing: Jest + React Testing Library. Follow the repository's service-controller pattern. API routes go in /api/v2/ namespace."

**Architectural Guidelines (via knowledge base):**
- Attach your team's coding standards document, API design guide, or architecture decision records for convention-aware code generation.

## Step 2: Specify Your Tech Stack

Provide details about your technology stack so the generated code matches your environment:

- **Languages and frameworks** — e.g., React + TypeScript, Python + FastAPI
- **Database and ORM** — e.g., PostgreSQL with Prisma, MongoDB with Mongoose
- **Testing framework** — e.g., Jest, pytest, Vitest
- **Project structure conventions** — e.g., feature-based folders, service-controller pattern

Optionally attach knowledge bases with your coding standards for the most convention-aware output.

## Step 3: Review Generated Code

The output includes:

- **Implementation files** — Organized by your project's directory structure
- **Test files** — Unit and integration tests alongside the implementation
- **Inline comments** — Explaining key decisions and trade-offs
- **File-by-file breakdown** — Each file clearly labeled with its purpose and path

## Step 4: Refine and Use

- Use **AI refinement** to request changes to specific files or the overall approach
- Copy individual files or the entire output to your codebase
- Use the generated tests as a starting point for your test suite

## Tips

- The more specific your user story's acceptance criteria, the more accurate the generated code
- Always attach your coding standards knowledge base — it's the difference between generic code and code that fits your codebase
- Use the generated code as a starting point, not a final product — review and adapt to your specific context
- Tech stack details matter — specifying "React with TypeScript and Zustand" produces very different code than just "React"
