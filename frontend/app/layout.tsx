import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/ui/Sidebar";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

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
      <body className={`${inter.variable} antialiased`}>
        <div className="app-layout">
          <Sidebar />
          <div className="main-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
