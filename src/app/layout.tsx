import type { Metadata } from "next";
import { Inter, Merriweather, Nunito, PT_Serif, Rethink_Sans } from "next/font/google";
import React, { ReactNode } from "react";
import { ViewTransitions } from "next-view-transitions";
import { SessionProviders } from "./providers";
import "./globals.css";
import ProgressBarProvider from "./components/ProgressBarProvider";
import { OverflowScrollGuard } from "./components/overflow-scroll-guard";
import { SITE_DESCRIPTION, SITE_NAME } from "@/config/site";
import { getSiteUrl } from "@/utils/site-url";
import { CommunityNavigation } from "@/components/servers/community-navigation";
import { OverlayExit } from "@/components/overlay-exit";
import { THEME_SCRIPT } from "@/components/site/theme";
import { PerfProbe } from "@/components/perf-probe";
import { PreviewBanner } from "@/preview/banner";

// The site's one typeface for every title, label and line: Rethink Sans, a
// clean grotesque that holds a 44px headline and stays even at 12px. The faces
// below stay loaded for the document and spreadsheet editors' font menus and
// the Gallery Heading.
const rethink = Rethink_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-rethink",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-inter",
});

// For the editors' font menus only.
const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-nunito",
});

// Painted by the Gallery Heading into its canvas, from a copy in /fonts with
// permissive CORS (that document is sandboxed and cannot reach a same-origin
// asset).
const merriweather = Merriweather({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["300", "400", "700", "900"],
  variable: "--font-merriweather",
});

const ptSerif = PT_Serif({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-pt-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  // The tab always reads just "Bot" — no page suffixes.
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    /* No `images` here: src/app/opengraph-image.tsx generates the card from the
       same constants as the page, and naming a file here would override it. */
    url: getSiteUrl(),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    // Same: the generated card serves Twitter too.
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${rethink.variable} ${nunito.variable} ${merriweather.variable} ${inter.variable} ${ptSerif.variable} dark`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <meta charSet="UTF-8" />
        {/* `viewport-fit=cover` enables the safe-area insets; without it every
           `env(safe-area-inset-*)` is 0. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <meta name="theme-color" content="#030303" />
        {/* Classic public fonts for the document + spreadsheet editors' font pickers. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Open+Sans:wght@400;700&family=Lato:wght@400;700&family=Montserrat:wght@400;700&family=Poppins:wght@400;600&family=Merriweather:wght@400;700&family=Playfair+Display:wght@400;700&family=Source+Code+Pro:wght@400;600&display=swap"
          rel="stylesheet"
        />
        {/* Applies the saved appearance before paint (see THEME_SCRIPT in
           site/theme.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="dark">
        <PreviewBanner />
        <ViewTransitions>
          <SessionProviders>
            <CommunityNavigation>
              <ProgressBarProvider>
                {/* Gives every .gator-overlay an exit animation without each modal
                  having to hoist its own conditional. */}
                <OverlayExit />
                {/* Undoes the browser scrolling an overflow-hidden dialog to
                   reveal a focused element, which would leave the panel
                   displaced with no scrollbar to fix it. */}
                <OverflowScrollGuard />
                {/* Does nothing unless `?perf=1` is in the address; see
                   perf-probe.tsx. */}
                <PerfProbe
                  build={
                    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
                    "local"
                  }
                />
                {children}
              </ProgressBarProvider>
            </CommunityNavigation>
          </SessionProviders>
        </ViewTransitions>
      </body>
    </html>
  );
}
