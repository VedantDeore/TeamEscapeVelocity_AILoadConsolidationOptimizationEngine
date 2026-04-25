"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Camera, User, Phone, Mail, Shield, FileCheck, Save,
  Loader2, ChevronLeft, Check, AlertCircle, MapPin, Navigation,
} from "lucide-react";
import { updateDriverProfile, listDrivers } from "@/lib/api";

export default function DriverProfilePage() {
  const router = useRouter();
  const [driverId, setDriverId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [license, setLicense] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [driverStatus, setDriverStatus] = useState("");
  const [currentCity, setCurrentCity] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = localStorage.getItem("driver_id");
    if (!id) { router.replace("/driver/login"); return; }
    setDriverId(id);
    setName(localStorage.getItem("driver_name") || "");
    setPhone(localStorage.getItem("driver_phone") || "");

    listDrivers().then((drivers) => {
      const me = drivers.find((d: any) => d.id === id);
      if (me) {
        setEmail(me.email || "");
        setLicense(me.license_number || "");
        setAvatarUrl(me.avatar_url || "");
        setIsVerified(me.is_verified || false);
        setHomeAddress(me.home_address || "");
        setHomeCity(me.home_city || "");
        setDriverStatus(me.driver_status || "idle_at_home");
        setCurrentCity(me.current_city || "");
      }
    }).catch(() => {});
  }, [router]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const canvas = document.createElement("canvas");
      const img = new Image();
      img.onload = () => {
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        setAvatarUrl(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateDriverProfile(driverId, {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        license_number: license.trim() || undefined,
        avatar_url: avatarUrl || undefined,
        home_address: homeAddress.trim() || undefined,
      });
      if (updated.name) localStorage.setItem("driver_name", updated.name);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const accent = "#0ea5e9";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 40 }}>
      <button
        onClick={() => router.back()}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", color: "#94a3b8",
          cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0,
        }}
      >
        <ChevronLeft size={16} /> Back
      </button>

      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4, color: "#f1f5f9" }}>
          Edit Profile
        </h1>
        <p style={{ fontSize: 13, color: "#64748b" }}>Manage your driver details</p>
      </div>

      {/* Avatar */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          style={{ position: "relative", cursor: "pointer" }}
          onClick={() => fileRef.current?.click()}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{
                width: 100, height: 100, borderRadius: "50%",
                objectFit: "cover", border: `3px solid ${accent}`,
              }}
            />
          ) : (
            <div style={{
              width: 100, height: 100, borderRadius: "50%",
              background: `linear-gradient(135deg, ${accent}, #06b6d4)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, fontWeight: 800, color: "#fff",
            }}>
              {name.charAt(0).toUpperCase() || "D"}
            </div>
          )}
          <div style={{
            position: "absolute", bottom: 0, right: 0,
            width: 32, height: 32, borderRadius: "50%",
            background: accent, display: "flex", alignItems: "center",
            justifyContent: "center", border: "2px solid #0f172a",
          }}>
            <Camera size={14} color="#fff" />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#f87171", fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Form Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FieldGroup label="Full Name" icon={<User size={15} color="#64748b" />}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={inputStyle}
          />
        </FieldGroup>

        <FieldGroup label="Phone" icon={<Phone size={15} color="#64748b" />}>
          <input value={phone} disabled style={{ ...inputStyle, opacity: 0.5 }} />
        </FieldGroup>

        <FieldGroup label="Email" icon={<Mail size={15} color="#64748b" />}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="driver@email.com"
            style={inputStyle}
          />
        </FieldGroup>

        <FieldGroup label="Home Address" icon={<MapPin size={15} color="#64748b" />}>
          <input
            value={homeAddress}
            onChange={(e) => setHomeAddress(e.target.value)}
            placeholder="e.g. Andheri East, Mumbai, Maharashtra"
            style={inputStyle}
          />
        </FieldGroup>

        {homeCity && (
          <div style={{
            padding: "10px 14px", borderRadius: 12,
            background: "rgba(14,165,233,0.06)",
            border: "1px solid rgba(14,165,233,0.12)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <Navigation size={15} color="#0ea5e9" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9" }}>
                Home City: {homeCity}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Auto-detected from your address
              </div>
            </div>
          </div>
        )}

        <FieldGroup label="Driving License" icon={<FileCheck size={15} color="#64748b" />}>
          <input
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="e.g. MH01-20230012345"
            style={inputStyle}
          />
        </FieldGroup>

        {/* Status badge */}
        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: driverStatus === "idle_at_home" ? "rgba(16,185,129,0.08)" :
            driverStatus === "idle_at_depot" ? "rgba(245,158,11,0.08)" :
            driverStatus === "assigned" ? "rgba(99,91,255,0.08)" :
            "rgba(14,165,233,0.08)",
          border: `1px solid ${driverStatus === "idle_at_home" ? "rgba(16,185,129,0.2)" :
            driverStatus === "idle_at_depot" ? "rgba(245,158,11,0.2)" :
            "rgba(99,91,255,0.2)"}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <MapPin size={18} color={
            driverStatus === "idle_at_home" ? "#10b981" :
            driverStatus === "idle_at_depot" ? "#f59e0b" :
            driverStatus === "assigned" ? "#635BFF" : "#0ea5e9"
          } />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color:
              driverStatus === "idle_at_home" ? "#10b981" :
              driverStatus === "idle_at_depot" ? "#f59e0b" :
              driverStatus === "assigned" ? "#635BFF" : "#0ea5e9"
            }}>
              {driverStatus === "idle_at_home" ? "At Home" :
               driverStatus === "idle_at_depot" ? `At Depot${currentCity ? ` — ${currentCity}` : ""}` :
               driverStatus === "assigned" ? "Assigned to Route" :
               driverStatus === "en_route" ? "En Route" : driverStatus || "Unknown"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {driverStatus === "idle_at_home" ? "Available for assignment from home location" :
               driverStatus === "idle_at_depot" ? "Waiting at destination depot for new assignment" :
               driverStatus === "assigned" ? "Currently assigned — complete your task first" :
               "Your current assignment status"}
            </div>
          </div>
        </div>

        {/* Verification badge */}
        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: isVerified ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
          border: `1px solid ${isVerified ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <Shield size={18} color={isVerified ? "#10b981" : "#f59e0b"} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: isVerified ? "#10b981" : "#f59e0b" }}>
              {isVerified ? "Verified Driver" : "Pending Verification"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {isVerified ? "Your license has been verified" : "Add your license number and submit for verification"}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%", padding: "16px", borderRadius: 12, border: "none",
          background: saved
            ? "linear-gradient(135deg, #10b981, #059669)"
            : `linear-gradient(135deg, ${accent}, #06b6d4)`,
          color: "#fff", fontSize: 16, fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: `0 4px 20px ${accent}44`,
          transition: "all 0.3s",
        }}
      >
        {saving ? (
          <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        ) : saved ? (
          <Check size={18} />
        ) : (
          <Save size={18} />
        )}
        {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px 13px 42px",
  borderRadius: 12,
  border: "1px solid rgba(14,165,233,0.15)",
  background: "rgba(14,165,233,0.04)",
  color: "#f1f5f9",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box" as const,
};

function FieldGroup({ label, icon, children }: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{
        fontSize: 11, fontWeight: 600, color: "#94a3b8",
        marginBottom: 6, display: "block",
        textTransform: "uppercase", letterSpacing: "0.5px",
      }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
          {icon}
        </div>
        {children}
      </div>
    </div>
  );
}
