import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppProvider } from "@/lib/context";
import { SiteHeader } from "@/components/SiteHeader";
import { cookies } from "next/headers";
import { getCatalogFilters } from "@/lib/api";
import { LOCALE_COOKIE, parseLocale, translator } from "@/lib/i18n";

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });

export function generateMetadata(): Metadata {
  const t = translator(parseLocale(cookies().get(LOCALE_COOKIE)?.value));
  return { title: t('meta.title'), description: t('meta.description') };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The header menu and the filter controls are built from what the catalog contains.
  // If the API is down the pages still render and show their own error state.
  const locale = parseLocale(cookies().get(LOCALE_COOKIE)?.value);
  const catalog = await getCatalogFilters(undefined, locale).catch(() => null);

  return (
    <html lang={locale} className={cn("font-sans", inter.variable)}>
      <body className="antialiased min-w-[360px] bg-gray-50">
        <AppProvider catalog={catalog} locale={locale}>
          <SiteHeader />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
