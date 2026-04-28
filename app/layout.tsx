import "./globals.css";
import type { Metadata } from "next";
import { JetBrains_Mono, Saira } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { unit } from "@/config/unit";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const saira = Saira({
  subsets: ["latin"],
  variable: "--font-saira",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: `${unit.shortCode}/HUB`,
  description: `${unit.parentAgency} — ${unit.name}`,
  icons: {
    icon: "/brand/seal.png",
    shortcut: "/brand/seal.png",
    apple: "/brand/seal.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${jetbrains.variable} ${saira.variable}`}>
      <body className="crt">{children}</body>
    </html>
  );
}
