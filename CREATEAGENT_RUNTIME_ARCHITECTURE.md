# Createagent Runtime — Architecture Document

**Author:** Khurram Badar  
**Stack target:** Next.js (Vercel) + Supabase + Anthropic Claude API  
**Inspiration:** Nous Research's Hermes Agent  
**Status:** Blueprint v1 — ready to hand to Claude Code

---

## 1. The Thesis

Today, every "agent" built on createagent.ai is a stateless prompt with an API endpoint — describe it, deploy it, call it. That's good enough for demos. It is not good enough to be a category-defining platform.

The Createagent Runtime turns each user-built agent into a **persistent, learning entity**. Every conversation adds to the agent's memory. Every successful task can become a reusable skill. The agent gets noticeably smarter the longer the user uses it. That is the moat — competitors deploying flat prompts cannot catch up to an agent that has a year of accumulated context with its user.

Hermes proved this works as a self-hosted CLI. Createagent Runtime ports the same architecture into a hosted, multi-tenant SaaS that non-technical founders can spin up in minutes.

---

## 2. Architectural Pillars

Five pillars, each lifted from Hermes and adapted for a SaaS context:

1. **Skills** — versioned, on-demand knowledge documents the agent loads only when needed.
2. **Bounded curated memory** — two tiny self-managed files per agent: AGENT_MEMORY and USER_MEMORY.
3. **Cross-session recall** — Postgres full-text search over the agent's entire conversation history.
4. **Multi-channel gateway** — same agent reachable via web chat, Telegram, WhatsApp, email, embed widget.
5. **Sandboxed tool execution** — code/tool calls run in an isolated environment, never on your Vercel functions.

Everything else is plumbing.

---

## 3. Data Model (Supabase / Postgres)

Add these tables to your existing `createagent` schema. Names assume one row per agent (you already have `agents`).

### `agent_skills`
```
id              uuid pk
agent_id        uuid fk -> agents
name            text         -- e.g. "draft_uae_invoice"
description     text         -- one-liner shown at Level 0 (~120 chars)
content         text         -- full SKILL.md body, loaded on demand
yaml_frontmatter jsonb        -- triggers, tools required, version
created_by      text         -- 'system' | 'user' | 'auto-extracted'
usage_count     int          -- increment each time loaded
last_used_at    timestamptz
created_at      timestamptz
updated_at      timestamptz
```

### `agent_memory`
One row per agent. Two columns matter:
```
agent_memory_md   text   -- max 2200 chars, environment facts & lessons
user_memory_md    text   -- max 1375 chars, this user's preferences
updated_at        timestamptz
```

### `agent_sessions`
```
id              uuid pk
agent_id        uuid fk
end_user_id     uuid          -- the agent's end-user (not the agent's owner)
channel         text          -- 'web' | 'telegram' | 'whatsapp' | 'api'
started_at      timestamptz
last_message_at timestamptz
summary         text          -- LLM-generated, written when session closes
```

### `agent_messages`
```
id              uuid pk
session_id      uuid fk
role            text          -- 'user' | 'assistant' | 'tool'
content         text
tool_calls      jsonb
created_at      timestamptz
search_vector   tsvector      -- generated column for FTS
```

Index: `CREATE INDEX agent_messages_search_idx ON agent_messages USING gin(search_vector);`

### `agent_skill_extractions`
A queue of completed sessions that the skill-extractor worker should review.
```
id              uuid pk
session_id      uuid fk
status          text          -- 'pending' | 'extracted' | 'rejected' | 'failed'
extracted_skill_id uuid fk -> agent_skills (nullable)
processed_at    timestamptz
```

---

## 4. Prompt Assembly (the heart of the runtime)

On every turn, the runtime assembles the prompt in this order. Aim for ~6–8K tokens before the conversation itself.

```
[SYSTEM]
  + Agent identity and role (from agents.system_prompt)
  + AGENT_MEMORY.md (max 2200 chars)
  + USER_MEMORY.md for this end-user (max 1375 chars)
  + Skill index — Level 0 (name + 1-line description for each skill, ~3000 tokens cap)
  + Tool definitions (only enabled tools)

[CONVERSATION]
  + Last N turns of the current session (default 20)
  + Optional: top-3 retrieved past-message snippets if the user references something old

[USER]
  + The new message
```

Key tools the agent always has access to:

- `load_skill(name)` — returns the full content of a skill (Level 1)
- `search_history(query)` — FTS over `agent_messages` for cross-session recall
- `update_memory(file, new_content)` — agent self-edits its own memory files
- `request_skill_save(title, body)` — agent flags this session for skill extraction

Plus whatever user-enabled tools (web search, Gmail/Calendar via MCP, custom HTTP endpoints, etc.).

---

## 5. Background Workers

Three background jobs run on every session close (or on a schedule). Use Supabase Edge Functions or a small Vercel cron + Inngest setup.

### 5.1 Memory Janitor
Runs after each session ends. Single Claude call:

> *"You are the memory keeper for an AI agent. Here is the current AGENT_MEMORY.md (max 2200 chars) and USER_MEMORY.md (max 1375 chars). Here is a transcript of the session that just ended. Output the updated versions of both files. Do not exceed the character limits. Replace stale entries, consolidate duplicates, add new lessons."*

Writes back to `agent_memory`.

### 5.2 Session Summarizer
Runs after each session ends. Generates a 2–3 sentence summary stored in `agent_sessions.summary`. Used by the search_history tool to give the agent quick context before drilling into full messages.

### 5.3 Skill Extractor
Runs nightly on rows in `agent_skill_extractions` with status='pending'. The extraction prompt:

> *"Review this conversation. Did the assistant solve a non-trivial, repeatable task? If yes, write a SKILL.md document with: a name (snake_case), a one-line description, YAML frontmatter (when_to_use, tools_required), and a procedural body. If no, output 'REJECT'."*

If extracted, save to `agent_skills` and mark the queue row 'extracted'.

---

## 6. The Gateway (multi-channel)

A single Node service (deploy on Railway, Fly, or a small VPS — not Vercel, you need long-running connections).

It does three things:
1. Holds connections to messaging platforms (Telegram bot, WhatsApp via Twilio, email via Postmark inbound webhooks).
2. Translates inbound messages to Createagent's standard message envelope.
3. Calls the agent runtime API and routes the response back to the originating channel.

Start with web chat (already in your app) + Telegram. Telegram's Bot API is the cleanest of all of them — a single long-poll loop and you're live in a day.

Each user-built agent gets its own gateway routing config, stored in `agents.gateway_config` jsonb. Example:

```json
{
  "telegram": { "bot_token": "<encrypted>", "enabled": true },
  "whatsapp": { "twilio_number": "+971...", "enabled": false },
  "email":    { "inbound_address": "agentname@createagent.ai" }
}
```

Encryption: use Supabase Vault for tokens.

---

## 7. Sandboxed Tool Execution

Never run user-defined tools or arbitrary code on your Vercel functions — one bad agent crashes the platform.

Recommendation: use **Modal** or **E2B**. Both expose serverless Python sandboxes via API. Modal has the better hibernation story (Hermes uses it for the same reason); E2B is purpose-built for agent code execution.

Pattern: when the agent calls a code-execution tool, the runtime POSTs the code + context to the sandbox provider, gets back stdout/stderr/files, and returns it to the model as a tool result. Per-agent sandboxes get reused for ~15 minutes then hibernate.

For network tools (web search, HTTP fetches), proxy through a single hardened endpoint with rate limiting per agent.

---

## 8. MCP Support

Adopt MCP as the standard tool protocol. Users paste an MCP server URL into their agent settings (Gmail, Calendar, Drive, Slack, GitHub, Notion, Asana — most major SaaS now have MCP servers). Your runtime adds those tools to the agent's available tool list dynamically per session.

This single feature gives every Createagent user instant integration with hundreds of services without you writing a single integration. It is the cheapest moat-builder on this list.

---

## 9. Build Sequence (3 phases)

### Phase 1 — Memory + Skills (Week 1)
- Add `agent_memory`, `agent_skills`, `agent_sessions`, `agent_messages` tables
- Update agent runtime to assemble prompt with memory + Level-0 skill index
- Implement `load_skill`, `update_memory` tools
- Memory Janitor worker
- Ship: every existing agent now persists memory across sessions

### Phase 2 — Recall + Extraction (Week 2)
- Add FTS index on `agent_messages`
- Implement `search_history` tool
- Session Summarizer worker
- Skill Extractor worker (nightly)
- Ship: agents now learn from successful runs and recall old conversations

### Phase 3 — Gateway + Sandbox + MCP (Week 3–4)
- Stand up gateway service on Railway with Telegram + email
- Wire in Modal/E2B for code execution
- Add MCP server URL field to agent settings; dynamic tool loading
- Ship: agents are reachable everywhere, can run code safely, and integrate with any SaaS

### Phase 4 — Marketplace (Month 2)
- Public skill library at createagent.ai/skills (compatible with agentskills.io standard)
- Users can publish their skills, install others' skills into their agents
- Featured collections: "GCC Compliance Pack", "Pakistan SME Accounting", "Arabic Legal Templates"
- This is the real network effect

---

## 10. First Three Prompts to Hand Claude Code

Copy-paste these in order into Claude Code from `~/projects/createagent`:

**Prompt 1:**
> Read CLAUDE.md. Then read this architecture doc at /home/khurramb/Downloads/CREATEAGENT_RUNTIME_ARCHITECTURE.md. Add the four new Supabase tables (agent_skills, agent_memory, agent_sessions, agent_messages) as a new migration. Don't touch existing tables. Generate the migration file, run it locally against Supabase, and confirm the schema matches the doc.

**Prompt 2:**
> Refactor the agent runtime in /app/api/agents/[id]/chat/route.ts to assemble the prompt as described in section 4 of the architecture doc. Pull AGENT_MEMORY and USER_MEMORY from agent_memory. Build the Level-0 skill index from agent_skills. Add the load_skill and update_memory tools. Write tests that confirm the assembled prompt structure.

**Prompt 3:**
> Build the Memory Janitor as a Supabase Edge Function. Trigger: a new row in agent_sessions with last_message_at older than 5 minutes. Use the prompt from section 5.1 of the architecture doc. Update agent_memory in place. Add a unit test using a sample transcript.

After Phase 1 ships, write Prompts 4–6 for Phase 2.

---

## 11. Pricing Implication

The runtime fundamentally changes your cost structure: each agent now uses meaningfully more tokens per call (memory + skill index added to system prompt). Two responses:

- **Caching.** Use Anthropic's prompt caching on the system block (memory + skill index). The skill index is identical for the entire session — cache hit rate should be >90%. This drops marginal cost per turn back close to today's level.
- **Pricing tiers.** Free tier = stateless agents (today's product). Pro tier = persistent agents with memory + skills. Team tier = gateway channels + MCP integrations. Enterprise = dedicated sandboxes + audit logs.

The persistent-agent capability is the upsell hook. Free users feel the difference instantly when they upgrade — their agent finally remembers them.

---

## 12. What This Doc Deliberately Skips

Because they're not core to the runtime:

- Auth/billing/UI — already built
- Observability (Sentry, PostHog) — add per your standard harness
- Eval framework — add once Phase 2 ships
- Voice channels (Twilio Voice, Vapi) — Phase 5
- Visual workflow builder — different product, do not conflate

---

## 13. Vertical Agent Pack #1 — The Brand Voice Agent

**Goal:** A productized agent template that wakes up every morning, reads the news, drafts platform-specific social posts in the client's voice, and delivers them for approval — then publishes the approved ones. First customer: Dr. Rashid Al Ameri. Repeatable for any senior figure with a public brand (consultants, mentors, doctors, lawyers, executives, founders).

This is the first SKU built on the Createagent Runtime. It uses every Phase 1–3 capability and adds nothing new at the platform level — only configuration, prompts, and three new tools.

### 13.1 Daily Workflow

```
06:30  Cron triggers the agent (scheduled tool from Phase 3)
06:30  Agent fetches overnight news from configured RSS feeds + News API
06:35  Agent filters articles against AGENT_MEMORY ("client cares about: GCC governance,
       leadership, family business, AI in education...") — keeps top 5
06:40  For each kept article, agent drafts:
         - 1 LinkedIn post (1200–1500 chars, professional, opinion + insight)
         - 1 Facebook post (warmer, 400–600 chars)
         - 1 Twitter/X post (under 280, punchy)
       Voice rules pulled from USER_MEMORY ("client writes in first person, uses
       'we' for UAE, avoids hashtags, signs off with one rhetorical question...")
06:50  Agent assembles a digest and delivers via gateway:
         - Email to client (rich HTML with Approve / Edit / Reject buttons)
         - WhatsApp summary with a link to the same approval page
07:00  Agent waits. When client taps Approve → posts via LinkedIn/Facebook API.
       When client edits → agent computes the diff and writes the lesson to
       USER_MEMORY ("client prefers shorter intros, removes em-dashes, adds a
       personal anecdote when topic is leadership"). On Reject → memory updated
       with the rejected angle so it isn't repeated.
```

The longer it runs, the less editing the client has to do. After ~30 days of feedback, approval rate should hit 70%+ with minimal edits. That's the moment the client stops thinking of it as "a tool" and starts thinking of it as "my voice that scales."

### 13.2 Configuration (per-client)

Stored in `agents.config_json`:

```json
{
  "vertical_pack": "brand_voice_agent",
  "client_profile": {
    "name": "Dr. Rashid Al Ameri",
    "title": "Author, Mentor, Strategy Advisor",
    "domains": ["GCC governance", "family business", "leadership", "UAE policy"],
    "platforms": ["linkedin", "facebook"],
    "languages": ["en"],
    "future_languages": ["ar-ae"]
  },
  "schedule": {
    "draft_at": "06:30",
    "timezone": "Asia/Dubai",
    "cadence": "daily",
    "skip_days": ["friday"]
  },
  "sources": {
    "rss": [
      "https://www.thenationalnews.com/rss",
      "https://gulfnews.com/rss",
      "https://www.khaleejtimes.com/rss",
      "https://www.arabianbusiness.com/rss",
      "https://hbr.org/feed"
    ],
    "news_api_topics": ["UAE business", "GCC policy", "AI regulation", "family office"]
  },
  "delivery": {
    "email": "rashid@example.com",
    "whatsapp": "+9715XXXXXXX",
    "approval_required": true
  },
  "publishing": {
    "linkedin_token_ref": "vault://rashid-linkedin",
    "facebook_page_id": "123456",
    "auto_publish_after_approval": true
  }
}
```

### 13.3 Three New Tools

Add these to the runtime so the agent template can use them. Each is ~50 lines of code.

1. **`fetch_news(sources, since)`** — pulls articles from configured RSS feeds and News API, returns title + summary + URL + published_at. Cache for 1 hour to avoid duplicate calls.
2. **`compose_post(article, platform, voice_profile)`** — already covered by base `claude.messages.create`, but wrap it in a tool that enforces platform-specific length and structure rules so the agent doesn't have to remember them every time.
3. **`publish_post(platform, content, scheduled_for)`** — calls LinkedIn or Facebook API with the approved content. Logs result to `agent_publishing_log` table for audit.

### 13.4 Approval UX

The bottleneck for any brand-voice agent is the approval loop. Make it feel like 30 seconds of work, not a chore.

Email design: a single page per platform per article. Big "Approve" button. An "Edit" textarea pre-filled with the draft. A "Reject — give one-word reason" tag selector (e.g. "off-brand", "not interesting", "wrong framing"). The reason tags become structured signal for the memory janitor.

WhatsApp design: a numbered list of the day's drafts, each with a short link. Tapping the link opens the same approval page. WhatsApp is the nudge, email is the workspace.

### 13.5 Voice Learning (the secret sauce)

This is what distinguishes a Createagent Brand Voice Agent from "ChatGPT writing posts." Every approved post, every edited diff, every rejection updates USER_MEMORY through the memory janitor. Specifically the prompt extends:

> *"...you are also tracking the client's voice. Note recurring patterns in their edits: words they remove, phrases they add, structural changes (intro length, sentence rhythm, sign-offs). Note topics they reject and themes they engage with. The voice profile section of USER_MEMORY should make a future draft 80% closer to what they would write themselves."*

After 30 days of feedback you can show the client a "Voice Fingerprint" page — their top 5 favored words, top 5 banned phrases, average post length, preferred opening style, signature sign-offs. It's a flex feature that makes the value visible.

### 13.6 Commercial Packaging

This is where it gets interesting for your business. A Brand Voice Agent is not a $20/mo SaaS subscription — it's a high-touch service-as-software offering. Suggested structure for selling to clients like Dr. Rashid:

| Tier | Setup | Monthly | What's included |
|---|---|---|---|
| Foundation | AED 5,000 | AED 1,500 | 1 platform, 3 posts/week, email approval only, English only |
| Professional | AED 12,000 | AED 3,500 | 2 platforms, daily posts, email + WhatsApp approval, monthly voice review |
| Executive | AED 25,000 | AED 7,500 | 3+ platforms, daily posts, bilingual (English + UAE Arabic), quarterly strategy session, dedicated dashboard |

Setup fee covers: voice calibration sessions (you spend 2 hours interviewing the client, building seed memory), source curation, platform API setup, first 30 days of supervised tuning.

Per your existing model: also offer revenue share as an alternative — e.g. 15% of demonstrable inbound leads attributed to social posts for 12 months. Let the client pick.

### 13.7 Build Cost

Once the Phase 1–3 runtime is in place, building this vertical pack is **~5 days of Claude Code work**:

- Day 1: News fetcher tool + RSS parser
- Day 2: Composer tool + platform-specific length/structure rules
- Day 3: Approval page (email + web) with Approve/Edit/Reject endpoints
- Day 4: LinkedIn + Facebook publishing API integration
- Day 5: Voice-fingerprint dashboard page + onboarding flow

Then onboard Dr. Rashid as customer zero. Iterate against his feedback for two weeks. Then list it as a Createagent template anyone else can deploy in 10 minutes.

### 13.8 Risk and Mitigation

- **Reputational risk if a bad post goes out.** Mitigation: `auto_publish_after_approval` defaults to `false` for first 30 days. After that the client can opt in.
- **Newspaper paywalls.** Mitigation: stick to RSS feeds (free) + News API (cheap aggregator). For paywalled sources the agent reads the headline + dek only and uses that as a topic prompt — the post is the agent's analysis, not a regurgitation.
- **WhatsApp Business approval lag.** Mitigation: launch with email + Telegram first; add WhatsApp once Meta approval clears.
- **LinkedIn API rate limits.** Mitigation: 1 post/day per page is well under any limit; queue and pace if a client wants more.
- **Voice drift over time.** Mitigation: a monthly "voice review" prompt that asks the client to rate the last 30 posts on a 1–5 scale. Low scores trigger a memory consolidation pass.

### 13.9 Future Vertical Packs (same architecture, different config)

Once Brand Voice Agent ships, the runtime makes these near-trivial to add:

- **Inbox Triage Agent** — wakes up, reads Gmail via MCP, drafts replies in the user's voice, queues for approval
- **Investor Update Agent** — pulls KPIs from Stripe/Notion/Sheets, drafts monthly investor email, sends after approval
- **Deal Flow Agent** (for VCs / family offices) — monitors news + deal databases, drafts intro emails to relevant founders
- **Client Newsletter Agent** (for law firms, consultancies, clinics) — turns published thought-leadership into a fortnightly client newsletter

Each is a config + 2–3 new tools. The runtime does the heavy lifting.

---

## 14. Vertical Agent Pack #2 — The Routine Agent

**Goal:** A generalized scheduled-autonomous-agent template. The user defines what the agent should do, when it should run, and where to deliver the output. The runtime handles everything else. Brand Voice Agent (Section 13) is one specific instance of this pattern; this section defines the broader category.

This is directly inspired by Anthropic's own Claude Routines feature, generalized for the multi-tenant SaaS context of createagent.ai.

### 14.1 The Pattern

Every Routine Agent follows the same five-step lifecycle:

```
1. WAKE      — fires on a schedule (cron) or webhook
2. GATHER    — fetches inputs from configured sources (RSS, APIs, MCP servers, files)
3. THINK     — Claude reasons over the inputs against a task prompt
4. PRODUCE   — generates output (a draft, a report, a decision, an action)
5. DELIVER   — sends to one or more channels (email, WhatsApp, Slack, webhook,
               auto-publish to platform, save to dashboard)
```

The user-facing builder asks only six questions:
1. What should this agent do? (free text)
2. When should it run? (preset cadences + custom cron)
3. Where should it get its inputs? (sources picker — MCP catalog + URL list)
4. What's the output format? (preset templates: digest, report, post, decision)
5. Where should it send the output? (channels picker)
6. Approval needed before delivery? (yes / no / yes for first 30 days)

That's it. Everything else is handled by the runtime.

### 14.2 Templates Library

Ship the platform with these pre-built Routine Agent templates. Each is a system prompt + sources + delivery preset stored in `agent_templates` table. Users can deploy any of them in 60 seconds, or fork and customize.

| Template | What it does | Default schedule | Delivers via |
|---|---|---|---|
| **Brand Voice Agent** | Drafts daily social posts in client's voice | 06:30 daily | Email + WhatsApp |
| **Inbox Triage Agent** | Reads overnight emails (via Gmail MCP), drafts replies, flags urgent | 07:00 daily | Email digest |
| **Competitor Watcher** | Monitors competitor sites/news, alerts on changes | Hourly | Slack + Email |
| **KPI Reporter** | Pulls metrics from Stripe / Notion / Sheets, drafts weekly report | Monday 08:00 | Email + dashboard |
| **News Briefing** | Topic-filtered news digest from RSS + News API | 06:00 daily | Email |
| **Lead Enricher** | Overnight enrichment of new CRM leads (via Salesforce/HubSpot MCP) | 02:00 daily | CRM update + summary email |
| **Investor Update Drafter** | Pulls company KPIs, drafts monthly investor email | 1st of month, 09:00 | Email draft |
| **Content Republisher** | Turns YouTube transcripts or blog posts into LinkedIn / Twitter threads | On-demand or weekly | Approval queue |
| **Meeting Prep Agent** | Reads tomorrow's calendar, researches attendees + companies, drafts briefing | 18:00 daily | Email |
| **Compliance Watcher** | Monitors regulator websites (SAMA, NCA, ZATCA, ADGM, DFSA) for new rulings | Daily 08:00 | Email + Slack |

The Compliance Watcher specifically is gold for the GCC market — every bank, fintech, and law firm needs this and most don't have a clean way to do it.

### 14.3 Data Model (extends Section 3)

Two new tables:

**`agent_templates`** — the marketplace catalog
```
id              uuid pk
slug            text unique          -- e.g. 'compliance-watcher-gcc'
name            text
description     text
category        text                 -- 'routine' | 'conversational' | 'workflow'
system_prompt   text
default_sources jsonb
default_schedule text
default_delivery jsonb
required_mcp    text[]               -- e.g. ['gmail', 'salesforce']
price_tier      text                 -- 'free' | 'pro' | 'enterprise'
created_by      uuid                 -- platform or community contributor
```

**`agent_runs`** — every scheduled execution logged
```
id              uuid pk
agent_id        uuid fk
triggered_by    text                 -- 'schedule' | 'api' | 'webhook' | 'manual'
started_at      timestamptz
completed_at    timestamptz
status          text                 -- 'running' | 'success' | 'failed' | 'awaiting_approval'
input_summary   text
output          jsonb
delivery_log    jsonb                -- where it was sent, when, status
tokens_used     int
cost_cents      int
```

The `agent_runs` table also doubles as your billing source of truth and your customer-facing "what has my agent done lately" dashboard.

### 14.4 Scheduling Layer

Use Inngest, Trigger.dev, or Supabase pg_cron — pick whichever you find easiest to integrate with your existing Next.js stack. Trigger.dev is probably the cleanest for non-technical setup; pg_cron is the cheapest if you're comfortable with SQL.

The scheduler does one thing: at the configured time, POST to a single endpoint (`/api/agents/:id/run`) with the trigger context. The runtime takes over from there.

### 14.5 Approval Queue (shared infrastructure with Brand Voice Agent)

Build this once, reuse for every Routine Agent that needs human-in-the-loop. A single `/dashboard/approvals` page in the user's createagent.ai account showing all pending drafts across all their Routine Agents, with approve/edit/reject actions per item. Email and WhatsApp notifications link directly to this page.

After 30 days, users can flip `approval_required: false` on any agent they trust enough.

### 14.6 Build Cost

Once the runtime (Phases 1–3) is in place: **~7 days of Claude Code work** to ship the Routine Agent template system + 5 starter templates + scheduler + approval queue. Then ~1 day per additional template after that.

The marketplace effect kicks in around the 20-template mark — at that point users start finding templates faster than you can build them, and a community contribution mechanism becomes worth opening up.

---

## 15. Strategic Architecture Pivot — Build on Anthropic's Primitives

This section was added after the original architecture was drafted, in light of two Anthropic releases that significantly change the build path: **Claude Managed Agents** and the **Memory tool** in the API.

### 15.1 What Anthropic Has Now Shipped

- **Claude Managed Agents** (beta, header `managed-agents-2026-04-01`). A managed agent harness with four primitives: Agent (model + system prompt + tools + MCP servers + skills), Environment (configured cloud container), Session (a running agent instance), Events (messages exchanged). Built-in prompt caching, compaction, sandboxed bash + file ops + web tools. You don't build the agent loop or the sandbox — Anthropic runs both.

- **Memory tool** (`memory_20250818`). A first-class file-based memory primitive. Claude can `view`, `create`, `str_replace`, `insert`, `delete`, `rename` files in a `/memories` directory that you back with whatever storage you want (Supabase Postgres works fine). Storage is client-side, so you keep multi-tenant isolation under your own control.

- **Skills in the API**. Skills are now a native API concept attached to agents. Same progressive-disclosure pattern Hermes uses, supplied by Anthropic.

- **Claude Code Routines**. Scheduled Claude Code sessions on Anthropic's infrastructure. Not directly usable inside a multi-tenant SaaS (it's tied to Claude Code subscriptions), but the *pattern* validates that scheduled autonomous agents are a category Anthropic is investing in heavily.

### 15.2 What This Changes

The Phase 1–3 architecture in Sections 3–9 was written assuming you build the agent runtime yourself. Three of the hardest pieces now have native API primitives:

| Hand-built (Sections 3–9) | Native API equivalent | Effort saved |
|---|---|---|
| Custom agent loop in Next.js API route | Managed Agents Sessions | ~1 week |
| Memory Janitor worker + agent_memory table | Memory tool with Supabase storage backend | ~3 days |
| Modal/E2B sandbox integration for tool execution | Managed Agents Environment | ~2 days |
| Skills loader / Level-0 index assembly | Skills in API | ~3 days |
| Compaction logic for long conversations | Built-in compaction | ~2 days |

That's roughly **2.5 weeks of build time eliminated** — and Anthropic maintains the infrastructure for you instead of you babysitting it.

### 15.3 Recommended Architecture (Revised)

Keep everything from Sections 3–9 conceptually, but implement it like this:

- **Each user-built agent on createagent.ai = one Anthropic Managed Agent**, created once via the Managed Agents API and stored by ID in your `agents` table.
- **Each conversation = one Session** on that agent, scoped to the end-user.
- **Memory** = enable the Memory tool on every agent, back it with a Supabase-backed memory store keyed by `(agent_id, end_user_id)`. The AGENT_MEMORY/USER_MEMORY split becomes two files in the agent's memory directory — Claude manages them automatically.
- **Skills** = use Anthropic's Skills in the API. Your skill marketplace becomes a UI for browsing, installing, and forking skills onto a user's agents.
- **Tools** = enable the built-in tools you want (bash, file ops, web search, web fetch) plus the user's MCP server URLs. No sandbox infrastructure needed — Managed Agents handles it.
- **Scheduling** = Trigger.dev or Inngest fires a cron, your endpoint creates a Managed Agents Session with the routine's task prompt as the first event, streams events back, captures the output, delivers via gateway.

What you still build yourself:
- Multi-tenant web UI, auth, billing (already done)
- The visual agent builder (your edge)
- The gateway service (Telegram, WhatsApp, email — Managed Agents doesn't handle delivery channels)
- The approval queue UI
- The template marketplace
- Vertical pack configurations

### 15.4 Trade-offs to Be Aware Of

- **Vendor lock-in.** Building on Managed Agents means Anthropic-only. If you want to offer "use your own model" (OpenAI, Gemini, open-source), you'd need to build a parallel runtime for those. For your current customer base — non-technical founders who just want it to work — this is not a blocker. Mention it on a future enterprise tier if a buyer demands multi-model.
- **Beta status.** Managed Agents is in beta. Behavior may shift. Build your runtime with a thin abstraction layer (a `runAgentSession()` function that wraps the API) so you can swap implementations without rewriting the rest of the platform.
- **Pricing visibility.** You pay for the compute Anthropic runs on your behalf. Test 5–10 representative routines to understand the per-run cost before pricing your tiers.
- **Less differentiation at the runtime layer.** If everyone's building on Managed Agents, the runtime stops being a moat. Your moats become UX, vertical packs, marketplace, and gateway breadth — which were always the right moats anyway.

### 15.5 Revised Build Sequence

| Phase | Original (build-it-yourself) | Revised (build on Managed Agents) |
|---|---|---|
| 1 | Memory layer (4 tables, 1 worker, ~1 week) | Wire Memory tool with Supabase backend (~2 days) |
| 2 | Skills + recall (2 tables, 2 workers, ~1 week) | Wire Skills API + use Memory tool for recall (~3 days) |
| 3 | Gateway + sandbox + MCP (~2 weeks) | Gateway only — sandbox & MCP are built in (~1 week) |
| 4 | Marketplace (~2 weeks) | Marketplace (~2 weeks, unchanged) |

**Original total to ship the runtime: ~6 weeks. Revised: ~3 weeks.**

### 15.6 Recommendation

Do the revised version. The original build-it-yourself architecture is still valid as a fallback if Anthropic's beta becomes problematic, but the API primitives are stable enough to ship on. Start by building the Memory tool integration this week — it's the smallest piece and proves the pattern. If it works cleanly, port the rest. If it doesn't, fall back to the hand-built approach in Sections 3–9.

Either way, the user-facing product is identical. The user doesn't know or care whether the agent loop runs on Anthropic's infrastructure or yours. They just know their agent remembers them.

---

## 16. Vertical Agent Pack #3 — The Virtual Department

**Goal:** A productized multi-agent template where a manager agent coordinates a team of specialist agents to deliver work as a unit. The customer doesn't hire a marketing team — they activate a Virtual Marketing Department. The customer doesn't hire a finance team — they activate a Virtual Finance Department. Same runtime, same memory, same gateway as everything else in this architecture, but the unit of value sold is *a team*, not *an agent*.

This is the most ambitious vertical pack and the most defensible. Single-agent platforms are commoditizing fast. Multi-agent orchestration is meaningfully harder to build well, and the window to own a clean visual builder for it is open right now.

### 16.1 The Pattern (and why most multi-agent systems fail)

Multi-agent demos look magical and break in production. Three failure modes are responsible for almost all of it:

1. **Nested hierarchies** — manager-of-managers loops where the system spends more tokens deciding who owns the task than doing the task.
2. **Worker-to-worker chatter** — agents trying to "collaborate" by re-explaining context to each other, hallucinating consensus, getting stuck in loops.
3. **Context inflation** — every agent gets the full conversation history, token costs scale quadratically, and the manager re-reasons over everything.

The Virtual Department template enforces three constraints to avoid all three:

1. **Flat hierarchy.** Exactly one manager, N workers. No worker is also a manager. No nested teams.
2. **Star communication.** Manager → workers (delegation) and workers → manager (results) only. Workers never talk to each other. The manager is the bus.
3. **Bounded contexts.** Each worker receives only the manager's task brief plus the specific inputs it needs — never the full conversation. The worker returns a structured result; the manager synthesizes.

These constraints align with where Anthropic's own multi-agent research has converged. Don't relax them to get a more impressive demo. Relax them in production and your token costs explode and your output quality collapses.

### 16.2 Run Lifecycle

```
1. INTAKE     — user gives the team a goal ("draft a Q2 marketing plan for our SaaS")
2. PLAN       — manager agent decomposes the goal into N specialist tasks,
                writes a one-paragraph brief for each, decides dependency order
3. DISPATCH   — runtime spawns one worker session per task in parallel where
                possible, sequentially where dependencies require it
4. EXECUTE    — each worker runs against its brief with its own context, tools,
                and hard token budget. Returns a structured result object.
5. SYNTHESIZE — manager assembles the workers' outputs into the final deliverable.
                NOT a re-reasoning pass — a structured assembly per a template.
6. DELIVER    — final deliverable goes to the user via the configured channel
                (email, dashboard, document export, approval queue)
```

Total wall-clock time for a 5-worker team on a moderate task: 30–90 seconds. Total token cost: roughly 4–8x a single-agent run, not 25x — because workers run with bounded contexts, not the full history.

### 16.3 Three Starter Templates

Each template is one manager + 4–6 specialists. Each specialist is a Createagent agent in its own right (with its own system prompt, tools, MCP connectors, memory) — the team is a coordination layer above them.

**Virtual Marketing Department**
- *Manager:* Marketing Strategist — owns brief decomposition and final synthesis
- *Workers:* Copywriter, SEO Analyst, Social Media Planner, Visual Designer (generates image prompts), Analytics Reporter
- *Sample output:* a complete Q2 campaign deck — strategy memo, 12 long-form posts, 30 social posts, 5 thumbnail prompts, KPI dashboard plan

**Virtual Finance Department**
- *Manager:* Virtual CFO — owns coordination and board-ready synthesis
- *Workers:* Bookkeeper (categorizes transactions via accounting MCP), AP/AR Tracker, Financial Reporter, Forecaster, Compliance Watcher (SAMA/ZATCA-aware)
- *Sample output:* monthly close package — categorized P&L, AR aging report, 13-week cash flow forecast, board memo, regulatory flag list

**Virtual Legal Team**
- *Manager:* General Counsel — owns triage and final memo
- *Workers:* Contract Reviewer, Compliance Officer, IP Specialist, Employment Law, GCC Regulatory (DIFC/ADGM/SCA/SAMA/CMA-aware)
- *Sample output:* contract review package — redlined contract, risk memo, jurisdiction-specific compliance checklist, suggested edits, escalation flags

A fourth template worth shipping early because it maps to your Protiviti work: **Virtual GRC Team** (governance, risk, compliance) for SAMA/NCA/ZATCA frameworks. You've already proven you can build the agent roster — productize it.

### 16.4 Data Model (extends Sections 3 and 14)

Three new tables on top of the existing schema:

**`agent_teams`** — the team definition
```
id              uuid pk
slug            text unique          -- e.g. 'virtual-marketing-dept'
name            text
description     text
manager_agent_id uuid fk -> agents
synthesis_template text                -- prompt template for final assembly
max_total_tokens int                  -- hard ceiling for one team run
created_by      uuid
```

**`team_members`** — workers attached to a team
```
id              uuid pk
team_id         uuid fk
worker_agent_id uuid fk -> agents
role            text                 -- 'copywriter', 'seo_analyst', etc.
max_worker_tokens int                 -- per-worker token budget
position        int                  -- display order
required        boolean              -- is this worker mandatory or optional
```

**`team_runs`** — every team execution logged
```
id              uuid pk
team_id         uuid fk
goal            text                 -- the user's input goal
plan            jsonb                -- manager's decomposition (briefs per worker)
worker_results  jsonb                -- structured outputs from each worker
final_output    text                 -- manager's synthesis
status          text                 -- 'planning' | 'dispatching' | 'synthesizing' | 'done' | 'failed'
total_tokens    int
total_cost_cents int
duration_ms     int
started_at      timestamptz
completed_at    timestamptz
```

The `team_runs` table is also your customer-facing "what did my department do today" dashboard.

### 16.5 The Manager's System Prompt (the secret sauce)

The whole pattern lives or dies on the manager prompt. It does only three jobs and nothing else:

> *"You are the manager of a team of specialist agents. You do three things and three things only: (1) Decompose the user's goal into specific, scoped tasks for your specialists. Write a one-paragraph brief for each task that includes only what that specialist needs to know — not the full conversation, not your reasoning. (2) Decide dependency order: which tasks can run in parallel, which must run after others. (3) When all specialists have returned their outputs, assemble them into the final deliverable using the synthesis template. Do not re-do the specialists' work. Do not second-guess them. Do not summarize — assemble. Your value is coordination, not re-reasoning."*

The synthesis template (per team) is a structured prompt that says: "given outputs A, B, C, D, E, produce a deliverable in this format..." with explicit slots for each specialist's contribution. This stops the manager from drifting into "let me think about everything everyone said" mode that burns tokens and waters down output.

### 16.6 Guardrails (non-negotiable in production)

- **Hard per-worker token budget.** Default 8K. Worker returns whatever it has when budget hits, never silently overruns.
- **Hard per-run total budget.** Default 50K total tokens for the team. If exceeded mid-run, the runtime kills remaining workers and the manager synthesizes with what it has.
- **Maximum 8 workers per team.** Above that, output quality drops sharply and costs spike. Force users to split the work across multiple teams instead.
- **No retries on worker failure by default.** The manager sees "[worker failed]" and synthesizes around it. Retries are an opt-in flag and they cost the customer extra.
- **No nested team calls.** A worker cannot spawn its own sub-team. If a task is genuinely complex enough to need that, it's a different team and the user runs them separately.
- **Synthesis output is a template, not free-form.** The manager fills in slots. This is what keeps the deliverable consistent across runs.

### 16.7 Build Cost

This is the most expensive vertical pack. Once Phases 1–3 of the runtime are in place, expect **~14 days of Claude Code work**:

- Days 1–3: Team definition + manager runtime + dispatcher (parallel + sequential execution)
- Days 4–6: First template (Virtual Marketing Department) — agents, briefs, synthesis template
- Days 7–8: Synthesis assembly engine + structured output enforcement
- Days 9–10: Team run dashboard + cost telemetry + budget enforcement
- Days 11–12: Second and third templates (Finance, Legal)
- Days 13–14: Approval queue integration + visual team builder UI

Plan a fourth week of supervised tuning per template — multi-agent prompt tuning is genuinely iterative. Anthropic's own research teams iterate for weeks on these patterns.

### 16.8 Commercial Packaging

Virtual Departments are not a $99/month SaaS feature. They're enterprise-tier productized services. Suggested structure:

| Tier | Setup | Monthly | What's included |
|---|---|---|---|
| Department | AED 25,000 | AED 5,000 | 1 department (e.g., Marketing only), up to 100 team runs/month, email delivery |
| Multi-Department | AED 60,000 | AED 12,000 | Up to 3 departments, 500 runs/month, email + WhatsApp + dashboard, monthly tuning session |
| Enterprise | AED 150,000+ | AED 30,000+ | Unlimited departments, custom team templates, dedicated infrastructure, white-label, audit logs, SAMA/NCA-grade compliance |

Setup fee covers: discovery interviews to map the customer's actual workflow, custom worker tuning for the customer's voice/data/tools, team integration with their MCP connectors (Salesforce, NetSuite, SAP, etc.), and the first 30 days of supervised operation.

Per your standard model: also offer revenue share as an alternative — 20% of demonstrable cost savings vs the equivalent human team for 12 months. For a finance department this is easy to evidence; for marketing it's harder. Use rev-share where the savings are quantifiable, fixed fee everywhere else.

### 16.9 Why This Is the Strongest Play in the Whole Doc

Three reasons worth being explicit about:

1. **Category positioning.** Single-agent builders are a crowded race to the bottom. "Company in a box" is a category nobody owns yet. Pricing power lives in the bigger category.

2. **You've already proven you can build it.** Your Protiviti AIS engagement was a 21-agent multi-agent system shipped in one day. That's the proof point in every sales conversation: "we built this for Protiviti KSA — here's the same architecture as a productized template you can deploy in an afternoon."

3. **The window is closing.** Anthropic's own multi-agent feature is still in research preview. CrewAI, MetaGPT, AutoGen are developer tools without polished visual builders. Lindy and Relevance have orchestration but it's clunky. There is roughly a 6–12 month window where a clean, non-technical, visual multi-agent builder for GCC verticals can establish a defensible position. Ship inside that window.

### 16.10 What This Pack Is Not For

To stay disciplined: do not extend this pattern to consumer-facing chat agents, simple workflow automation that one agent can handle, or anything where latency under 5 seconds matters. Virtual Departments are for considered, structured deliverables (campaigns, reports, reviews, plans) — not real-time interaction. A different vertical pack can cover real-time use cases later.

---

## 17. Open Questions for You

1. Do you want to support self-hosted Createagent (BYO API key + open-source runtime), or stay pure SaaS?
2. Pricing: rev-share with skill marketplace authors, or flat marketplace fee?
3. Branding: position Createagent Runtime as a separate product, or a feature called "Persistent Mode" inside today's product?

Answers to these shape Phase 4 and beyond. Phases 1–3 don't depend on them.
