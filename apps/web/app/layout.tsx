import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { AppProvider } from "@/lib/context";
import { SiteHeader } from "@/components/SiteHeader";

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "TopWear - Каталог одежды",
  description: "Каталог одежды для Кыргызстана с визуальным поиском",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={cn("font-sans", inter.variable)}>
      <body className="antialiased min-w-[360px] bg-gray-50">
        <AppProvider>
          <SiteHeader />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
