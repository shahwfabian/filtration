import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./v2.css";

export const metadata: Metadata = {
  title: { default: "Filtration | Options Market-Making Research", template: "%s | Filtration" },
  description: "A reproducible synthetic research environment for option quotation, inventory risk, adverse selection, and frictional delta hedging.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0e12" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
