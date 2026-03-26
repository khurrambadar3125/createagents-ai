import '@/styles/globals.css'
import Head from 'next/head'
import { I18nProvider } from '@/lib/i18n'

export default function App({ Component, pageProps }) {
  return (
    <I18nProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
      </Head>
      <Component {...pageProps} />
    </I18nProvider>
  )
}
