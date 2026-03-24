#!/usr/bin/env node

/**
 * Seed script: inserts all 80 template agents into Supabase.
 * Run: node scripts/seed-agents.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Vertical key mapping from short codes used in the landing page
const VERTICAL_MAP = {
  healthcare: 'healthcare',
  finance: 'finance',
  ecommerce: 'ecommerce',
  legal: 'legal',
  realestate: 'real-estate',
  marketing: 'marketing',
  hr: 'hr',
  education: 'education',
  engineering: 'engineering',
  operations: 'operations',
  media: 'media',
  logistics: 'logistics',
  agriculture: 'agriculture',
  travel: 'travel',
  nonprofit: 'nonprofit',
  sports: 'sports',
}

const AGENTS = [
  // HEALTHCARE
  { id: 1, n: 'Medical Intake Processor', e: '🏥', d: 'Processes patient intake forms, extracts structured data, flags urgent cases, and syncs to EHR systems automatically.', v: ['healthcare'], t: ['Claude Haiku', 'Epic EHR', 'Twilio', 'OCR API', 'HIPAA Vault'], lvl: 'advanced', runs: '8.7k', rat: '4.9' },
  { id: 2, n: 'Patient Appointment Manager', e: '📅', d: 'Books, reschedules, and cancels appointments. Sends automated reminders and fills cancellations from waitlists.', v: ['healthcare'], t: ['Claude Haiku', 'Calendly', 'Twilio', 'EHR API', 'Gmail'], lvl: 'easy', runs: '15.3k', rat: '4.8' },
  { id: 3, n: 'Drug Interaction Checker', e: '💊', d: 'Scans patient medication lists against interaction databases and alerts prescribers to dangerous combinations.', v: ['healthcare'], t: ['Claude Haiku', 'DrugBank API', 'EHR API', 'PagerDuty'], lvl: 'advanced', runs: '4.8k', rat: '5.0' },
  { id: 4, n: 'Clinical Report Summariser', e: '📋', d: 'Reads lengthy clinical notes and lab results, generates concise plain-language summaries for patients and care teams.', v: ['healthcare'], t: ['Claude Haiku', 'EHR API', 'Google Drive', 'Slack'], lvl: 'medium', runs: '6.2k', rat: '4.8' },
  { id: 5, n: 'Mental Health Check-In Bot', e: '🧠', d: 'Sends daily wellbeing check-ins to employees or patients, tracks mood trends, surfaces burnout indicators.', v: ['healthcare', 'hr'], t: ['Claude Haiku', 'Slack', 'Airtable', 'Twilio'], lvl: 'easy', runs: '9.4k', rat: '4.7' },
  { id: 6, n: 'Clinical Trial Matcher', e: '🔬', d: 'Matches patients to eligible clinical trials based on diagnosis, location, and eligibility criteria from ClinicalTrials.gov.', v: ['healthcare'], t: ['Claude Haiku', 'ClinicalTrials API', 'Gmail', 'Notion'], lvl: 'advanced', runs: '2.1k', rat: '4.9' },
  // FINANCE
  { id: 7, n: 'Financial Report Generator', e: '📊', d: 'Pulls data from QuickBooks/Xero, generates narrative P&L summaries, flags anomalies, and sends weekly briefings.', v: ['finance'], t: ['Claude Haiku', 'QuickBooks', 'Xero', 'Google Sheets', 'Slack'], lvl: 'medium', runs: '6.3k', rat: '4.8' },
  { id: 8, n: 'Invoice Processing Agent', e: '🧾', d: 'Extracts invoice data from PDFs, matches to purchase orders, flags discrepancies, and auto-approves within threshold.', v: ['finance', 'operations'], t: ['Claude Haiku', 'OCR API', 'QuickBooks', 'Gmail', 'Slack'], lvl: 'medium', runs: '9.8k', rat: '4.7' },
  { id: 9, n: 'FinTech Fraud Detector', e: '🛡️', d: 'Monitors transaction patterns in real time, flags suspicious activity, and alerts compliance teams instantly.', v: ['finance'], t: ['Claude Haiku', 'Stripe', 'Plaid API', 'PagerDuty', 'Slack'], lvl: 'advanced', runs: '5.9k', rat: '5.0' },
  { id: 10, n: 'Tax Preparation Agent', e: '🧮', d: 'Collects financial documents, categorises expenses, identifies deductions, and prepares structured tax summaries.', v: ['finance'], t: ['Claude Haiku', 'QuickBooks', 'Google Drive', 'Gmail'], lvl: 'medium', runs: '7.1k', rat: '4.7' },
  { id: 11, n: 'Investment Research Bot', e: '📈', d: 'Monitors equity news, earnings reports, and analyst ratings. Generates daily investment briefings with sentiment scores.', v: ['finance'], t: ['Claude Haiku', 'Bloomberg API', 'Notion', 'Gmail'], lvl: 'advanced', runs: '4.4k', rat: '4.8' },
  { id: 12, n: 'Payroll Processing Agent', e: '💵', d: 'Calculates payroll, handles deductions, generates payslips, and syncs with HMRC/IRS filing systems.', v: ['finance', 'hr'], t: ['Claude Haiku', 'QuickBooks', 'Workday', 'Gmail'], lvl: 'medium', runs: '5.7k', rat: '4.8' },
  // ECOMMERCE
  { id: 13, n: 'E-commerce Support Bot', e: '🛒', d: 'Handles order tracking, returns, FAQs, and escalations. Integrates directly with Shopify and WooCommerce.', v: ['ecommerce'], t: ['Claude Haiku', 'Shopify', 'Zendesk', 'Twilio', 'Klaviyo'], lvl: 'easy', runs: '31.4k', rat: '4.7' },
  { id: 14, n: 'Product Description Writer', e: '✍️', d: 'Generates SEO-optimised product descriptions, titles, and meta tags from product specs and images in bulk.', v: ['ecommerce', 'marketing'], t: ['Claude Haiku', 'Shopify', 'Notion', 'Google Sheets'], lvl: 'easy', runs: '18.7k', rat: '4.8' },
  { id: 15, n: 'Abandoned Cart Recovery', e: '🛍️', d: 'Monitors cart abandonment, sends personalised follow-up sequences, and tracks revenue recovery over time.', v: ['ecommerce'], t: ['Claude Haiku', 'Shopify', 'Klaviyo', 'Stripe'], lvl: 'medium', runs: '12.3k', rat: '4.8' },
  { id: 16, n: 'Inventory Alert Agent', e: '📦', d: 'Monitors stock levels, predicts reorder points, generates purchase orders, and alerts on stockout risk.', v: ['ecommerce', 'operations'], t: ['Claude Haiku', 'Shopify', 'Airtable', 'Gmail', 'Slack'], lvl: 'easy', runs: '14.2k', rat: '4.7' },
  { id: 17, n: 'Review Response Agent', e: '⭐', d: 'Monitors new product reviews, generates personalised responses, and escalates critical feedback to the team.', v: ['ecommerce', 'marketing'], t: ['Claude Haiku', 'Shopify', 'Trustpilot API', 'Gmail'], lvl: 'easy', runs: '10.5k', rat: '4.6' },
  // LEGAL
  { id: 18, n: 'Contract Review Agent', e: '⚖️', d: 'Reviews contracts for risk clauses, missing terms, and compliance issues. Generates redline summaries and reports.', v: ['legal'], t: ['Claude Haiku', 'DocuSign', 'Notion', 'Google Drive'], lvl: 'advanced', runs: '5.1k', rat: '4.9' },
  { id: 19, n: 'Compliance Monitor', e: '🔍', d: 'Monitors regulatory feeds, flags relevant rule changes, maps to internal policies, and drafts compliance update summaries.', v: ['legal', 'finance'], t: ['Claude Haiku', 'Westlaw', 'Notion', 'Jira', 'Slack'], lvl: 'advanced', runs: '3.2k', rat: '4.9' },
  { id: 20, n: 'Legal Research Assistant', e: '📚', d: 'Researches case law, statutes, and precedents on a given topic. Produces structured memos with citations.', v: ['legal'], t: ['Claude Haiku', 'Westlaw', 'LexisNexis', 'Notion'], lvl: 'advanced', runs: '4.6k', rat: '4.8' },
  { id: 21, n: 'Document Drafting Agent', e: '📄', d: 'Generates first drafts of NDAs, employment contracts, service agreements, and standard legal documents.', v: ['legal'], t: ['Claude Haiku', 'Google Docs', 'DocuSign', 'Notion'], lvl: 'medium', runs: '8.3k', rat: '4.7' },
  // REAL ESTATE
  { id: 22, n: 'Property Listing Optimiser', e: '🏠', d: 'Rewrites property descriptions, generates social posts, and auto-publishes to Zillow, Rightmove, and MLS.', v: ['real-estate'], t: ['Claude Haiku', 'Zillow API', 'Buffer', 'Canva API', 'Airtable'], lvl: 'easy', runs: '9.2k', rat: '4.6' },
  { id: 23, n: 'Market Analysis Agent', e: '📊', d: 'Aggregates MLS data, calculates fair value ranges, predicts micro-market trends, and generates client reports.', v: ['real-estate'], t: ['Claude Haiku', 'Zillow API', 'Google Sheets', 'Canva', 'Gmail'], lvl: 'medium', runs: '6.1k', rat: '4.8' },
  { id: 24, n: 'Tenant Screening Bot', e: '🔑', d: 'Processes rental applications, runs background and credit checks, and scores applicants against your criteria.', v: ['real-estate'], t: ['Claude Haiku', 'Stripe', 'TransUnion API', 'Gmail'], lvl: 'medium', runs: '7.4k', rat: '4.7' },
  { id: 25, n: 'Lease Management Agent', e: '📝', d: 'Tracks lease expiry dates, sends renewal reminders, generates renewal documents, and logs communications.', v: ['real-estate', 'operations'], t: ['Claude Haiku', 'DocuSign', 'Airtable', 'Gmail'], lvl: 'easy', runs: '5.8k', rat: '4.7' },
  // MARKETING
  { id: 26, n: 'Lead Qualification Agent', e: '🎯', d: 'Scores inbound leads using ICP criteria, enriches with company data, and routes hot leads to sales reps.', v: ['marketing'], t: ['Claude Haiku', 'HubSpot', 'Clearbit', 'Slack', 'Gmail'], lvl: 'medium', runs: '14.2k', rat: '4.9' },
  { id: 27, n: 'Social Media Content Engine', e: '📣', d: 'Generates a week of platform-specific social content from a brief. Schedules posts and monitors engagement.', v: ['marketing', 'media'], t: ['Claude Haiku', 'Buffer', 'Canva', 'Hootsuite'], lvl: 'easy', runs: '28.7k', rat: '4.7' },
  { id: 28, n: 'Email Campaign Agent', e: '✉️', d: 'Writes personalised email sequences, A/B tests subject lines, and optimises send times based on engagement data.', v: ['marketing'], t: ['Claude Haiku', 'Mailchimp', 'Klaviyo', 'HubSpot'], lvl: 'medium', runs: '16.4k', rat: '4.8' },
  { id: 29, n: 'SEO Research & Drafting Bot', e: '🔎', d: 'Researches target keywords, analyses competitor pages, and generates SEO-optimised article drafts with metadata.', v: ['marketing', 'media'], t: ['Claude Haiku', 'SEMrush API', 'Notion', 'WordPress'], lvl: 'medium', runs: '11.8k', rat: '4.7' },
  { id: 30, n: 'Churn Prediction Agent', e: '📉', d: 'Analyses user behaviour to flag at-risk customers and triggers personalised retention sequences automatically.', v: ['marketing', 'ecommerce'], t: ['Claude Haiku', 'Mixpanel', 'Klaviyo', 'HubSpot', 'Segment'], lvl: 'advanced', runs: '8.3k', rat: '4.8' },
  // HR
  { id: 31, n: 'Resume Screening Agent', e: '👥', d: 'Scores resumes against job requirements, ranks candidates, drafts interview questions, and schedules calls.', v: ['hr'], t: ['Claude Haiku', 'Greenhouse', 'LinkedIn API', 'Cal.com'], lvl: 'medium', runs: '11.8k', rat: '4.9' },
  { id: 32, n: 'Employee Onboarding Bot', e: '🤝', d: 'Guides new hires through onboarding checklists, provisions accounts, answers HR questions, and collects documents.', v: ['hr'], t: ['Claude Haiku', 'Workday', 'Okta', 'Slack', 'DocuSign'], lvl: 'medium', runs: '7.6k', rat: '4.8' },
  { id: 33, n: 'Performance Review Agent', e: '🏆', d: 'Collects 360° feedback, synthesises responses, identifies patterns, and generates structured review summaries.', v: ['hr'], t: ['Claude Haiku', 'Workday', 'Google Forms', 'Slack'], lvl: 'medium', runs: '5.4k', rat: '4.7' },
  { id: 34, n: 'Benefits Enrolment Bot', e: '🩺', d: 'Guides employees through benefits selection, answers plan questions, and submits enrolment forms automatically.', v: ['hr'], t: ['Claude Haiku', 'Workday', 'Slack', 'Gmail'], lvl: 'easy', runs: '6.2k', rat: '4.7' },
  { id: 35, n: 'Job Description Generator', e: '📝', d: 'Creates compelling, inclusive job descriptions from role briefs. Checks for biased language and optimises for search.', v: ['hr', 'marketing'], t: ['Claude Haiku', 'Greenhouse', 'LinkedIn', 'Notion'], lvl: 'easy', runs: '9.7k', rat: '4.8' },
  // EDUCATION
  { id: 36, n: 'Personalised Study Coach', e: '📚', d: 'Assesses knowledge gaps, builds custom study plans, generates practice questions, and tracks progress over time.', v: ['education'], t: ['Claude Haiku', 'Notion', 'Khan Academy API', 'Stripe'], lvl: 'easy', runs: '22.4k', rat: '4.9' },
  { id: 37, n: 'Course Creation Agent', e: '🎓', d: 'Transforms a topic brief into a full course outline, lesson scripts, quizzes, and supplementary materials.', v: ['education'], t: ['Claude Haiku', 'Notion', 'Teachable', 'Loom'], lvl: 'medium', runs: '6.8k', rat: '4.8' },
  { id: 38, n: 'Scholarship Finder', e: '🏫', d: 'Searches global scholarship databases by student profile, generates personalised application essays, and tracks deadlines.', v: ['education'], t: ['Claude Haiku', 'Scholarships.com API', 'Notion', 'Gmail'], lvl: 'easy', runs: '8.9k', rat: '4.8' },
  { id: 39, n: 'Grant Proposal Writer', e: '✍️', d: 'Researches matching grants, drafts compelling proposals tailored to each funder, and tracks submission deadlines.', v: ['education', 'operations'], t: ['Claude Haiku', 'Grants.gov API', 'Notion', 'Google Docs'], lvl: 'medium', runs: '3.7k', rat: '4.9' },
  // ENGINEERING
  { id: 40, n: 'Code Review Bot', e: '💻', d: 'Reviews pull requests for bugs, security issues, and style problems. Comments on GitHub and blocks unsafe merges.', v: ['engineering'], t: ['Claude Haiku', 'GitHub', 'Linear', 'Sentry', 'Slack'], lvl: 'advanced', runs: '22.1k', rat: '4.9' },
  { id: 41, n: 'Bug Triage Agent', e: '🐛', d: 'Classifies bug reports by severity, assigns to the right engineers, updates Jira, and tracks to resolution.', v: ['engineering'], t: ['Claude Haiku', 'Jira', 'GitHub', 'Sentry', 'PagerDuty'], lvl: 'medium', runs: '16.7k', rat: '4.8' },
  { id: 42, n: 'Documentation Generator', e: '📖', d: 'Reads source code, generates developer documentation, API references, and README files automatically.', v: ['engineering'], t: ['Claude Haiku', 'GitHub', 'Notion', 'Confluence'], lvl: 'medium', runs: '12.4k', rat: '4.7' },
  { id: 43, n: 'Deploy Pipeline Agent', e: '🚀', d: 'Monitors CI/CD pipelines, automatically rolls back failed deployments, and notifies teams with root cause analysis.', v: ['engineering'], t: ['Claude Haiku', 'GitHub Actions', 'Vercel', 'PagerDuty', 'Slack'], lvl: 'advanced', runs: '9.6k', rat: '4.8' },
  { id: 44, n: 'Incident Response Agent', e: '🚨', d: 'Detects production incidents, correlates logs and metrics, drafts incident reports, and coordinates response.', v: ['engineering', 'operations'], t: ['Claude Haiku', 'Datadog', 'PagerDuty', 'Slack', 'Jira'], lvl: 'advanced', runs: '7.3k', rat: '4.9' },
  // OPERATIONS
  { id: 45, n: 'Meeting Notes Agent', e: '📝', d: 'Joins meetings via transcript, extracts action items, assigns owners, and sends follow-up summaries automatically.', v: ['operations'], t: ['Claude Haiku', 'Otter.ai', 'Notion', 'Slack', 'Calendar API'], lvl: 'easy', runs: '19.8k', rat: '4.8' },
  { id: 46, n: 'Vendor Management Bot', e: '🤝', d: 'Tracks vendor contracts, renewal dates, performance SLAs, and automates vendor communication workflows.', v: ['operations'], t: ['Claude Haiku', 'Airtable', 'DocuSign', 'Gmail', 'Slack'], lvl: 'medium', runs: '5.4k', rat: '4.7' },
  { id: 47, n: 'Data Entry Automation', e: '⌨️', d: 'Extracts data from PDFs, emails, and spreadsheets. Maps and populates target systems with validation checks.', v: ['operations', 'finance'], t: ['Claude Haiku', 'OCR API', 'Google Sheets', 'Airtable'], lvl: 'easy', runs: '23.6k', rat: '4.6' },
  { id: 48, n: 'Supply Chain Risk Monitor', e: '⛓️', d: 'Monitors supplier news, geopolitical events, and inventory levels. Sends early warnings and recommends alternatives.', v: ['operations', 'logistics'], t: ['Claude Haiku', 'News API', 'SAP', 'Slack', 'Google Sheets'], lvl: 'advanced', runs: '2.9k', rat: '4.9' },
  // MEDIA
  { id: 49, n: 'Video Script Generator', e: '🎬', d: 'Transforms briefs into full YouTube/TikTok/Reel scripts with hooks, bodies, CTAs, and B-roll suggestions.', v: ['media', 'marketing'], t: ['Claude Haiku', 'YouTube Data API', 'Notion', 'Airtable'], lvl: 'easy', runs: '19.4k', rat: '4.7' },
  { id: 50, n: 'Podcast Research Agent', e: '🎙️', d: 'Researches guests, generates interview question sets, creates show notes, and drafts episode descriptions.', v: ['media'], t: ['Claude Haiku', 'Notion', 'Buzzsprout API', 'LinkedIn API'], lvl: 'easy', runs: '9.2k', rat: '4.7' },
  { id: 51, n: 'News Summariser Bot', e: '📰', d: 'Monitors news sources by topic, generates daily briefings in any format, and distributes via email or Slack.', v: ['media', 'operations'], t: ['Claude Haiku', 'News API', 'Gmail', 'Slack', 'Notion'], lvl: 'easy', runs: '14.7k', rat: '4.7' },
  { id: 52, n: 'Teen Creator Agent', e: '🎮', d: 'Automates YouTube descriptions, hashtag research, and posting schedules for young content creators.', v: ['media', 'education'], t: ['Claude Haiku', 'YouTube API', 'Buffer', 'Notion'], lvl: 'easy', runs: '18.3k', rat: '4.8' },
  // LOGISTICS
  { id: 53, n: 'Freight Rate Analyser', e: '🚚', d: 'Monitors freight rates across carriers, alerts on anomalies, suggests optimal routing, and generates cost reports.', v: ['logistics'], t: ['Claude Haiku', 'Freightos API', 'Google Sheets', 'Slack', 'FedEx API'], lvl: 'medium', runs: '4.1k', rat: '4.7' },
  { id: 54, n: 'Delivery Status Bot', e: '📦', d: 'Tracks shipment status across carriers, proactively notifies customers of delays, and handles exception resolution.', v: ['logistics', 'ecommerce'], t: ['Claude Haiku', 'FedEx API', 'UPS API', 'Twilio', 'Shopify'], lvl: 'easy', runs: '21.3k', rat: '4.7' },
  { id: 55, n: 'Customs Documentation Agent', e: '📋', d: 'Generates customs declarations, harmonised codes, and export documentation from shipment manifests.', v: ['logistics'], t: ['Claude Haiku', 'OCR API', 'Google Docs', 'Airtable'], lvl: 'medium', runs: '3.8k', rat: '4.8' },
  { id: 56, n: 'Carbon Footprint Tracker', e: '🌍', d: 'Monitors carbon emissions across supply chain operations, generates ESG reports, and tracks sustainability KPIs.', v: ['operations', 'logistics'], t: ['Claude Haiku', 'Carbon API', 'Google Sheets', 'Slack'], lvl: 'medium', runs: '2.8k', rat: '4.9' },
  // AGRICULTURE
  { id: 57, n: 'Crop Disease Detector', e: '🌾', d: 'Analyses field photos or sensor data to identify crop diseases, recommends treatments, and alerts farmers instantly.', v: ['agriculture'], t: ['Claude Haiku', 'Vision API', 'WhatsApp Business', 'Airtable'], lvl: 'easy', runs: '6.4k', rat: '4.9' },
  { id: 58, n: 'Smart Irrigation Agent', e: '💧', d: 'Integrates weather forecasts and soil moisture sensors to automate irrigation scheduling and reduce water waste.', v: ['agriculture'], t: ['Claude Haiku', 'OpenWeather API', 'IoT Hub', 'Airtable', 'SMS API'], lvl: 'medium', runs: '3.2k', rat: '4.8' },
  { id: 59, n: 'Market Price Monitor', e: '📊', d: 'Tracks commodity prices across markets, sends price alerts, recommends optimal selling windows for farmers.', v: ['agriculture'], t: ['Claude Haiku', 'FAO API', 'WhatsApp Business', 'Google Sheets'], lvl: 'easy', runs: '5.1k', rat: '4.7' },
  { id: 60, n: 'Livestock Health Tracker', e: '🐄', d: 'Monitors animal health records, flags vaccination schedules, and generates vet reports from farm management systems.', v: ['agriculture'], t: ['Claude Haiku', 'FarmOS API', 'Gmail', 'Airtable', 'Twilio'], lvl: 'medium', runs: '2.9k', rat: '4.8' },
  { id: 61, n: 'Subsidy & Grant Finder', e: '🏛️', d: 'Searches agricultural subsidy databases by country and farm type, generates application summaries and deadline trackers.', v: ['agriculture', 'education'], t: ['Claude Haiku', 'USDA API', 'GOV.UK API', 'Notion', 'Gmail'], lvl: 'easy', runs: '4.7k', rat: '4.9' },
  // TRAVEL
  { id: 62, n: 'Travel Itinerary Builder', e: '✈️', d: 'Creates personalised day-by-day travel plans with hotels, restaurants, and attractions based on budget and preferences.', v: ['travel'], t: ['Claude Haiku', 'Google Maps API', 'Booking.com API', 'Notion', 'Gmail'], lvl: 'easy', runs: '18.6k', rat: '4.8' },
  { id: 63, n: 'Hotel Guest Services Bot', e: '🏨', d: 'Handles room requests, dining reservations, local recommendations, and checkout queries — available 24/7 via WhatsApp.', v: ['travel'], t: ['Claude Haiku', 'WhatsApp Business', 'Airtable', 'Stripe', 'Zapier'], lvl: 'easy', runs: '12.3k', rat: '4.7' },
  { id: 64, n: 'Visa & Travel Requirements', e: '🛂', d: 'Checks visa requirements, entry restrictions, and travel advisories for any nationality/destination pair in real time.', v: ['travel'], t: ['Claude Haiku', 'IATA API', 'FCO API', 'Gmail', 'Notion'], lvl: 'medium', runs: '9.1k', rat: '4.9' },
  { id: 65, n: 'Flight & Price Monitor', e: '🎫', d: 'Tracks flight price trends, sends alerts when fares drop, and suggests optimal booking windows for your route.', v: ['travel'], t: ['Claude Haiku', 'Skyscanner API', 'Gmail', 'Twilio', 'Airtable'], lvl: 'easy', runs: '14.2k', rat: '4.7' },
  { id: 66, n: 'Restaurant Review Aggregator', e: '🍽️', d: 'Monitors reviews across Google, TripAdvisor, and Yelp, generates weekly reputation reports, and drafts owner responses.', v: ['travel', 'marketing'], t: ['Claude Haiku', 'Google Places API', 'TripAdvisor', 'Slack', 'Notion'], lvl: 'medium', runs: '7.8k', rat: '4.7' },
  // NONPROFIT
  { id: 67, n: 'Grant Research Agent', e: '🤝', d: 'Searches funding databases for grants matching your cause, generates tailored opportunity summaries and application timelines.', v: ['nonprofit'], t: ['Claude Haiku', 'Candid API', 'Notion', 'Gmail', 'Airtable'], lvl: 'easy', runs: '5.3k', rat: '4.9' },
  { id: 68, n: 'Donor Outreach Agent', e: '💌', d: 'Personalises donor communications, tracks engagement, segments audiences, and automates thank-you and impact reports.', v: ['nonprofit', 'marketing'], t: ['Claude Haiku', 'Mailchimp', 'HubSpot', 'Airtable', 'Stripe'], lvl: 'medium', runs: '4.1k', rat: '4.8' },
  { id: 69, n: 'Volunteer Coordinator Bot', e: '🙋', d: 'Manages volunteer sign-ups, sends assignments and reminders, tracks hours, and generates impact certificates.', v: ['nonprofit', 'hr'], t: ['Claude Haiku', 'Airtable', 'Twilio', 'Gmail', 'Cal.com'], lvl: 'easy', runs: '3.7k', rat: '4.8' },
  { id: 70, n: 'Impact Report Generator', e: '📈', d: 'Aggregates programme data and beneficiary outcomes to generate compelling impact reports for funders and stakeholders.', v: ['nonprofit'], t: ['Claude Haiku', 'Airtable', 'Google Sheets', 'Canva', 'Notion'], lvl: 'medium', runs: '2.9k', rat: '4.9' },
  { id: 71, n: 'Community Needs Survey Bot', e: '🗺️', d: 'Conducts structured community needs assessments via SMS/WhatsApp, aggregates responses, and generates priority reports.', v: ['nonprofit', 'operations'], t: ['Claude Haiku', 'WhatsApp Business', 'Typeform', 'Airtable', 'Notion'], lvl: 'easy', runs: '3.4k', rat: '4.9' },
  // SPORTS
  { id: 72, n: 'Athlete Performance Tracker', e: '🏋️', d: 'Analyses training logs, sleep, and nutrition data to generate weekly performance insights and personalised coaching tips.', v: ['sports'], t: ['Claude Haiku', 'Strava API', 'Garmin API', 'Notion', 'Gmail'], lvl: 'medium', runs: '8.2k', rat: '4.8' },
  { id: 73, n: 'Sports Content Creator', e: '🏆', d: 'Generates match reports, player highlights, social posts, and press releases from match statistics and game data.', v: ['sports', 'media'], t: ['Claude Haiku', 'SportRadar API', 'Buffer', 'WordPress', 'Canva'], lvl: 'easy', runs: '11.4k', rat: '4.7' },
  { id: 74, n: 'Team Analytics Agent', e: '📊', d: 'Processes match statistics and performance data to identify patterns, compare competitors, and build scouting reports.', v: ['sports'], t: ['Claude Haiku', 'Opta API', 'Tableau', 'Google Sheets', 'Slack'], lvl: 'advanced', runs: '4.6k', rat: '4.8' },
  { id: 75, n: 'Nutrition & Diet Planner', e: '🥗', d: 'Creates personalised meal plans for athletes based on training schedule, goals, and dietary restrictions with shopping lists.', v: ['sports', 'healthcare'], t: ['Claude Haiku', 'Nutritionix API', 'Notion', 'WhatsApp Business'], lvl: 'easy', runs: '9.7k', rat: '4.7' },
  // CROSS-VERTICAL
  { id: 76, n: 'Social Listening Agent', e: '👂', d: 'Monitors brand mentions across Twitter/X, Reddit, TikTok and news sites. Alerts on sentiment shifts and viral moments.', v: ['marketing', 'media'], t: ['Claude Haiku', 'Brandwatch', 'Slack', 'Notion', 'Gmail'], lvl: 'medium', runs: '7.3k', rat: '4.8' },
  { id: 77, n: 'Customer Journey Mapper', e: '🗺️', d: 'Analyses CRM data to map full customer journeys, identify drop-off points, and generate personalised re-engagement flows.', v: ['marketing', 'ecommerce'], t: ['Claude Haiku', 'Segment', 'HubSpot', 'Mixpanel', 'Notion'], lvl: 'advanced', runs: '5.1k', rat: '4.8' },
  { id: 78, n: 'Telemedicine Pre-Assessment', e: '🩺', d: 'Conducts structured pre-appointment symptom checks, summarises chief complaints, and triages by urgency before the consult.', v: ['healthcare'], t: ['Claude Haiku', 'Twilio', 'EHR API', 'HIPAA Vault', 'Calendly'], lvl: 'medium', runs: '5.3k', rat: '4.9' },
  { id: 79, n: 'Security Compliance Monitor', e: '🔐', d: 'Continuously audits infrastructure against SOC2, ISO27001, and GDPR controls. Flags gaps and generates remediation tickets.', v: ['engineering', 'operations'], t: ['Claude Haiku', 'AWS Config', 'Jira', 'Slack', 'PagerDuty'], lvl: 'advanced', runs: '3.9k', rat: '4.9' },
  { id: 80, n: 'Micro-Learning Burst Creator', e: '⚡', d: 'Transforms long-form content into 3-minute micro-lessons, quizzes, and spaced-repetition flashcard decks for any topic.', v: ['education', 'hr'], t: ['Claude Haiku', 'Notion', 'Loom', 'Teachable', 'Airtable'], lvl: 'easy', runs: '7.6k', rat: '4.8' },
]

async function seed() {
  console.log('Seeding 80 template agents into Supabase...\n')

  // First, delete existing templates to avoid duplicates
  const { error: deleteError } = await supabase
    .from('agents')
    .delete()
    .is('owner_id', null)

  if (deleteError) {
    console.error('Warning: could not clear existing templates:', deleteError.message)
  }

  const rows = AGENTS.map((a) => ({
    name: a.n,
    description: a.d,
    vertical: a.v[0], // Primary vertical
    owner_id: null,
    workspace_id: null,
    status: 'active',
    run_count: 0,
    config: {
      is_template: true,
      emoji: a.e,
      verticals: a.v,
      integrations: a.t,
      difficulty: a.lvl,
      rating: a.rat,
      usage: a.runs,
      system_prompt: `You are ${a.n}. ${a.d}`,
      purpose: a.d,
      steps: [],
      tags: a.v,
    },
  }))

  // Insert in batches of 20
  let inserted = 0
  for (let i = 0; i < rows.length; i += 20) {
    const batch = rows.slice(i, i + 20)
    const { data, error } = await supabase
      .from('agents')
      .insert(batch)
      .select('id, name')

    if (error) {
      console.error(`Batch ${i / 20 + 1} failed:`, error.message)
    } else {
      inserted += data.length
      data.forEach((a) => console.log(`  ✓ ${a.name}`))
    }
  }

  console.log(`\nDone! Inserted ${inserted}/80 template agents.`)
}

seed().catch(console.error)
