import type { Metadata } from "next";
import { IBM_Plex_Mono, Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
  style: ["normal", "italic"],
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Lumen — Same answer. Fewer tokens.",
  description:
    "Paste your prompt. Lumen tells you what it costs, what it's wasting, and how to cut the bill — without changing the answer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
