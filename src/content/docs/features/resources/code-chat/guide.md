---
sidebar_position: 2
title: "How to Use Code Chat"
---

# How to Use Code Chat

This guide walks you through querying your codebase in plain English and getting cited, accurate answers.

## Step 1: Select Your Repository

Choose the repository you want to explore from your connected repositories. Code Chat indexes the codebase and makes it searchable via natural language.

## Step 2: Ask Questions

Type your question in plain English. Code Chat understands questions about architecture, specific functions, data flows, API endpoints, and more.

### Examples of Great Questions

**Architecture and flow questions:**
- "How does the user authentication flow work from login to session creation? Walk me through the middleware chain."
- "What happens when a new order is submitted? Trace the request from the API endpoint through to the database write."

**Finding specific code:**
- "Where are the webhook handlers for Stripe events, and what events do they process?"
- "Show me all the places where we query the users table and what conditions are used."

**Understanding patterns:**
- "What design patterns are used for error handling across the API layer?"
- "How is dependency injection configured in this project?"

**Onboarding questions:**
- "What are the main modules in this codebase and what is each one responsible for?"
- "What environment variables does this project require, and where are they used?"

## Step 3: Review Cited Answers

Every answer includes:

- **File references** — Which files contain the relevant code
- **Line citations** — Specific line numbers for each reference
- **Code excerpts** — Relevant snippets from the source

Click any citation to view the full file context.

## Step 4: Ask Follow-Ups

Code Chat maintains conversation context. Ask follow-up questions to dig deeper:

- "Can you show me the error handling in that same module?"
- "What tests exist for the function you just described?"
- "How does this interact with the caching layer?"

Each session maintains context for up to 20 messages. Start a new session if you're switching to a completely different topic.

## Good to Know

- **Welcome state** — When you first open Code Chat, you'll see a welcome screen with suggested questions. These are tailored to your repository.
- **Session titling** — Sessions are automatically titled based on your first question. You can rename them from the session list.
- **Context window** — Each session maintains up to 20 messages of context. For longer explorations, start a new session and reference findings from previous ones.

## Tips

- Ask specific questions — "How does auth work?" is good, but "How does the JWT refresh token rotation work in the auth middleware?" is better
- Use follow-up questions to drill down — start broad, then narrow
- For architecture overviews, ask "What are the main modules?" first, then ask about specific modules
- Code Chat works best when your code has reasonable naming conventions and comments — it uses those to understand intent
