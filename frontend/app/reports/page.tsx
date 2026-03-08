"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Download,
  Layers,
  Gauge,
  IndianRupee,
  Leaf,
  Map,
  FileSpreadsheet,
  File,
  Clock,
  RefreshCw,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const REPORT_DEFS = [
  {
    id: "rpt-1",
    type: "consolidation",
    name: "Daily Consolidation Summary",
    description:
      "Overview of all consolidation activities, cluster assignments, and savings achieved today.",
    icon: "layers",
  },
  {
    id: "rpt-2",
    type: "utilization",
    name: "Vehicle Utilization Report",
    description:
      "Detailed breakdown of vehicle utilization rates, load factors, and capacity analysis.",
    icon: "gauge",
  },
  {
    id: "rpt-3",
    type: "cost",
    name: "Cost Savings Analysis",
    description:
      "Comprehensive cost comparison before and after consolidation with ROI metrics.",
    icon: "indian-rupee",
  },
  {
    id: "rpt-4",
    type: "carbon",
    name: "Carbon Impact Report",
    description:
      "ESG-aligned sustainability report showing CO\u2082 reduction and environmental impact.",
    icon: "leaf",
  },
  {
    id: "rpt-5",
    type: "route",
    name: "Route Efficiency Report",
    description:
      "Analysis of route optimization results, distance savings, and time improvements.",
    icon: "map",
  },
];

const iconMap: Record<string, React.ElementType> = {
  layers: Layers,
  gauge: Gauge,
  "indian-rupee": IndianRupee,
  leaf: Leaf,
  map: Map,
};

const iconColors: Record<string, string> = {
  layers: "#0ea5e9",
  gauge: "#8b5cf6",
  "indian-rupee": "#10b981",
  leaf: "#06b6d4",
  map: "#f59e0b",
};

const iconBgs: Record<string, string> = {
  layers: "rgba(14, 165, 233, 0.12)",
  gauge: "rgba(139, 92, 246, 0.12)",
  "indian-rupee": "rgba(16, 185, 129, 0.12)",
  leaf: "rgba(6, 182, 212, 0.12)",
  map: "rgba(245, 158, 11, 0.12)",
};

const formatLabels: Record<string, string> = { pdf: "PDF", csv: "CSV", excel: "Excel" };

interface HistoryEntry {
  id: string;
  name: string;
  type: string;
  format: string;
  date: Date;
  size: string;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d: Date) {
  return (
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
}

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function estimateSize(fmt: string) {
  const sizes: Record<string, string[]> = {
    pdf: ["1.8 MB", "2.1 MB", "2.4 MB", "2.7 MB", "3.1 MB"],
    csv: ["0.4 MB", "0.6 MB", "0.9 MB", "1.1 MB"],
    excel: ["1.2 MB", "1.5 MB", "1.8 MB", "2.0 MB"],
  };
  const arr = sizes[fmt] || sizes.csv;
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function ReportsPage() {
  const [selectedFormat, setSelectedFormat] = useState<string>("pdf");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<Record<string, Date>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const handleGenerate = useCallback(
    (reportType: string, reportName: string) => {
      setGeneratingId(reportType);
      const fmt = selectedFormat;
      const apiFmt = fmt;
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      window.open(
        `${apiBase}/api/reports/${reportType}/download?format=${apiFmt}`,
        "_blank",
      );

      const genDate = new Date();
      const size = estimateSize(fmt);

      setTimeout(() => {
        setGeneratingId(null);
        setLastGenerated((prev) => ({ ...prev, [reportType]: genDate }));
        setHistory((prev) => [
          {
            id: `h-${Date.now()}`,
            name: `${reportName} — ${fmtDate(genDate)}`,
            type: reportType.charAt(0).toUpperCase() + reportType.slice(1),
            format: formatLabels[fmt] || fmt.toUpperCase(),
            date: genDate,
            size,
          },
          ...prev,
        ]);
      }, 1500);
    },
    [selectedFormat],
  );

  const handleRedownload = useCallback((entry: HistoryEntry) => {
    const fmtKey =
      entry.format === "PDF"
        ? "pdf"
        : entry.format === "Excel"
          ? "excel"
          : "csv";
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    window.open(
      `${apiBase}/api/reports/${entry.type.toLowerCase()}/download?format=${fmtKey}`,
      "_blank",
    );
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Export</h1>
          <p className="page-subtitle">
            Generate and download professional logistics reports
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginRight: 4,
            }}
          >
            Format:
          </span>
          {(
            [
              { key: "pdf", label: "PDF", icon: File, color: "#DF1B41" },
              {
                key: "csv",
                label: "CSV",
                icon: FileSpreadsheet,
                color: "#10b981",
              },
              {
                key: "excel",
                label: "EXCEL",
                icon: FileSpreadsheet,
                color: "#635BFF",
              },
            ] as const
          ).map(({ key, label, icon: Ico, color }) => {
            const active = selectedFormat === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedFormat(key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: active
                    ? `1.5px solid ${color}`
                    : "1.5px solid var(--border-primary)",
                  background: active ? `${color}0F` : "var(--bg-card)",
                  color: active ? color : "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: active ? 650 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: active ? `0 2px 8px ${color}20` : "none",
                }}
              >
                <Ico size={13} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="page-body">
        {/* ── Current Time ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            fontSize: 12,
            color: "var(--text-tertiary)",
          }}
        >
          <Clock size={13} />
          <span>
            Current:{" "}
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {now.toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            {" · "}
            {now.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true,
            })}
          </span>
          {history.length > 0 && (
            <span className="badge badge-primary" style={{ fontSize: 10, marginLeft: "auto" }}>
              {history.length} report{history.length !== 1 ? "s" : ""} generated this session
            </span>
          )}
        </div>

        {/* ── Report Cards ── */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {REPORT_DEFS.map((report) => {
            const Icon = iconMap[report.icon] || FileText;
            const color = iconColors[report.icon] || "#0ea5e9";
            const bg = iconBgs[report.icon] || "rgba(14, 165, 233, 0.12)";
            const isGenerating = generatingId === report.type;
            const lastGen = lastGenerated[report.type];

            return (
              <div key={report.id} className="report-card">
                <div className="report-icon" style={{ background: bg }}>
                  <Icon size={22} style={{ color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: "4px",
                    }}
                  >
                    {report.name}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      marginBottom: "8px",
                      lineHeight: 1.5,
                    }}
                  >
                    {report.description}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      fontSize: "11px",
                      color: "var(--text-tertiary)",
                      flexWrap: "wrap",
                    }}
                  >
                    {lastGen ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "#10b981",
                          fontWeight: 500,
                        }}
                      >
                        <CheckCircle2 size={12} />
                        Generated {timeAgo(lastGen)} · {fmtDateTime(lastGen)}
                      </span>
                    ) : (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Clock size={12} /> Not generated yet
                      </span>
                    )}
                    <span className="badge badge-ghost">{report.type}</span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <button
                    className={`btn ${isGenerating ? "btn-secondary" : "btn-primary"}`}
                    onClick={() =>
                      handleGenerate(report.type, report.name)
                    }
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2
                          size={14}
                          className="animate-spin"
                        />{" "}
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download size={14} /> Generate{" "}
                        {selectedFormat.toUpperCase()}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Generation History ── */}
        <div className="card" style={{ marginTop: "32px" }}>
          <div className="card-header">
            <div>
              <div className="card-title">Report Generation History</div>
              <div className="card-description">
                {history.length === 0
                  ? "Generate a report above to see it here"
                  : `${history.length} report${history.length !== 1 ? "s" : ""} generated this session`}
              </div>
            </div>
            {history.length > 0 && (
              <span className="badge badge-ghost" style={{ fontSize: 10 }}>
                <Clock size={10} style={{ marginRight: 3 }} />
                Live
              </span>
            )}
          </div>
          <div className="card-body">
            {history.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "var(--text-tertiary)",
                }}
              >
                <FileText
                  size={32}
                  style={{ opacity: 0.25, marginBottom: 12 }}
                />
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: 4,
                  }}
                >
                  No reports generated yet
                </div>
                <div style={{ fontSize: 12.5 }}>
                  Click &quot;Generate&quot; on any report card above to
                  download and see it logged here.
                </div>
              </div>
            ) : (
              <div
                className="data-table-wrapper"
                style={{ border: "none" }}
              >
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>Type</th>
                      <th>Format</th>
                      <th>Generated</th>
                      <th>Size</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 500 }}>{row.name}</td>
                        <td>
                          <span className="badge badge-ghost">
                            {row.type}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              row.format === "PDF"
                                ? "badge-danger"
                                : row.format === "Excel"
                                  ? "badge-success"
                                  : "badge-primary"
                            }`}
                          >
                            {row.format}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>
                          {fmtDateTime(row.date)}
                        </td>
                        <td style={{ color: "var(--text-secondary)" }}>
                          {row.size}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleRedownload(row)}
                            title="Re-download"
                          >
                            <RefreshCw size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
