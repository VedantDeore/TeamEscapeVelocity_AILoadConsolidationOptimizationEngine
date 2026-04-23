"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Truck, LogOut, UserCircle } from "lucide-react";
import Link from "next/link";

const ACCENT = "#0ea5e9";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [driverName, setDriverName] = useState("");
  const isAuthPage = pathname === "/driver/login" || pathname === "/driver/register";

  useEffect(() => {
    const name = localStorage.getItem("driver_name");
    if (name) setDriverName(name);
    if (!isAuthPage && !localStorage.getItem("driver_id")) {
      router.replace("/driver/login");
    }
  }, [pathname, isAuthPage, router]);

  const handleLogout = () => {
    localStorage.removeItem("driver_id");
    localStorage.removeItem("driver_name");
    localStorage.removeItem("driver_phone");
    localStorage.removeItem("driver_online");
    router.replace("/driver/login");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #021526 0%, #0a1628 50%, #071422 100%)",
      color: "#f1f5f9",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: "1px solid rgba(14,165,233,0.1)",
        background: "rgba(2, 21, 38, 0.85)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <Link href="/driver/dashboard" style={{
          display: "flex", alignItems: "center", gap: "10px",
          textDecoration: "none", color: "#f1f5f9",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${ACCENT}, #06b6d4)`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Truck size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.3px" }}>
              LORRI <span style={{ color: ACCENT }}>Driver</span>
            </div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.5px" }}>
              LOGISTICS PLATFORM
            </div>
          </div>
        </Link>

        {!isAuthPage && driverName && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/driver/profile" style={{
              display: "flex", alignItems: "center", gap: 6,
              color: "#94a3b8", textDecoration: "none",
              fontSize: 13, fontWeight: 500,
            }}>
              <UserCircle size={16} color={ACCENT} />
              {driverName}
            </Link>
            <button
              onClick={handleLogout}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 12px", borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.3)",
                background: "rgba(239,68,68,0.1)",
                color: "#f87171", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
              }}
            >
              <LogOut size={13} /> Logout
            </button>
          </div>
        )}
      </header>

      <main style={{ padding: "20px", maxWidth: 480, margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
