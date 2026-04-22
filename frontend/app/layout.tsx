import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RootShell } from "./root-shell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "LORRI — AI Load Consolidation Optimization Engine",
  description:
    "Intelligently cluster shipments, optimize vehicle capacity with 3D bin-packing, and get AI-powered recommendations for smarter logistics.",
  keywords: [
    "load consolidation",
    "logistics optimization",
    "AI co-pilot",
    "3D bin packing",
    "route optimization",
    "carbon reduction",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}
