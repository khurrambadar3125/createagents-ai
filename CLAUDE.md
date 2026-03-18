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

## Working With This Codebase
- Since everything is in one file, use line-number ranges or search to navigate
- CSS is at the top (~lines 1–1200), HTML structure (~1200–2250), JS data + logic (~2250–4900)
- Changes to agent data, verticals, or personas only require editing the JS constants
- No build step — edit and deploy directly
