import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppProvider } from "@/lib/context";
import { InstallApp } from "@/components/InstallApp";
import { FaqDrawer } from "@/components/FaqDrawer";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { cookies } from "next/headers";
import { getCatalogFilters } from "@/lib/api";
import { LOCALE_COOKIE, THEME_COOKIE, parseLocale, translator } from "@/lib/i18n";

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });

export function generateMetadata(): Metadata {
  const t = translator(parseLocale(cookies().get(LOCALE_COOKIE)?.value));
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    applicationName: 'TapWear',
    appleWebApp: { capable: true, title: 'TapWear', statusBarStyle: 'default' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The colour of the phone's status bar when the site is opened as an app.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f17' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The header menu and the filter controls are built from what the catalog contains.
  // If the API is down the pages still render and show their own error state.
  const locale = parseLocale(cookies().get(LOCALE_COOKIE)?.value);
  // The theme is read on the server, so a dark page never flashes light while loading.
  const dark = cookies().get(THEME_COOKIE)?.value === 'dark';
  const catalog = await getCatalogFilters(undefined, locale).catch(() => null);

  return (
    <html lang={locale} className={cn("font-sans", inter.variable, dark && "dark")}>
      <body className="antialiased min-w-[360px] bg-gray-50">
        <AppProvider catalog={catalog} locale={locale} dark={dark}>
          <InstallApp />
          <SiteHeader />
          {children}
          <SiteFooter />
          <FaqDrawer />
        </AppProvider>
      </body>
    </html>
  );
}
