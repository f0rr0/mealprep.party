import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";

import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Our Kitchen",
  },
  description: "Our shared meals, recipes and groceries, in one place.",
  manifest: "/manifest.webmanifest",
  robots: { follow: false, index: false },
  title: "Our Kitchen",
};
export const viewport: Viewport = {
  initialScale: 1,
  themeColor: "#f5f4ed",
  viewportFit: "cover",
  width: "device-width",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} bg-background text-foreground font-sans text-sm`}
      >
        {children}
      </body>
    </html>
  );
}
