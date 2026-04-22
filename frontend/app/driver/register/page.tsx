"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Phone, Mail, Lock, CreditCard, Loader2, ArrowRight } from "lucide-react";
import { registerDriver } from "@/lib/api";

export default function DriverRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    license_number: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await registerDriver(form);
      localStorage.setItem("driver_id", data.driver.id);
      localStorage.setItem("driver_name", data.driver.name);
      localStorage.setItem("driver_phone", data.driver.phone);
      router.replace("/driver/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "name", label: "Full Name", icon: User, type: "text", placeholder: "Enter your full name", required: true },
    { key: "phone", label: "Phone Number", icon: Phone, type: "tel", placeholder: "Enter phone number", required: true },
    { key: "email", label: "Email Address", icon: Mail, type: "email", placeholder: "Enter email (optional)", required: false },
    { key: "password", label: "Password", icon: Lock, type: "password", placeholder: "Create a password", required: true },
    { key: "license_number", label: "License Number", icon: CreditCard, type: "text", placeholder: "Driving license (optional)", required: false },
  ];

  return (
    <div style={{ paddingTop: 20 }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: "-0.5px" }}>
          Create Account
        </h1>
        <p style={{ fontSize: 14, color: "#64748b" }}>
          Register as a LORRI driver
        </p>
      </div>

      <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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

        {fields.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.key}>
              <label style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: 5,
                display: "block",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                {f.label} {!f.required && <span style={{ color: "#475569", fontSize: 10 }}>(optional)</span>}
              </label>
              <div style={{ position: "relative" }}>
                <Icon size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                <input
                  type={f.type}
                  value={(form as any)[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  required={f.required}
                  style={{
                    width: "100%",
                    padding: "13px 14px 13px 40px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#f1f5f9",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
          );
        })}

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
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 20 }}>
        <p style={{ fontSize: 14, color: "#64748b" }}>
          Already have an account?{" "}
          <Link href="/driver/login" style={{ color: "#0ea5e9", fontWeight: 600, textDecoration: "none" }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
