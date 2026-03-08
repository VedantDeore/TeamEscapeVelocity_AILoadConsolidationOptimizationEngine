"use client";

import Link from "next/link";
import {
  ArrowRight,
  Upload,
  Brain,
  Box,
  Route,
  Eye,
  MessageSquare,
  Layers,
  Map,
  Leaf,
  BarChart3,
  Truck,
  Zap,
  Database,
  Server,
  Monitor,
  Github,
  BookOpen,
} from "lucide-react";

/* ────────────────────────────────── data ─── */

const impactStats = [
  { value: "+30–40%", label: "Vehicle\nUtilization", cls: "" },
  { value: "−20–30%", label: "Logistics\nCost", cls: "purple" },
  { value: "−35%", label: "Empty\nMiles", cls: "green" },
  { value: "−25%", label: "Carbon\nEmissions", cls: "amber" },
];

const howItWorks = [
  {
    step: 1,
    title: "Shipment Data Ingestion",
    desc: "Upload shipment data via CSV or manual entry — pickup/delivery locations, weight, dimensions, delivery deadlines, and cargo type.",
    icon: Upload,
    color: "#635BFF",
  },
  {
    step: 2,
    title: "DBSCAN Clustering",
    desc: "Machine learning groups nearby shipments using density-based clustering with a custom distance metric combining geography, time overlap, and route similarity.",
    icon: Brain,
    color: "#8B5CF6",
  },
  {
    step: 3,
    title: "3D Bin Packing",
    desc: "A First Fit Decreasing algorithm determines how shipments physically fit inside vehicles, maximizing utilization and minimizing wasted space.",
    icon: Box,
    color: "#EC4899",
  },
  {
    step: 4,
    title: "Route Optimization (VRP)",
    desc: "Google OR-Tools solves the Capacitated Vehicle Routing Problem with Time Windows, generating the most efficient delivery routes.",
    icon: Route,
    color: "#F59E0B",
  },
  {
    step: 5,
    title: "3D Load Visualization",
    desc: "Shipments are rendered inside trucks using Three.js — rotate, zoom, and inspect exactly how cargo fits in the vehicle.",
    icon: Eye,
    color: "#0CAF60",
  },
  {
    step: 6,
    title: "AI Logistics Co-Pilot",
    desc: "Ask questions in natural language — the AI agent classifies intent, calls backend tools, and returns data-driven insights with actionable recommendations.",
    icon: MessageSquare,
    color: "#0EA5E9",
  },
];

const techStack = {
  frontend: [
    { name: "Next.js 14", purpose: "App framework" },
    { name: "Tailwind CSS", purpose: "Utility styles" },
    { name: "shadcn/ui", purpose: "UI components" },
    { name: "Recharts", purpose: "Analytics charts" },
    { name: "Leaflet", purpose: "Interactive maps" },
    { name: "Three.js", purpose: "3D visualization" },
    { name: "Framer Motion", purpose: "Animations" },
    { name: "Supabase JS", purpose: "Auth & realtime" },
  ],
  backend: [
    { name: "Flask", purpose: "REST API server" },
    { name: "Google OR-Tools", purpose: "VRP + bin packing" },
    { name: "scikit-learn", purpose: "DBSCAN clustering" },
    { name: "pandas & numpy", purpose: "Data processing" },
    { name: "py3dbp", purpose: "3D bin packing" },
    { name: "geopy", purpose: "Distance calculation" },
    { name: "OpenRouteService", purpose: "Route API" },
  ],
  ai: [
    { name: "DBSCAN", purpose: "Shipment clustering" },
    { name: "OR-Tools VRP", purpose: "Route optimization" },
    { name: "OR-Tools Bin Pack", purpose: "Capacity optimization" },
    { name: "Groq / Mixtral", purpose: "NL agent" },
    { name: "Custom Formula", purpose: "Carbon estimation" },
    { name: "Feedback Loop", purpose: "Pattern learning" },
  ],
};

const features = [
  {
    title: "Consolidation Engine",
    desc: "AI-powered DBSCAN clustering + 3D bin-packing to group shipments and maximize vehicle utilization.",
    href: "/consolidate",
    icon: Layers,
    cardClass: "feature-card-purple",
  },
  {
    title: "Route Optimizer",
    desc: "Solve the Vehicle Routing Problem to generate the most efficient delivery routes with minimal distance and fuel cost.",
    href: "/routes",
    icon: Map,
    cardClass: "feature-card-purple",
    style: { background: "linear-gradient(135deg, #0A2540 0%, #1E1B4B 100%)" },
  },
  {
    title: "3D Load Visualizer",
    desc: "See exactly how cargo fits inside trucks with an interactive 3D simulation — rotate, zoom, and inspect loading plans.",
    href: "/packing",
    icon: Box,
    cardClass: "feature-card-amber",
  },
  {
    title: "Carbon Impact Dashboard",
    desc: "ESG-aligned sustainability metrics — CO₂ savings, equivalents (trees planted), emission breakdowns, and a Green Score.",
    href: "/carbon",
    icon: Leaf,
    cardClass: "feature-card-green",
  },
  {
    title: "Scenario Simulator",
    desc: "Compare consolidation strategies side by side — no consolidation vs AI-optimized vs custom constraints.",
    href: "/simulate",
    icon: BarChart3,
    cardClass: "feature-card-amber",
    style: { background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)" },
  },
  {
    title: "AI Co-Pilot",
    desc: "Natural language interface to the entire engine — ask questions, get insights, and trigger optimizations with a chat.",
    href: "/copilot",
    icon: MessageSquare,
    cardClass: "feature-card-green",
    style: { background: "linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)" },
  },
];

const team = [
  {
    name: "Vedant Deore",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/vedantdeore/",
    github: "https://github.com/vedantdeore",
    image: "https://github.com/vedantdeore.png",
    gradient: "team-gradient-cyan",
  },
  {
    name: "Ritesh Sakhare",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/ritesh-sakhare-559342258/",
    github: "https://github.com/sakhareritesh",
    image: "https://github.com/sakhareritesh.png",
    gradient: "team-gradient-orange",
  },
  {
    name: "Samyak Raka",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/samyakraka/",
    github: "https://github.com/samyakraka",
    image: "https://github.com/samyakraka.png",
    gradient: "team-gradient-purple",
  },
  {
    name: "Satyajit Shinde",
    role: "Developer",
    linkedin: "https://www.linkedin.com/in/satyajitshinde/",
    github: "https://github.com/Satyajit112",
    image: "https://github.com/Satyajit112.png",
    gradient: "team-gradient-green",
  },
];

/* ────────────────────────────────── component ─── */

export default function AboutPage() {
  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "linear-gradient(135deg, #635BFF, #8B5CF6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <BookOpen size={20} color="white" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="page-title">How Our Project Works</h1>
            <p className="page-subtitle">
              An in-depth guide to Logistics AI — the engine behind smarter loads, fewer trips, and greener logistics.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/">
            <button className="btn btn-secondary">
              ← Back to Dashboard
            </button>
          </Link>
          <Link href="/copilot">
            <button className="btn btn-primary">
              <MessageSquare size={15} /> Ask AI Co-Pilot
            </button>
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* ── HERO: Dark Section ── */}
        <div className="hero-dark-section animate-slide-up" style={{ marginBottom: 32 }}>
          <div style={{ maxWidth: 700 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(99,91,255,0.20)",
                color: "#a5b4fc",
                padding: "4px 14px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: "20px",
              }}
            >
              <Zap size={11} /> AI-Powered Optimization Engine
            </div>
            <h2 className="hero-dark-title" style={{ fontSize: 40, lineHeight: 1.15 }}>
              Intelligent logistics optimization
              <br />
              <span className="text-gradient-hero">from first shipment to millionth.</span>
            </h2>
            <p
              className="hero-dark-subtitle"
              style={{ marginTop: 18, maxWidth: 560, fontSize: 16, lineHeight: 1.7 }}
            >
              Logistics AI combines <strong style={{ color: "rgba(255,255,255,0.9)" }}>machine learning clustering</strong>,{" "}
              <strong style={{ color: "rgba(255,255,255,0.9)" }}>vehicle routing optimization</strong>, and{" "}
              <strong style={{ color: "rgba(255,255,255,0.9)" }}>3D bin packing visualization</strong> with an{" "}
              <strong style={{ color: "rgba(255,255,255,0.9)" }}>AI logistics co-pilot</strong> that managers can
              interact with using natural language.
            </p>
            <div style={{ display: "flex", gap: "12px", marginTop: 28, flexWrap: "wrap" }}>
              <Link href="/consolidate">
                <button className="btn btn-primary">
                  <Zap size={14} /> Try the Engine <ArrowRight size={14} />
                </button>
              </Link>
              <Link href="/shipments">
                <button
                  className="btn btn-secondary"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    color: "#ffffff",
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                >
                  <Upload size={14} /> Upload Shipments
                </button>
              </Link>
            </div>
          </div>

          {/* Impact stats row */}
          <div className="hero-stats-row" style={{ marginTop: 48 }}>
            {impactStats.map((s) => (
              <div key={s.label} className="hero-stat">
                <div className={`hero-stat-value ${s.cls}`}>{s.value}</div>
                <div className="hero-stat-label" style={{ whiteSpace: "pre-line" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS ── */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "#635BFF",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              <Zap size={13} /> The Pipeline
            </div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "var(--text-primary)",
                letterSpacing: "-0.025em",
                lineHeight: 1.2,
              }}
            >
              How It Works
            </h2>
            <p style={{ color: "var(--text-tertiary)", fontSize: 15, marginTop: 6, maxWidth: 560 }}>
              Six stages transform raw shipment data into optimized, cost-saving delivery plans.
            </p>
          </div>

          <div className="about-how-grid">
            {howItWorks.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="about-step-card">
                  <div className="about-step-number" style={{ background: `${step.color}18`, color: step.color }}>
                    {step.step}
                  </div>
                  <div
                    className="about-step-icon"
                    style={{ background: `${step.color}12` }}
                  >
                    <Icon size={22} style={{ color: step.color }} />
                  </div>
                  <div className="about-step-title">{step.title}</div>
                  <div className="about-step-desc">{step.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── ALGORITHMS DEEP-DIVE (dark section) ── */}
        <div className="hero-dark-section animate-slide-up" style={{ marginBottom: 40, padding: "40px 44px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#a5b4fc",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            <Brain size={13} /> Under the Hood
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.025em", marginBottom: 28 }}>
            Core Algorithms
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {[
              {
                title: "DBSCAN Clustering",
                content:
                  "Density-Based Spatial Clustering finds natural shipment groups without pre-specifying K. Uses a custom distance metric: α·geo_distance + β·time_overlap + γ·route_similarity. Handles noise points (isolated shipments) gracefully.",
                accent: "#635BFF",
              },
              {
                title: "3D Bin Packing (FFD)",
                content:
                  "Layer-based First Fit Decreasing algorithm. Sorts items by volume (largest first), tries all 6 orientations, respects cargo-type stacking rules (fragile on top), and outputs exact (x, y, z) positions for 3D rendering.",
                accent: "#EC4899",
              },
              {
                title: "Vehicle Routing (CVRPTW)",
                content:
                  "Google OR-Tools solves the Capacitated Vehicle Routing Problem with Time Windows using guided local search metaheuristics. Minimizes total distance, time, and fuel cost across all vehicles.",
                accent: "#F59E0B",
              },
              {
                title: "Carbon Estimation",
                content:
                  "CO₂ (kg) = Distance (km) × Load Factor × Emission Factor. Different factors for heavy trucks (0.062 kg CO₂/ton-km), light trucks (0.09), and empty runs (0.031). Savings = before − after consolidation.",
                accent: "#0CAF60",
              },
              {
                title: "Agentic AI Pipeline",
                content:
                  "User query → LLM intent classification → tool routing (consolidation, routing, analytics, what-if, general) → structured response with data, actions, and proactive tips. Uses Groq with regex fallback.",
                accent: "#0EA5E9",
              },
              {
                title: "Feedback Learning",
                content:
                  "Managers accept, reject, or modify consolidation recommendations. Feedback re-weights clustering parameters over time, enabling continuous optimization aligned with real-world preferences.",
                accent: "#8B5CF6",
              },
            ].map((algo) => (
              <div
                key={algo.title}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  padding: "24px",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 20,
                    borderRadius: 2,
                    background: algo.accent,
                    marginBottom: 14,
                  }}
                />
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 650,
                    color: "#fff",
                    marginBottom: 8,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {algo.title}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
                  {algo.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SYSTEM ARCHITECTURE ── */}
        <div className="about-arch-section" style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#635BFF",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            <Server size={13} /> Architecture
          </div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              marginBottom: 24,
            }}
          >
            System Architecture
          </h2>

          <div className="about-arch-diagram">
            {/* Frontend layer */}
            <div className="about-arch-layer about-arch-frontend">
              <div className="about-arch-layer-label">
                <Monitor size={16} /> Frontend (Next.js)
              </div>
              <div className="about-arch-nodes">
                {["Dashboard", "Shipment Manager", "Route Map", "3D Packing", "AI Chat", "Carbon Dashboard", "Simulator", "Reports"].map(
                  (n) => (
                    <div key={n} className="about-arch-node">
                      {n}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="about-arch-connector">
              <div className="about-arch-connector-line" />
              <div className="about-arch-connector-label">REST API</div>
              <div className="about-arch-connector-line" />
            </div>

            {/* Backend layer */}
            <div className="about-arch-layer about-arch-backend">
              <div className="about-arch-layer-label">
                <Server size={16} /> Backend (Flask)
              </div>
              <div className="about-arch-nodes">
                {[
                  "Consolidation Engine\n(DBSCAN + Bin Packing)",
                  "Route Optimizer\n(OR-Tools VRP)",
                  "AI Agent\n(Groq / LLM)",
                  "Analytics & Reports",
                ].map((n) => (
                  <div key={n} className="about-arch-node" style={{ whiteSpace: "pre-line" }}>
                    {n}
                  </div>
                ))}
              </div>
            </div>

            <div className="about-arch-connector">
              <div className="about-arch-connector-line" />
              <div className="about-arch-connector-label">SQL + Realtime</div>
              <div className="about-arch-connector-line" />
            </div>

            {/* Database layer */}
            <div className="about-arch-layer about-arch-database">
              <div className="about-arch-layer-label">
                <Database size={16} /> Database (Supabase / PostgreSQL)
              </div>
              <div className="about-arch-nodes">
                {["Shipments", "Vehicles", "Consolidation Plans", "Clusters", "Feedback"].map((n) => (
                  <div key={n} className="about-arch-node">
                    {n}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── TECH STACK ── */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#635BFF",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            <Zap size={13} /> Built With
          </div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              marginBottom: 24,
            }}
          >
            Tech Stack
          </h2>

          <div className="about-tech-grid">
            {/* Frontend column */}
            <div className="about-tech-column">
              <div className="about-tech-column-header" style={{ borderColor: "#635BFF" }}>
                <Monitor size={16} style={{ color: "#635BFF" }} />
                <span>Frontend</span>
              </div>
              <div className="about-tech-pills">
                {techStack.frontend.map((t) => (
                  <div key={t.name} className="about-tech-pill">
                    <span className="about-tech-pill-name">{t.name}</span>
                    <span className="about-tech-pill-purpose">{t.purpose}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Backend column */}
            <div className="about-tech-column">
              <div className="about-tech-column-header" style={{ borderColor: "#0CAF60" }}>
                <Server size={16} style={{ color: "#0CAF60" }} />
                <span>Backend</span>
              </div>
              <div className="about-tech-pills">
                {techStack.backend.map((t) => (
                  <div key={t.name} className="about-tech-pill">
                    <span className="about-tech-pill-name">{t.name}</span>
                    <span className="about-tech-pill-purpose">{t.purpose}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI/ML column */}
            <div className="about-tech-column">
              <div className="about-tech-column-header" style={{ borderColor: "#8B5CF6" }}>
                <Brain size={16} style={{ color: "#8B5CF6" }} />
                <span>AI / ML</span>
              </div>
              <div className="about-tech-pills">
                {techStack.ai.map((t) => (
                  <div key={t.name} className="about-tech-pill">
                    <span className="about-tech-pill-name">{t.name}</span>
                    <span className="about-tech-pill-purpose">{t.purpose}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── FEATURE CARDS ── */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#635BFF",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            <Layers size={13} /> Explore Features
          </div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              marginBottom: 24,
            }}
          >
            Flexible Solutions for Every Logistics Need
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Link key={f.title} href={f.href} style={{ textDecoration: "none" }}>
                  <div className={f.cardClass} style={{ height: "100%", ...(f.style || {}) }}>
                    <Icon size={24} style={{ marginBottom: 12, opacity: 0.9 }} />
                    <div className="feature-card-title">{f.title}</div>
                    <div className="feature-card-body">{f.desc}</div>
                    <div className="feature-card-link">
                      Explore <ArrowRight size={13} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── API ENDPOINTS ── */}
        <div className="card" style={{ marginBottom: 40, overflow: "hidden" }}>
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <div>
              <div className="card-title" style={{ fontSize: 18 }}>
                API Endpoints
              </div>
              <div className="card-description">
                Flask REST API powering all operations
              </div>
            </div>
            <span className="badge badge-primary">Flask</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="about-api-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["POST", "/api/shipments/upload", "Upload CSV shipments"],
                  ["GET", "/api/shipments", "List all shipments"],
                  ["POST", "/api/consolidate", "Run consolidation engine"],
                  ["POST", "/api/route/optimize", "Run VRP route optimization"],
                  ["POST", "/api/packing/:cluster_id", "Run 3D bin packing"],
                  ["POST", "/api/simulate", "Run scenario simulation"],
                  ["POST", "/api/copilot/chat", "AI agent chat"],
                  ["GET", "/api/analytics/dashboard", "Dashboard KPIs"],
                  ["GET", "/api/analytics/carbon", "Carbon metrics"],
                  ["POST", "/api/feedback", "Submit cluster feedback"],
                  ["GET", "/api/reports/:type", "Generate report"],
                ].map(([method, endpoint, desc]) => (
                  <tr key={endpoint}>
                    <td>
                      <span
                        className={`about-api-method ${method === "POST" ? "post" : "get"}`}
                      >
                        {method}
                      </span>
                    </td>
                    <td>
                      <code style={{ fontSize: 12, color: "var(--text-primary)" }}>{endpoint}</code>
                    </td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 13 }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── TEAM ── */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "#635BFF",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            <Truck size={13} /> Team Escape Velocity
          </div>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
              marginBottom: 24,
            }}
          >
            Meet the Team
          </h2>
          <div className="team-grid">
            {team.map((member) => (
              <div key={member.name} className="team-card">
                <div className="team-card-text">
                  <img src={member.image} alt={member.name} className="team-card-avatar" />
                  <div className="team-card-name">{member.name}</div>
                  <div className="team-card-role">{member.role}</div>
                  <div className="team-card-links">
                    <a
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="team-card-link"
                    >
                      LinkedIn <ArrowRight size={13} />
                    </a>
                    <a
                      href={member.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="team-card-link team-card-link-github"
                    >
                      <Github size={14} /> GitHub
                    </a>
                  </div>
                </div>
                <div className={`team-card-art ${member.gradient}`} />
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER CTA ── */}
        <div
          className="hero-dark-section"
          style={{
            textAlign: "center",
            padding: "48px 32px",
            marginBottom: 0,
          }}
        >
          <h2
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.02em",
              marginBottom: 12,
            }}
          >
            Ready to optimize your logistics?
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 15,
              maxWidth: 480,
              margin: "0 auto 28px",
            }}
          >
            Upload your shipments, run the AI engine, and watch costs drop and utilization soar.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link href="/">
              <button className="btn btn-primary btn-lg">
                Go to Dashboard <ArrowRight size={15} />
              </button>
            </Link>
            <Link href="/copilot">
              <button
                className="btn btn-secondary"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  borderColor: "rgba(255,255,255,0.15)",
                }}
              >
                <MessageSquare size={14} /> Talk to AI Co-Pilot
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
