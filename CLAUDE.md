# CreateAgents.ai

## Overview
CreateAgents.ai is a no-code AI agent builder platform. Users describe the agent they need and the platform architects, configures, connects, and deploys it. The tagline is "Describe it. We build it. You deploy it."

## Deployment
- **Hosted on Vercel** at https://createagents-ai.vercel.app
- **Canonical domain:** https://createagents.ai
- **Single-file architecture:** The entire site is one `index.html` file (~4,900 lines, ~390KB)

## Tech Stack
- Pure HTML/CSS/JS — no build tools, no framework, no bundler
- Fonts: Cormorant Garamond (serif headings), Outfit (body sans-serif)
- Design system: Terracotta (#C44B2C) + Cream (#FAF7F0) + Forest (#1B3A2D) color palette
- Mobile-first responsive design with RTL/multilingual support
- All data (agents, verticals, personas, news, etc.) is defined as JS constants inline in the HTML

## Architecture

### CSS (~1,200 lines)
All styles are inlined in a `<style>` block. Key conventions:
- CSS variables on `:root` for colors, shadows, radii
- Utility classes: `.ctr` (container), `.sec` (section padding), `.tag` (label), `.btn-*` (buttons)
- `content-visibility: auto` on below-fold sections for performance
- `prefers-reduced-motion` media query for accessibility
- Scroll-reveal animation system (`.rv` / `.rv.in`)

### HTML Sections (in order)
1. **Language bar** — multilingual selector (12 languages)
2. **Persona onboarding modal** — first-visit experience to personalize the site
3. **Nav** — sticky header with logo, links, auth/sign-in buttons
4. **Hero** — headline, stats (80+ agents, 8min build time, 500+ integrations, 16 verticals)
5. **Marquee** — scrolling integration logos
6. **Agent Marketplace** (`#agents`) — searchable/filterable grid of 80+ pre-built agents with search, vertical filter, and B2B/B2C toggle
7. **How It Works** — 3-step process
8. **Pricing** (`#pricing`) — tiered plans with monthly/annual toggle, 7-day free trial
9. **Testimonials** — user quotes
10. **News** (`#news`) — AI news feed with category filters
11. **Case Studies** (`#cases`) — success stories
12. **Persona Hub** (`#who`) — persona-specific landing sections
13. **Specialty Sections:**
    - Gen Z / Teen Builders (`#little-builders`)
    - Government (`#government`) — OECD-aligned AI for public sector
    - SEN (Special Educational Needs) (`#sen`) — neurodiversity support
    - She Builds — women in AI
    - World section — global/multilingual
14. **University** — learning paths and courses per persona
15. **Community** — builder community
16. **LLM Model Tracks** — model comparison/selection
17. **FAQ** — expandable accordion
18. **Disclaimers** — legal/compliance
19. **Footer**

### JavaScript (~1,700 lines)
All JS is in a single `<script>` block at the end of the file. Key patterns:
- **Data-driven rendering:** Large const arrays (`AGENTS`, `VERTICALS`, `PERSONAS`, `NEWS_ARTICLES`, `CASES`, `UNI_PATHS`, `INTG`) drive all UI via render functions
- **Phased init:** `init()` renders above-fold content immediately, defers below-fold via nested `requestAnimationFrame`
- **Persona system:** Users pick a persona (Government, SEN, Little Builder, Teen, Founder, SMB, She Builds, World) which customizes hero text, chat chips, and learning paths
- **Agent marketplace:** Search, filter by vertical (16 industries), filter by type (B2B/B2C), agent detail modals, "deploy" flow, team builder
- **Auth system:** Google sign-in modal + email auth
- **Checkout:** PayPal integration, plan selection modal
- **Trial/paywall system:** `localStorage`-based trial tracking (sessions, days), paywall modal for gated features
- **i18n:** `setLang()` function with `data-i18n` attributes for 12 languages
- **Scroll reveal:** IntersectionObserver-based `.rv` class animation

### Key Data Constants
- `VERTICALS` — 16 industry categories (healthcare, finance, ecommerce, legal, real estate, marketing, HR, education, engineering, operations, media, logistics, agriculture, travel, nonprofit, sports)
- `AGENTS` — 80+ agent definitions with name, description, vertical tags, tech stack, difficulty level, usage stats
- `PERSONAS` — 8 user personas with custom hero copy, chat chips, learning paths
- `INTG` — integration metadata (colors, icons) for tools like Slack, Gmail, Notion, etc.

## Key Features
- **No-code agent builder** with AI-powered configuration
- **80+ pre-built agent templates** across 16 industries
- **Persona-based onboarding** — site adapts to user type
- **Multilingual** — 12 language support
- **Accessibility** — reduced motion, RTL support
- **Freemium model** with trial tracking and paywall

## Memory Layer (Phase 1 — added 2026-04-24)

Every agent now has persistent memory that survives across conversations. Memory is scoped to (agent_id, visitor_id).

### Files
- `lib/memory/memoryTool.js` — 6 command handlers (view, create, str_replace, insert, delete, rename) + path validation + audit logging + system prompt snippet
- `pages/api/agents/run.js` — refactored with tool-use loop: Claude calls memory tool → handler executes → result fed back → Claude continues. Works for both streaming and standard responses.
- `scripts/migration-memory-layer.sql` — 2 new tables (agent_memory_files, agent_memory_access_log) + RLS policies + auto-timestamp trigger
- `tests/memory.test.js` — end-to-end test: store fact in session 1, recall in session 2

### Tables (additive — existing tables untouched)
- `agent_memory_files` — (agent_id, visitor_id, file_path, content, timestamps). Max 50 files per agent+visitor, max 10KB per file.
- `agent_memory_access_log` — audit trail for every memory operation.

### How It Works
1. Every agent's system prompt now includes a memory protocol instruction telling Claude to check /memories at conversation start
2. Claude can call the `memory` tool to view/create/edit/delete files in its memory directory
3. The tool calls are handled server-side by `memoryTool.js` which reads/writes Supabase
4. In streaming mode, tool calls happen silently before the final response streams to the user
5. `visitor_id` parameter (optional) in the API request scopes memory per end-user. Defaults to 'default'.

### Testing Locally
```bash
# 1. Run the migration in Supabase SQL Editor first
# 2. Start dev server
npm run dev
# 3. Run the test
node tests/memory.test.js
```

### Architecture Doc
Full runtime architecture blueprint at `CREATEAGENT_RUNTIME_ARCHITECTURE.md`. This memory layer is Phase 1 of a 4-phase plan. Phases 2-4 (skills, recall, gateway, marketplace) are not yet built.

## Working With This Codebase
- The landing page is a single `index.html` file (~4,900 lines)
- The Next.js app (pages/, lib/) is the actual agent platform
- CSS is at the top of index.html (~lines 1–1200), HTML structure (~1200–2250), JS data + logic (~2250–4900)
- Changes to agent data, verticals, or personas only require editing the JS constants
- No build step for index.html — edit and deploy directly
- Next.js pages require `npm run build` to verify
