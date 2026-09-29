import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "mealprep.party",
  },
  description: "Meals, sorted.",
  metadataBase: new URL("https://mealprep.party"),
  openGraph: {
    title: "mealprep.party",
    description: "Meals, sorted.",
    type: "website",
    url: "https://mealprep.party",
  },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
  robots: { follow: false, index: false },
  title: "mealprep.party",
};
export const viewport: Viewport = {
  colorScheme: "light dark",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  viewportFit: "cover",
  width: "device-width",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} bg-background text-foreground font-sans text-sm text-balance [&_:is(h1,h2,h3,h4,h5,h6)]:text-pretty`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
