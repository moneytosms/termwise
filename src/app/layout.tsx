import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { SETTINGS_BOOT } from "@/lib/settings";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const metadata: Metadata = { title: "Termwise", description: "One college record, from admission to graduation." };
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f2f4f7" }, { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${figtree.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: SETTINGS_BOOT }} /></head>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
