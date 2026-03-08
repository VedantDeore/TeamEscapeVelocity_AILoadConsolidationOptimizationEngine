"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  Map,
  Box,
  FlaskConical,
  Leaf,
  MessageSquare,
  FileText,
  Settings,
  Truck,
  Menu,
  X,
} from "lucide-react";
import { getShipments } from "@/lib/api";

const navSections = [
  {
    label: "Overview",
    items: [
      {
        href: "/",
        icon: LayoutDashboard,
        label: "Dashboard",
        badge: null,
        badgeAi: false,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        href: "/shipments",
        icon: Package,
        label: "Shipments",
        badge: "150",
        badgeAi: false,
      },
      {
        href: "/consolidate",
        icon: Layers,
        label: "Consolidation",
        badge: "7",
        badgeAi: false,
      },
      {
        href: "/routes",
        icon: Map,
        label: "Route Map",
        badge: null,
        badgeAi: false,
      },
      {
        href: "/packing",
        icon: Box,
        label: "3D Packing",
        badge: null,
        badgeAi: false,
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        href: "/simulate",
        icon: FlaskConical,
        label: "Simulator",
        badge: null,
        badgeAi: false,
      },
      {
        href: "/carbon",
        icon: Leaf,
        label: "Carbon Impact",
        badge: null,
        badgeAi: false,
      },
      {
        href: "/copilot",
        icon: MessageSquare,
        label: "AI Co-Pilot",
        badge: "AI",
        badgeAi: true,
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        href: "/reports",
        icon: FileText,
        label: "Reports",
        badge: null,
        badgeAi: false,
      },
      {
        href: "/settings",
        icon: Settings,
        label: "Settings",
        badge: null,
        badgeAi: false,
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [shipmentCount, setShipmentCount] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    getShipments()
      .then((data) => setShipmentCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Close mobile menu when route changes
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    // Prevent body scroll when mobile menu is open
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <button
        className="mobile-menu-toggle"
        onClick={toggleMobileMenu}
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="mobile-overlay active"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-inner">
          <div className="sidebar-logo-icon">
            <Truck size={18} color="white" />
          </div>
          <div>
            <div className="sidebar-logo-text">Logistics AI</div>
            <div className="sidebar-logo-sub">Load Optimization</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const badge =
                item.href === "/shipments" && shipmentCount !== null
                  ? String(shipmentCount)
                  : item.badge;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${isActive ? "active" : ""}`}
                  onClick={closeMobileMenu}
                >
                  <Icon className="icon" size={16} />
                  <span>{item.label}</span>
                  {badge && (
                    <span
                      className={`sidebar-badge ${item.badgeAi ? "ai-badge" : ""}`}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-status-dot" />
        <div className="sidebar-footer-text">
          <div style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
            Engine Online
          </div>
          <div>v1.0.0 · Team Escape Velocity</div>
        </div>
      </div>
    </aside>
    </>
  );
}
