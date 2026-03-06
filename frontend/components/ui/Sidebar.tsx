'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, Layers, Map, Box, FlaskConical,
  Leaf, MessageSquare, FileText, Settings, Truck, ChevronRight
} from 'lucide-react';

const navSections = [
  {
    label: 'Overview',
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard', badge: null },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/shipments', icon: Package, label: 'Shipments', badge: '150' },
      { href: '/consolidate', icon: Layers, label: 'Consolidation', badge: '7' },
      { href: '/routes', icon: Map, label: 'Route Map', badge: null },
      { href: '/packing', icon: Box, label: '3D Packing', badge: null },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/simulate', icon: FlaskConical, label: 'Simulator', badge: null },
      { href: '/carbon', icon: Leaf, label: 'Carbon Impact', badge: null },
      { href: '/copilot', icon: MessageSquare, label: 'AI Co-Pilot', badge: 'AI' },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/reports', icon: FileText, label: 'Reports', badge: null },
      { href: '/settings', icon: Settings, label: 'Settings', badge: null },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Truck size={22} color="white" />
        </div>
        <div>
          <div className="sidebar-logo-text">LORRI</div>
          <div className="sidebar-logo-sub">Load Optimization Engine</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon className="sidebar-link-icon" size={18} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="sidebar-link-badge">{item.badge}</span>
                  )}
                  {isActive && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-secondary)',
        fontSize: '11px',
        color: 'var(--text-tertiary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#34d399',
            boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)',
          }} />
          <span>Engine Online</span>
        </div>
        <div>v1.0.0 — Team Escape Velocity</div>
      </div>
    </aside>
  );
}
