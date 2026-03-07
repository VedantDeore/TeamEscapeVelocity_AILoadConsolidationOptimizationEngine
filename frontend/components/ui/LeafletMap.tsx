"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Route as RouteType } from "@/lib/mock-data";

interface LeafletMapProps {
  routes: RouteType[];
  selectedRoute: RouteType | null;
  onSelectRoute: (route: RouteType) => void;
  viewMode: "before" | "after";
}

/* ── Custom SVG icon builders ── */
function depotSvg(selected: boolean) {
  const size = selected ? 28 : 22;
  return `<svg width="${size}" height="${size}" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="ds"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.4"/></filter></defs>
    <circle cx="14" cy="14" r="12" fill="#f59e0b" stroke="#fff" stroke-width="2.5" filter="url(#ds)"/>
    <rect x="9" y="10" width="10" height="8" rx="1" fill="#fff" opacity="0.9"/>
    <polygon points="14,7 8,12 20,12" fill="#fff" opacity="0.9"/>
  </svg>`;
}

function pickupSvg(selected: boolean, color: string) {
  const size = selected ? 26 : 20;
  return `<svg width="${size}" height="${size}" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="ps"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.35"/></filter></defs>
    <circle cx="13" cy="13" r="10.5" fill="${color}" stroke="#fff" stroke-width="2" filter="url(#ps)"/>
    <rect x="8" y="9" width="10" height="8" rx="1.5" fill="#fff" opacity="0.9"/>
    <path d="M10,9 L10,7.5 A3,3 0 0 1 16,7.5 L16,9" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.9"/>
  </svg>`;
}

function deliverySvg(selected: boolean, color: string) {
  const size = selected ? 26 : 20;
  return `<svg width="${size}" height="${size}" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="dls"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.35"/></filter></defs>
    <circle cx="13" cy="13" r="10.5" fill="${color}" stroke="#fff" stroke-width="2" filter="url(#dls)"/>
    <path d="M13,7 L13,18 M9,14 L13,18 L17,14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;
}

export default function LeafletMap({
  routes,
  selectedRoute,
  onSelectRoute,
  viewMode,
}: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [22.5, 78.9629],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    // Add zoom control to bottom-right
    L.control.zoom({ position: "topleft" }).addTo(map);

    // Stadia dark tiles — cleaner than CARTO for route visualization
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        subdomains: "abcd",
      },
    ).addTo(map);

    L.control
      .attribution({ position: "bottomright" })
      .addAttribution("Leaflet | &copy; CARTO")
      .addTo(map);

    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw routes & markers
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    if (viewMode === "before") {
      // Before mode: scattered individual shipment markers
      const allPoints = routes.flatMap((r) => r.points);
      allPoints.forEach((point) => {
        const isDepot = point.type === "depot";
        const isPickup = point.type === "pickup";
        const color = isDepot ? "#f59e0b" : isPickup ? "#3b82f6" : "#ef4444";
        const svgHtml = isDepot
          ? depotSvg(false)
          : isPickup
            ? `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.7);box-shadow:0 0 8px ${color}80;"></div>`
            : `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.5);box-shadow:0 0 6px ${color}60;"></div>`;

        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "",
            html: svgHtml,
            iconSize: isDepot ? [22, 22] : [12, 12],
            iconAnchor: isDepot ? [11, 11] : [6, 6],
          }),
        }).addTo(layers);

        marker.bindTooltip(
          `<div style="font-weight:600;font-size:11px;">${point.city}</div>
           <div style="font-size:10px;color:#94a3b8;margin-top:1px;">${isDepot ? "Depot" : isPickup ? "Origin" : "Destination"}</div>`,
          {
            className: "lorri-tooltip",
            direction: "top",
            offset: [0, -8],
          },
        );
      });
    } else {
      // After mode: show optimized routes with enhanced visuals
      routes.forEach((route) => {
        const isSelected = selectedRoute?.id === route.id;
        const latLngs = route.points.map(
          (p) => [p.lat, p.lng] as L.LatLngExpression,
        );

        // Outer glow for selected route
        if (isSelected) {
          L.polyline(latLngs, {
            color: route.color,
            weight: 14,
            opacity: 0.08,
            smoothFactor: 1.5,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layers);

          L.polyline(latLngs, {
            color: route.color,
            weight: 8,
            opacity: 0.15,
            smoothFactor: 1.5,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layers);
        }

        // Main route polyline
        const polyline = L.polyline(latLngs, {
          color: route.color,
          weight: isSelected ? 4 : 2.5,
          opacity: isSelected ? 0.95 : 0.3,
          dashArray: isSelected ? undefined : "8 6",
          smoothFactor: 1.5,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layers);

        polyline.on("click", () => onSelectRoute(route));

        // Point markers
        route.points.forEach((point, i) => {
          const isDepot = point.type === "depot";
          const isPickup = point.type === "pickup";
          const isDelivery = point.type === "delivery";
          const markerColor = isDepot
            ? "#f59e0b"
            : isPickup
              ? "#3b82f6"
              : "#10b981";

          // SVG icons for selected route; simple circles for unselected
          let html: string;
          let iconSize: [number, number];
          let iconAnchor: [number, number];

          if (isSelected) {
            if (isDepot) {
              html = depotSvg(true);
              iconSize = [28, 28];
              iconAnchor = [14, 14];
            } else if (isPickup) {
              html = pickupSvg(true, route.color);
              iconSize = [26, 26];
              iconAnchor = [13, 13];
            } else {
              html = deliverySvg(true, "#10b981");
              iconSize = [26, 26];
              iconAnchor = [13, 13];
            }
          } else {
            const sz = isDepot ? 10 : 7;
            html = `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${markerColor};opacity:0.5;border:1.5px solid rgba(255,255,255,0.3);"></div>`;
            iconSize = [sz, sz];
            iconAnchor = [sz / 2, sz / 2];
          }

          const marker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({
              className: "",
              html,
              iconSize,
              iconAnchor,
            }),
          }).addTo(layers);

          marker.on("click", () => onSelectRoute(route));

          // Rich tooltip
          const loadBar =
            point.load_pct !== undefined
              ? `<div style="margin-top:4px;width:100%;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
                   <div style="width:${Math.min(point.load_pct, 100)}%;height:100%;background:${point.load_pct > 90 ? "#ef4444" : point.load_pct > 70 ? "#f59e0b" : "#10b981"};border-radius:2px;"></div>
                 </div>`
              : "";
          const weightInfo = point.weight_kg
            ? `<div style="font-size:10px;color:${isPickup ? "#60a5fa" : "#34d399"};margin-top:2px;font-weight:600;">
                ${isPickup ? "+" : "\u2212"}${point.weight_kg.toLocaleString()} kg
               </div>`
            : "";
          const loadInfo =
            point.current_load_kg !== undefined
              ? `<div style="font-size:9px;color:#94a3b8;margin-top:1px;">
                  Load: ${point.current_load_kg?.toLocaleString()} kg
                  ${point.load_pct !== undefined ? `<span style="margin-left:4px;padding:1px 4px;border-radius:3px;font-weight:700;font-size:8px;background:${point.load_pct > 90 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)"};color:${point.load_pct > 90 ? "#ef4444" : "#10b981"}">${point.load_pct.toFixed(0)}%</span>` : ""}
                 </div>`
              : "";
          const codeInfo = point.shipment_code
            ? `<div style="font-size:8px;color:#64748b;margin-top:2px;font-family:monospace;letter-spacing:0.3px;">${point.shipment_code}</div>`
            : "";

          marker.bindTooltip(
            `<div style="font-size:12px;font-weight:700;color:#f8fafc;">${point.city}</div>
             <div style="font-size:9px;color:#94a3b8;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">
               ${isDepot ? "\uD83C\uDFED Depot" : isPickup ? "\uD83D\uDCE6 Pickup" : "\uD83D\uDCCD Delivery"}
               ${isSelected ? ` \u00b7 Stop ${i + 1}` : ""}
             </div>
             ${weightInfo}
             ${loadInfo}
             ${loadBar}
             ${codeInfo}
             ${isSelected ? `<div style="font-size:9px;color:${route.color};margin-top:3px;font-weight:700;">${route.vehicleName}</div>` : ""}`,
            {
              className: "lorri-tooltip",
              direction: "top",
              offset: [0, -14],
            },
          );

          // Depot label
          if (isDepot && isSelected) {
            const isStart = i === 0;
            L.marker([point.lat, point.lng], {
              icon: L.divIcon({
                className: "",
                html: `<div style="
                  background: linear-gradient(135deg, #f59e0b, #d97706);
                  color: #fff;
                  font-size: 8px;
                  font-weight: 800;
                  padding: 2px 8px;
                  border-radius: 10px;
                  white-space: nowrap;
                  letter-spacing: 0.8px;
                  text-transform: uppercase;
                  box-shadow: 0 2px 8px rgba(245,158,11,0.4);
                  border: 1px solid rgba(255,255,255,0.3);
                ">${isStart ? "START" : "END"}</div>`,
                iconSize: [44, 18],
                iconAnchor: [22, -14],
              }),
            }).addTo(layers);
          }

          // Stop sequence numbers for selected route (non-depot)
          if (isSelected && !isDepot) {
            L.marker([point.lat, point.lng], {
              icon: L.divIcon({
                className: "",
                html: `<div style="
                  background: ${isPickup ? route.color : "#10b981"};
                  color: #fff;
                  font-size: 8px;
                  font-weight: 800;
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border: 2px solid rgba(255,255,255,0.8);
                  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                  font-family: system-ui, sans-serif;
                ">${i + 1}</div>`,
                iconSize: [18, 18],
                iconAnchor: [9, -8],
              }),
            }).addTo(layers);
          }
        });

        // Animated direction arrows for selected route
        if (isSelected && route.points.length > 1) {
          for (let i = 0; i < route.points.length - 1; i++) {
            const p1 = route.points[i];
            const p2 = route.points[i + 1];
            const midLat = (p1.lat + p2.lat) / 2;
            const midLng = (p1.lng + p2.lng) / 2;

            const angle =
              Math.atan2(p2.lng - p1.lng, p2.lat - p1.lat) * (180 / Math.PI);

            L.marker([midLat, midLng], {
              icon: L.divIcon({
                className: "",
                html: `<div style="
                  width: 0;
                  height: 0;
                  border-left: 5px solid transparent;
                  border-right: 5px solid transparent;
                  border-bottom: 8px solid ${route.color};
                  transform: rotate(${180 - angle}deg);
                  filter: drop-shadow(0 0 3px ${route.color});
                  opacity: 0.8;
                "></div>`,
                iconSize: [10, 8],
                iconAnchor: [5, 4],
              }),
            }).addTo(layers);
          }
        }
      });
    }
  }, [routes, selectedRoute, viewMode, onSelectRoute]);

  // Fly to selected route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedRoute) return;

    const bounds = L.latLngBounds(
      selectedRoute.points.map((p) => [p.lat, p.lng] as L.LatLngExpression),
    );
    map.flyToBounds(bounds, { padding: [80, 80], duration: 0.8 });
  }, [selectedRoute]);

  return (
    <>
      <style jsx global>{`
        .lorri-tooltip {
          background: rgba(15, 23, 42, 0.95) !important;
          backdrop-filter: blur(12px);
          border: 1px solid rgba(148, 163, 184, 0.15) !important;
          border-radius: 10px !important;
          padding: 10px 14px !important;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(255, 255, 255, 0.05) !important;
        }
        .lorri-tooltip::before {
          border-top-color: rgba(15, 23, 42, 0.95) !important;
        }
        .leaflet-control-zoom a {
          background: rgba(15, 23, 42, 0.9) !important;
          color: #94a3b8 !important;
          border-color: rgba(148, 163, 184, 0.15) !important;
          backdrop-filter: blur(8px);
        }
        .leaflet-control-zoom a:hover {
          background: rgba(30, 41, 59, 0.95) !important;
          color: #f8fafc !important;
        }
      `}</style>
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      />
    </>
  );
}
