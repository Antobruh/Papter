import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Papter – Understand Research in Minutes",
  description:
    "Papter is an open-source AI platform that simplifies academic research papers with citation-backed explanations, AI chat, concept maps, and gap analysis — powered entirely by local LLMs.",
  keywords: ["research papers", "AI summarization", "academic", "open source", "RAG"],
  openGraph: {
    title: "Papter – Understand Research in Minutes",
    description: "Open-source AI research paper simplification platform",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
