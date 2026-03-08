"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Send,
  Sparkles,
  Bot,
  User,
  Map,
  BarChart3,
  Zap,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Package,
  Leaf,
  ExternalLink,
  CheckCircle2,
  Truck,
  MapPin,
  Box,
  Activity,
  ArrowRight,
  Navigation,
  Sun,
  Moon,
  Route,
} from "lucide-react";
import { suggestedPrompts } from "@/lib/mock-data";
import {
  getChatHistory,
  sendChatMessage,
  saveChatMessage,
  runConsolidation,
  getShipments,
  getRoutes,
} from "@/lib/api";

/* ── Dynamic map import (client-only) ── */
const LeafletMap = dynamic(() => import("@/components/ui/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 280,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(99,91,255,0.04)",
        borderRadius: 10,
      }}
    >
      <Loader2
        size={20}
        className="loading-spinner"
        style={{ color: "#635BFF" }}
      />
    </div>
  ),
});

/* ── Types ── */
interface PreviewData {
  type: "shipments" | "consolidation" | "route_map";
  data: any;
}

interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actions?: { label: string; type: string }[];
  preview?: PreviewData;
}

/* ── Helpers ── */
const nowTs = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

let _idSeq = 0;
const nextId = () => `msg-${Date.now()}-${_idSeq++}`;

function sanitizeAndFormat(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

/* ── Shared preview card styles ── */
const previewCard: React.CSSProperties = {
  marginTop: 12,
  borderRadius: 12,
  border: "1px solid rgba(99,91,255,0.15)",
  background: "var(--bg-primary)",
  overflow: "hidden",
  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
};
const previewHeader: React.CSSProperties = {
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "rgba(99,91,255,0.06)",
  borderBottom: "1px solid rgba(99,91,255,0.1)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-primary)",
};
const previewFooter: React.CSSProperties = {
  padding: "8px 14px",
  borderTop: "1px solid rgba(99,91,255,0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
};
const linkBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#635BFF",
  fontSize: 12,
  fontWeight: 600,
};

/* ── Action icon mapping ── */
function actionIcon(type: string) {
  switch (type) {
    case "view_shipments":
      return <Package size={12} />;
    case "run_consolidation":
    case "optimize":
      return <Zap size={12} />;
    case "view_routes":
    case "view_route_map":
    case "map":
      return <Map size={12} />;
    case "view_packing":
      return <Box size={12} />;
    case "view_carbon":
      return <Leaf size={12} />;
    case "view_dashboard":
      return <BarChart3 size={12} />;
    case "view_simulate":
      return <Activity size={12} />;
    case "end_session":
      return <CheckCircle2 size={12} />;
    default:
      return <ExternalLink size={12} />;
  }
}

/* ══════════════════════════════════════════════
   Inline Preview Components
   ══════════════════════════════════════════════ */

function ShipmentsPreview({
  shipments,
  onNavigate,
}: {
  shipments: any[];
  onNavigate: () => void;
}) {
  return (
    <div style={previewCard}>
      <div style={previewHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Package size={14} style={{ color: "#635BFF" }} />
          <span>Pending Shipments</span>
        </div>
        <span
          style={{
            background: "rgba(99,91,255,0.12)",
            color: "#635BFF",
            padding: "2px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {shipments.length}
        </span>
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        <table
          style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}
        >
          <thead>
            <tr style={{ background: "rgba(99,91,255,0.03)" }}>
              {["Origin", "Destination", "Weight", "Pickup"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 10px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shipments.slice(0, 6).map((s: any, i: number) => (
              <tr
                key={s.id || i}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td style={{ padding: "7px 10px" }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <MapPin size={10} style={{ color: "#f59e0b" }} />
                    {s.origin_city || s.origin}
                  </span>
                </td>
                <td style={{ padding: "7px 10px" }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <MapPin size={10} style={{ color: "#10b981" }} />
                    {s.dest_city || s.destination}
                  </span>
                </td>
                <td style={{ padding: "7px 10px", fontWeight: 600 }}>
                  {s.weight_kg || s.weight} kg
                </td>
                <td
                  style={{
                    padding: "7px 10px",
                    color: "var(--text-secondary)",
                  }}
                >
                  {s.pickup_date
                    ? new Date(s.pickup_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shipments.length > 6 && (
          <div
            style={{
              padding: "6px 10px",
              fontSize: 11,
              color: "var(--text-tertiary)",
              textAlign: "center",
            }}
          >
            +{shipments.length - 6} more shipments
          </div>
        )}
      </div>
      <div style={previewFooter}>
        <button onClick={onNavigate} style={linkBtn}>
          Go to Shipments Page <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

function ConsolidationPreview({
  data,
  onNavigate,
}: {
  data: any;
  onNavigate: () => void;
}) {
  const clusters: any[] = data.clusters || [];
  const costSaved = (data.cost_before || 0) - (data.cost_after || 0);

  const getUtilColor = (pct: number) => {
    if (pct >= 80) return "#0CAF60";
    if (pct >= 60) return "#E5850B";
    return "#DF1B41";
  };

  return (
    <div style={previewCard}>
      <div style={previewHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={14} style={{ color: "#635BFF" }} />
          <span>Consolidated Clusters</span>
        </div>
        <span
          style={{
            background: "rgba(16,185,129,0.12)",
            color: "#10b981",
            padding: "2px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Summary KPIs */}
      <div
        className="copilot-preview-kpi-grid"
        style={{
          padding: "10px 14px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 8,
          borderBottom: "1px solid rgba(99,91,255,0.08)",
        }}
      >
        {[
          {
            label: "Trips",
            before: data.trips_before || 0,
            after: data.trips_after || clusters.length,
          },
          {
            label: "Cost Saved",
            value: `₹${costSaved.toLocaleString("en-IN")}`,
          },
          { label: "CO₂ Reduced", value: `${data.co2_saved || 0} kg` },
          { label: "Avg Util", value: `${data.avg_utilization || 0}%` },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              textAlign: "center",
              padding: "8px 4px",
              borderRadius: 8,
              background: "var(--bg-secondary)",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {s.value || `${s.before} → ${s.after}`}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                marginTop: 2,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Cluster Cards */}
      <div style={{ maxHeight: 320, overflowY: "auto", padding: "8px 12px" }}>
        {clusters.map((c: any, i: number) => {
          const util = c.utilization_pct || 0;
          const utilColor = getUtilColor(util);
          return (
            <div
              key={c.id || i}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                marginBottom: 8,
                background: "var(--bg-primary)",
                borderTop: `3px solid ${utilColor}`,
              }}
            >
              {/* Cluster header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "var(--text-primary)",
                    }}
                  >
                    Cluster {(c.id || "").slice(0, 4)}
                  </span>
                  <span
                    style={{
                      marginLeft: 10,
                      fontSize: 11,
                      color: c.status === "accepted" ? "#0CAF60" : "#E5850B",
                      fontWeight: 600,
                    }}
                  >
                    {c.status || "pending"}
                  </span>
                </div>
              </div>

              {/* Vehicle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "#635BFF",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                <Truck size={12} />
                {c.vehicle_name || "Unknown"}
              </div>

              {/* Utilization bar */}
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    marginBottom: 3,
                  }}
                >
                  <span>Utilization</span>
                  <span style={{ color: utilColor, fontWeight: 700 }}>
                    {util}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: "rgba(0,0,0,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(util, 100)}%`,
                      borderRadius: 3,
                      background: utilColor,
                      transition: "width 0.6s ease",
                    }}
                  />
                </div>
              </div>

              {/* Stats grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "4px 16px",
                  fontSize: 12,
                }}
              >
                {[
                  { label: "Shipments", value: (c.shipment_ids || []).length },
                  {
                    label: "Weight",
                    value: `${(c.total_weight || 0).toLocaleString()} kg`,
                  },
                  {
                    label: "Distance",
                    value: `${(c.route_distance_km || 0).toFixed(1)} km`,
                  },
                  {
                    label: "Cost",
                    value: `₹${(c.estimated_cost || 0).toLocaleString("en-IN")}`,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "3px 0",
                    }}
                  >
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {s.label}
                    </span>
                    <span
                      style={{ fontWeight: 600, color: "var(--text-primary)" }}
                    >
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={previewFooter}>
        <button onClick={onNavigate} style={linkBtn}>
          Go to Consolidation Page <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

function RouteMapPreview({
  routes,
  onNavigate,
}: {
  routes: any[];
  onNavigate: () => void;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [selected, setSelected] = useState<any>(routes[0] || null);

  return (
    <div style={previewCard}>
      <div style={previewHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Navigation size={14} style={{ color: "#635BFF" }} />
          <span>Optimized Routes</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: "rgba(99,91,255,0.12)",
              color: "#635BFF",
              padding: "2px 10px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {routes.length} route{routes.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            title={theme === "light" ? "Dark map" : "Light map"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background:
                theme === "dark"
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.03)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            {theme === "light" ? <Moon size={11} /> : <Sun size={11} />}
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
      </div>

      {/* Route summary chips — clickable to select */}
      <div
        style={{
          padding: "8px 14px",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          borderBottom: "1px solid rgba(99,91,255,0.08)",
        }}
      >
        {routes.slice(0, 6).map((r: any, i: number) => {
          const isActive = selected?.id === r.id;
          return (
            <button
              key={r.id || i}
              onClick={() => setSelected(r)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 6,
                background: isActive
                  ? "rgba(99,91,255,0.12)"
                  : "var(--bg-secondary)",
                border: isActive
                  ? "1px solid rgba(99,91,255,0.4)"
                  : "1px solid var(--border)",
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: r.color || "#635BFF",
                }}
              />
              <span
                style={{
                  fontWeight: 600,
                  color: isActive ? "#635BFF" : "var(--text-primary)",
                }}
              >
                {r.vehicleName || "Route"}
              </span>
              <span style={{ color: "var(--text-tertiary)" }}>
                {(r.totalDistanceKm || 0).toFixed(0)} km
              </span>
            </button>
          );
        })}
        {routes.length > 6 && (
          <span
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              alignSelf: "center",
            }}
          >
            +{routes.length - 6} more
          </span>
        )}
      </div>

      <div className="copilot-map-preview" style={{ height: 300, position: "relative" }}>
        <LeafletMap
          routes={routes}
          selectedRoute={selected}
          onSelectRoute={(r) => setSelected(r)}
          viewMode="after"
          mapTheme={theme}
        />
      </div>
      <div style={previewFooter}>
        <button onClick={onNavigate} style={linkBtn}>
          Go to Routes Page <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main Copilot Page
   ══════════════════════════════════════════════ */

export default function CopilotPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "msg-init",
      role: "assistant",
      content:
        "👋 Hello! I'm Lorri, your AI logistics co-pilot. I can help you consolidate shipments, optimize routes, analyze carbon impact, and generate reports. What would you like to explore?",
      timestamp: "10:00 AM",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    getChatHistory("demo")
      .then((data) => {
        if (data?.length) {
          const mapped: AgentMessage[] = data.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            actions: m.actions,
          }));
          setMessages(mapped);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /* ── Bubble helpers (also persist to DB) ── */
  const addUserBubble = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: text, timestamp: nowTs() },
    ]);
    saveChatMessage("user", text, "demo").catch(() => {});
  };

  const addBotBubble = (
    text: string,
    actions?: { label: string; type: string }[],
    preview?: PreviewData,
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "assistant",
        content: text,
        timestamp: nowTs(),
        actions,
        preview,
      },
    ]);
    saveChatMessage("assistant", text, "demo", actions).catch(() => {});
  };

  /* ── Send a text query to the AI ── */
  const handleSend = (text?: string) => {
    const query = text || input;
    if (!query.trim()) return;

    addUserBubble(query);
    setInput("");
    setIsTyping(true);

    sendChatMessage(query, "demo")
      .then((data) => {
        const actions: { label: string; type: string }[] = [];
        if (data.actions && Array.isArray(data.actions)) {
          data.actions.forEach((a: any) => {
            actions.push({
              label: a.label || a,
              type: a.type || a.action || "optimize",
            });
          });
        }
        if (actions.length === 0) {
          actions.push(
            { label: "📊 View Shipments", type: "view_shipments" },
            { label: "⚡ Run Consolidation", type: "run_consolidation" },
          );
        }
        addBotBubble(
          data.content || data.response || "No response received.",
          actions,
        );
      })
      .catch(() => {
        addBotBubble(
          "Sorry, I couldn't reach the AI engine right now. Please check that the backend is running on port 5000 and try again.",
        );
      })
      .finally(() => setIsTyping(false));
  };

  /* ── Agent workflow — action button handler ── */
  const handleActionClick = async (action: { label: string; type: string }) => {
    const typ = action.type;

    /* ─── Navigation-only redirects ─── */
    const NAV_PAGES: Record<string, [string, string]> = {
      view_carbon: ["/carbon", "🌱 Opening Carbon Impact page..."],
      view_dashboard: ["/", "📊 Opening Dashboard..."],
      view_simulate: ["/simulate", "🧪 Opening Scenario Simulator..."],
      view_reports: ["/reports", "📋 Opening Reports..."],
      view_shipments_page: ["/shipments", "📦 Opening Shipments page..."],
    };

    if (NAV_PAGES[typ]) {
      const [path, label] = NAV_PAGES[typ];
      addUserBubble(label);
      setTimeout(() => router.push(path), 600);
      return;
    }

    /* ─── 3D Packing → redirect (too heavy for inline) ─── */
    if (typ === "view_packing") {
      addUserBubble("📦 Opening 3D Packing Visualizer...");
      addBotBubble(
        "Redirecting to the 3D Bin Packing page — the packing visualizer renders in full 3D for the best experience!",
        [
          { label: "🗺️ View Route Map", type: "view_route_map" },
          { label: "🌱 View Carbon Impact", type: "view_carbon" },
        ],
      );
      setTimeout(() => router.push("/packing"), 1200);
      return;
    }

    /* ─── View Shipments → fetch & inline preview ─── */
    if (typ === "view_shipments") {
      addUserBubble("📊 Show me the pending shipments");
      setIsTyping(true);
      try {
        const shipments = await getShipments({ status: "pending" });
        const pending = Array.isArray(shipments) ? shipments : [];
        const msg: AgentMessage = {
          id: nextId(),
          role: "assistant",
          content:
            pending.length > 0
              ? `Here are your **${pending.length}** pending shipment${pending.length > 1 ? "s" : ""}. Ready to run the consolidation engine to optimize them?`
              : "There are no pending shipments right now. Add some shipments first, then I can help you consolidate them!",
          timestamp: nowTs(),
          preview:
            pending.length > 0
              ? { type: "shipments", data: pending }
              : undefined,
          actions:
            pending.length > 0
              ? [
                  {
                    label: "⚡ Run Consolidation Engine",
                    type: "run_consolidation",
                  },
                ]
              : [
                  {
                    label: "📦 Go to Shipments",
                    type: "view_shipments_page",
                  },
                ],
        };
        setMessages((prev) => [...prev, msg]);
        saveChatMessage("assistant", msg.content, "demo", msg.actions).catch(
          () => {},
        );
      } catch {
        addBotBubble(
          "Failed to load shipments. Is the backend running on port 5000?",
        );
      } finally {
        setIsTyping(false);
      }
      return;
    }

    /* ─── Run Consolidation → engine + inline preview ─── */
    if (
      typ === "run_consolidation" ||
      typ === "optimize" ||
      action.label.toLowerCase().includes("run")
    ) {
      addUserBubble("⚡ Running the consolidation engine...");
      setIsTyping(true);
      try {
        const res = await runConsolidation();
        const msg: AgentMessage = {
          id: nextId(),
          role: "assistant",
          content:
            "✅ **Consolidation complete!** The engine has grouped your shipments into optimized clusters. Here's the summary:",
          timestamp: nowTs(),
          preview: { type: "consolidation", data: res },
          actions: [
            { label: "🗺️ View Route Map", type: "view_route_map" },
            { label: "📦 View 3D Packing", type: "view_packing" },
          ],
        };
        setMessages((prev) => [...prev, msg]);
        saveChatMessage("assistant", msg.content, "demo", msg.actions).catch(
          () => {},
        );
      } catch (err: any) {
        addBotBubble(
          `Failed to run consolidation: ${err?.message || "Unknown error"}`,
        );
      } finally {
        setIsTyping(false);
      }
      return;
    }

    /* ─── View Route Map → fetch routes & inline map ─── */
    if (typ === "view_routes" || typ === "view_route_map" || typ === "map") {
      addUserBubble("🗺️ Show me the route map");
      setIsTyping(true);
      try {
        const rawRoutes = await getRoutes();
        const rawArr = Array.isArray(rawRoutes) ? rawRoutes : [];
        // Map snake_case API fields → camelCase Route type (same as routes page)
        const mapped = rawArr.map((r: any) => ({
          id: r.id,
          clusterId: r.cluster_id,
          vehicleName: r.vehicle_name,
          points: r.points || [],
          totalDistanceKm: r.total_distance_km,
          estimatedTime: r.estimated_time,
          fuelCost: r.fuel_cost,
          color: r.color,
          planId: r.plan_id || "",
          planName: r.plan_name || "",
          planCreatedAt: r.plan_created_at || "",
          planStatus: r.plan_status || "",
          clusterStatus: r.cluster_status || "",
        }));
        // Filter to latest plan only (like routes page)
        const planMap: Record<
          string,
          { planCreatedAt: string; routes: typeof mapped }
        > = {};
        for (const r of mapped) {
          const pid = r.planId || "unknown";
          if (!planMap[pid])
            planMap[pid] = { planCreatedAt: r.planCreatedAt || "", routes: [] };
          planMap[pid].routes.push(r);
        }
        const sorted = Object.values(planMap).sort(
          (a, b) =>
            new Date(b.planCreatedAt).getTime() -
            new Date(a.planCreatedAt).getTime(),
        );
        const routeArr = sorted.length > 0 ? sorted[0].routes : [];
        const msg: AgentMessage = {
          id: nextId(),
          role: "assistant",
          content:
            routeArr.length > 0
              ? `Here's the optimized route map with **${routeArr.length}** route${routeArr.length > 1 ? "s" : ""}:`
              : "No routes available yet. Run the consolidation engine first to generate optimized routes.",
          timestamp: nowTs(),
          preview:
            routeArr.length > 0
              ? { type: "route_map", data: routeArr }
              : undefined,
          actions: [
            { label: "🌱 View Carbon Impact", type: "view_carbon" },
            { label: "📊 View Dashboard", type: "view_dashboard" },
            { label: "✅ End Session", type: "end_session" },
          ],
        };
        setMessages((prev) => [...prev, msg]);
        saveChatMessage("assistant", msg.content, "demo", msg.actions).catch(
          () => {},
        );
      } catch {
        addBotBubble("Failed to load routes. Is the backend running?");
      } finally {
        setIsTyping(false);
      }
      return;
    }

    /* ─── End Session → summary ─── */
    if (typ === "end_session") {
      addUserBubble("✅ That's all for now, thanks!");
      addBotBubble(
        "Great work! 🎉 Here's what we accomplished:\n\n• Reviewed pending shipments\n• Ran the consolidation engine\n• Viewed optimized routes\n\nFeel free to explore these pages for more details:",
        [
          { label: "📊 Dashboard", type: "view_dashboard" },
          { label: "🌱 Carbon Impact", type: "view_carbon" },
          { label: "📋 Reports", type: "view_reports" },
          { label: "🧪 Simulator", type: "view_simulate" },
        ],
      );
      return;
    }

    /* ─── Default — send as chat query ─── */
    handleSend(action.label);
  };

  /* ── Preview renderer ── */
  const renderPreview = (preview: PreviewData) => {
    switch (preview.type) {
      case "shipments":
        return (
          <ShipmentsPreview
            shipments={preview.data}
            onNavigate={() => router.push("/shipments")}
          />
        );
      case "consolidation":
        return (
          <ConsolidationPreview
            data={preview.data}
            onNavigate={() => router.push("/consolidate")}
          />
        );
      case "route_map":
        return (
          <RouteMapPreview
            routes={preview.data}
            onNavigate={() => router.push("/routes")}
          />
        );
      default:
        return null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ══════════════════════════════════════════════
     JSX
     ══════════════════════════════════════════════ */
  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              background: "linear-gradient(135deg, #635BFF, #8B5CF6)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(99,91,255,0.35)",
            }}
          >
            <Sparkles size={20} color="white" />
          </div>
          <div>
            <h1 className="page-title">AI Co-Pilot</h1>
            <p className="page-subtitle">
              Natural language interface to the optimization engine
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#34d399",
            }}
          />
          <span
            style={{
              fontSize: "12.5px",
              color: "var(--text-secondary)",
              fontWeight: 500,
            }}
          >
            Groq Mixtral-8x7B · Online
          </span>
        </div>
      </div>

      {/* ── Chat Container ── */}
      <div className="chat-container" style={{ margin: "24px 32px" }}>
        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="animate-slide-up"
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "9px",
                  background:
                    msg.role === "user"
                      ? "var(--bg-secondary)"
                      : "linear-gradient(135deg, #635BFF, #8B5CF6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border:
                    msg.role === "user"
                      ? "1px solid var(--border-primary)"
                      : "none",
                  boxShadow:
                    msg.role === "assistant"
                      ? "0 2px 8px rgba(99,91,255,0.30)"
                      : "none",
                }}
              >
                {msg.role === "user" ? (
                  <User size={15} color="var(--text-secondary)" />
                ) : (
                  <Bot size={15} color="white" />
                )}
              </div>

              <div
                className="copilot-bubble-content"
                style={{
                  maxWidth: msg.preview ? "85%" : "72%",
                  minWidth: msg.preview ? "420px" : undefined,
                }}
              >
                {/* Text bubble */}
                <div className={`chat-bubble ${msg.role}`}>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {msg.content.split("\n").map((line, i) => (
                      <p
                        key={i}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeAndFormat(line),
                        }}
                        style={{ margin: "2px 0" }}
                      />
                    ))}
                  </div>
                </div>

                {/* Inline Preview */}
                {msg.preview && renderPreview(msg.preview)}

                {/* Action Buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      marginTop: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    {msg.actions.map((action) => (
                      <button
                        key={action.label}
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleActionClick(action)}
                        style={{ gap: "5px" }}
                      >
                        {actionIcon(action.type)}
                        {action.label}
                      </button>
                    ))}
                    <button className="btn btn-sm btn-ghost">
                      <Copy size={12} />
                    </button>
                    <button className="btn btn-sm btn-ghost">
                      <ThumbsUp size={12} />
                    </button>
                    <button className="btn btn-sm btn-ghost">
                      <ThumbsDown size={12} />
                    </button>
                  </div>
                )}

                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--text-tertiary)",
                    marginTop: "5px",
                    textAlign: msg.role === "user" ? "right" : "left",
                  }}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "9px",
                  background: "linear-gradient(135deg, #635BFF, #8B5CF6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(99,91,255,0.30)",
                }}
              >
                <Bot size={15} color="white" />
              </div>
              <div
                className="chat-bubble assistant"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "var(--lorri-primary)",
                      animation: `pulse-dot 1.2s ease infinite ${i * 0.18}s`,
                      opacity: 0.7,
                    }}
                  />
                ))}
                <span
                  style={{ fontSize: "12px", color: "var(--text-tertiary)" }}
                >
                  Analyzing...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <input
              className="chat-input"
              placeholder="Ask Lorri anything about your logistics..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button
              className="chat-send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              style={{ opacity: input.trim() ? 1 : 0.45 }}
            >
              {isTyping ? (
                <Loader2 size={16} className="loading-spinner" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>

          {/* Suggested Prompts */}
          <div className="chat-chips">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                className="chat-chip"
                onClick={() => handleSend(prompt)}
                disabled={isTyping}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
