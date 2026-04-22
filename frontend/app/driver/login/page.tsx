"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, Lock, Loader2, Truck, ArrowRight } from "lucide-react";
import { loginDriver } from "@/lib/api";

export default function DriverLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await loginDriver(phone, password);
      localStorage.setItem("driver_id", data.driver.id);
      localStorage.setItem("driver_name", data.driver.name);
      localStorage.setItem("driver_phone", data.driver.phone);
      router.replace("/driver/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingTop: 40 }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          boxShadow: "0 8px 32px rgba(14,165,233,0.3)",
        }}>
          <Truck size={32} color="#fff" />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.5px" }}>
          Welcome Back
        </h1>
        <p style={{ fontSize: 14, color: "#64748b" }}>
          Sign in to your driver account
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {error && (
          <div style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#f87171",
            fontSize: 13,
            fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Phone Number
          </label>
          <div style={{ position: "relative" }}>
            <Phone size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              required
              style={{
                width: "100%",
                padding: "14px 14px 14px 42px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#f1f5f9",
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Password
          </label>
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{
                width: "100%",
                padding: "14px 14px 14px 42px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#f1f5f9",
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 8,
            boxShadow: "0 4px 20px rgba(14,165,233,0.3)",
            transition: "all 0.2s",
          }}
        >
          {loading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <ArrowRight size={18} />}
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: 28 }}>
        <p style={{ fontSize: 14, color: "#64748b" }}>
          Don&apos;t have an account?{" "}
          <Link href="/driver/register" style={{ color: "#0ea5e9", fontWeight: 600, textDecoration: "none" }}>
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}
