import type { Metadata } from 'next'
import Script from 'next/script'
import { Source_Sans_3, Noto_Sans_Sinhala, Noto_Sans_Tamil } from 'next/font/google'
import { LanguageProvider } from '@/providers/LanguageProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { VoiceOutputProvider } from '@/hooks/useVoiceOutput'
import { SplashScreen } from '@/components/loading/SplashScreen'
import './globals.css'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source-sans',
  display: 'swap',
})

const notoSinhala = Noto_Sans_Sinhala({
  subsets: ['sinhala'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sinhala',
  display: 'swap',
})

const notoTamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-tamil',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Kapruka Anu',
  description: 'Shop Kapruka with Anu, your personal shopping assistant',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${sourceSans.variable} ${notoSinhala.variable} ${notoTamil.variable} h-full`}
    >
      <head>
        <Script id="anu-theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('anu-theme');if(!t){localStorage.setItem('anu-theme','light');t='light';}if(t==='dark')document.documentElement.dataset.theme='dark';else document.documentElement.dataset.theme='light';}catch(e){document.documentElement.dataset.theme='light';}})();`}
        </Script>
      </head>
      <body className="h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <VoiceOutputProvider>
              <SplashScreen />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
            </VoiceOutputProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
