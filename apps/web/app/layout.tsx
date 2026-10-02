import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppProvider } from "@/lib/context";
import { SiteHeader } from "@/components/SiteHeader";
import { getCatalogFilters } from "@/lib/api";

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "TapWear - Каталог одежды",
  description: "Каталог одежды для Кыргызстана с визуальным поиском",
};

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
  const catalog = await getCatalogFilters().catch(() => null);

  return (
    <html lang="ru" className={cn("font-sans", inter.variable)}>
      <body className="antialiased min-w-[360px] bg-gray-50">
        <AppProvider catalog={catalog}>
          <SiteHeader />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
