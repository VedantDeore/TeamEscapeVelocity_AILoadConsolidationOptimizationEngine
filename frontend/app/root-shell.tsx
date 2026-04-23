"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/ui/Sidebar";

export function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDriverApp = pathname.startsWith("/driver");

  if (isDriverApp) {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  );
}
