import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Relist — AI Resale Listing Agent",
  description: "Instant photo-in, listing-out appraisal & cross-platform copy generator for eBay, Poshmark, and Facebook Marketplace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-[#FAF9F6] text-[#18181B] antialiased selection:bg-[#FDF2EF] selection:text-[#E8623D]">
        {children}
      </body>
    </html>
  );
}
