import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Device compatibility */}
        <meta name="theme-color" content="#1B3A2D" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#1B3A2D" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* SEO */}
        <meta name="description" content="Build AI agents with words, not code. Describe it. We build it. You deploy it. 96 agents, 18 verticals, 13 languages." />
        <meta name="keywords" content="AI agents, no-code, automation, createagent, artificial intelligence" />
        <meta property="og:title" content="CreateAgent.ai — Build AI Agents with Words" />
        <meta property="og:description" content="Describe the agent you need. We build it. You deploy it. From idea to production in under 3 minutes." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://createagents.ai" />
        <meta name="twitter:card" content="summary_large_image" />

        {/* Fonts — preconnect for speed */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />

        {/* Icons */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />

        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <body className="bg-cream">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
