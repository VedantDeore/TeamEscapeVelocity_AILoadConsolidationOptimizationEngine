"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Route as RouteType } from "@/lib/mock-data";

const MAPTILER_KEY = "W7r3awl6Vd3m8EdFkhue";

const TILE_URLS = {
  light: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
  dark: `https://api.maptiler.com/maps/streets-v2-dark/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
};

interface LeafletMapProps {
  routes: RouteType[];
  selectedRoute: RouteType | null;
  onSelectRoute: (route: RouteType) => void;
  viewMode: "before" | "after";
  mapTheme?: "light" | "dark";
}

/* ── OSRM road routing ─────────────────────────────────── */
async function fetchRoadRoute(
  points: { lat: number; lng: number }[],
): Promise<L.LatLngExpression[] | null> {
  if (points.length < 2) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    return data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression,
    );
  } catch {
    return null;
  }
}

/* ── Custom SVG icon builders ── */
function depotSvg(selected: boolean) {
  const size = selected ? 32 : 24;
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="ds${selected ? "s" : ""}"><feDropShadow dx="0" dy="1" stdDeviation="${selected ? 3 : 2}" flood-opacity="0.5"/></filter>
      <linearGradient id="dg${selected ? "s" : ""}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#d97706"/>
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="14" fill="url(#dg${selected ? "s" : ""})" stroke="#fff" stroke-width="2.5" filter="url(#ds${selected ? "s" : ""})"/>
    <rect x="10" y="13" width="12" height="7" rx="1" fill="#fff" opacity="0.92"/>
    <polygon points="16,8 9,14 23,14" fill="#fff" opacity="0.92"/>
  </svg>`;
}

function pickupSvg(selected: boolean, color: string) {
  const size = selected ? 30 : 22;
  return `<svg width="${size}" height="${size}" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="ps${size}"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.4"/></filter></defs>
    <circle cx="15" cy="15" r="13" fill="${color}" stroke="#fff" stroke-width="2.5" filter="url(#ps${size})"/>
    <rect x="9.5" y="11" width="11" height="9" rx="1.5" fill="#fff" opacity="0.92"/>
    <path d="M11.5,11 L11.5,9 A3.5,3.5 0 0 1 18.5,9 L18.5,11" fill="none" stroke="#fff" stroke-width="1.8" opacity="0.92"/>
  </svg>`;
}

function deliverySvg(selected: boolean, color: string) {
  const size = selected ? 30 : 22;
  return `<svg width="${size}" height="${size}" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="dlvs${size}"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.4"/></filter></defs>
    <circle cx="15" cy="15" r="13" fill="${color}" stroke="#fff" stroke-width="2.5" filter="url(#dlvs${size})"/>
    <path d="M15,8 L15,21 M10.5,16.5 L15,21 L19.5,16.5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;
}

export default function LeafletMap({
  routes,
  selectedRoute,
  onSelectRoute,
  viewMode,
  mapTheme = "dark",
}: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const roadCacheRef = useRef<Map<string, L.LatLngExpression[]>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [22.5, 78.9629],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: "topleft" }).addTo(map);

    const tileLayer = L.tileLayer(TILE_URLS[mapTheme], {
      maxZoom: 19,
      tileSize: 256,
    }).addTo(map);

    L.control
      .attribution({ position: "bottomright" })
      .addAttribution(
        '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      )
      .addTo(map);

    mapRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);
    tileLayerRef.current = tileLayer;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Switch tiles when theme changes
  useEffect(() => {
    const map = mapRef.current;
    const oldTile = tileLayerRef.current;
    if (!map || !oldTile) return;

    oldTile.setUrl(TILE_URLS[mapTheme]);
  }, [mapTheme]);

  // Draw routes & markers
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    layers.clearLayers();
    const isDark = mapTheme === "dark";

    if (viewMode === "before") {
      const allPoints = routes.flatMap((r) => r.points);
      allPoints.forEach((point) => {
        const isDepot = point.type === "depot";
        const isPickup = point.type === "pickup";
        const color = isDepot ? "#f59e0b" : isPickup ? "#3b82f6" : "#ef4444";
        const svgHtml = isDepot
          ? depotSvg(false)
          : `<div style="width:${isPickup ? 12 : 10}px;height:${isPickup ? 12 : 10}px;border-radius:50%;background:${color};border:2px solid ${isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.15)"};box-shadow:0 0 8px ${color}60;"></div>`;

        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: "",
            html: svgHtml,
            iconSize: isDepot ? [24, 24] : [12, 12],
            iconAnchor: isDepot ? [12, 12] : [6, 6],
          }),
        }).addTo(layers);

        marker.bindTooltip(
          `<div style="font-weight:700;font-size:12px;">${point.city}</div>
           <div style="font-size:10px;opacity:0.7;margin-top:1px;">${isDepot ? "Depot" : isPickup ? "Origin" : "Destination"}</div>`,
          {
            className: `lorri-tooltip ${isDark ? "lorri-tooltip-dark" : "lorri-tooltip-light"}`,
            direction: "top",
            offset: [0, -8],
          },
        );
      });
    } else {
      // After mode — fetch road routes then draw

      const drawRoutes = async () => {
        for (const route of routes) {
          const isSelected = selectedRoute?.id === route.id;

          // Try OSRM road route for selected route
          let roadLatLngs: L.LatLngExpression[] | null = null;
          const cacheKey = route.points
            .map((p) => `${p.lat},${p.lng}`)
            .join("|");

          if (isSelected) {
            if (roadCacheRef.current.has(cacheKey)) {
              roadLatLngs = roadCacheRef.current.get(cacheKey)!;
            } else {
              roadLatLngs = await fetchRoadRoute(route.points);
              if (roadLatLngs) {
                roadCacheRef.current.set(cacheKey, roadLatLngs);
              }
            }
          }

          const straightLatLngs = route.points.map(
            (p) => [p.lat, p.lng] as L.LatLngExpression,
          );
          const displayLatLngs = roadLatLngs || straightLatLngs;

          // Glow layers for selected
          if (isSelected) {
            L.polyline(displayLatLngs, {
              color: route.color,
              weight: 16,
              opacity: 0.06,
              smoothFactor: 1.5,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(layers);

            L.polyline(displayLatLngs, {
              color: route.color,
              weight: 10,
              opacity: 0.12,
              smoothFactor: 1.5,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(layers);
          }

          // Main route line
          const polyline = L.polyline(displayLatLngs, {
            color: route.color,
            weight: isSelected ? 4.5 : 2.5,
            opacity: isSelected ? 1 : 0.35,
            dashArray: isSelected ? undefined : "8 6",
            smoothFactor: 1.5,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layers);

          polyline.on("click", () => onSelectRoute(route));

          // Animated flowing dash overlay for selected route
          if (isSelected) {
            const animLine = L.polyline(displayLatLngs, {
              color: "#ffffff",
              weight: 2,
              opacity: 0.6,
              dashArray: "8 16",
              smoothFactor: 1.5,
              lineCap: "round",
              className: "animated-dash",
            }).addTo(layers);
          }

          // Point markers
          route.points.forEach((point, i) => {
            const isDepot = point.type === "depot";
            const isPickup = point.type === "pickup";
            const markerColor = isDepot
              ? "#f59e0b"
              : isPickup
                ? "#3b82f6"
                : "#10b981";

            let html: string;
            let iconSize: [number, number];
            let iconAnchor: [number, number];

            if (isSelected) {
              if (isDepot) {
                html = depotSvg(true);
                iconSize = [32, 32];
                iconAnchor = [16, 16];
              } else if (isPickup) {
                html = pickupSvg(true, route.color);
                iconSize = [30, 30];
                iconAnchor = [15, 15];
              } else {
                html = deliverySvg(true, "#10b981");
                iconSize = [30, 30];
                iconAnchor = [15, 15];
              }
            } else {
              const sz = isDepot ? 10 : 7;
              html = `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${markerColor};opacity:0.5;border:1.5px solid ${isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)"};"></div>`;
              iconSize = [sz, sz];
              iconAnchor = [sz / 2, sz / 2];
            }

            const marker = L.marker([point.lat, point.lng], {
              icon: L.divIcon({ className: "", html, iconSize, iconAnchor }),
              zIndexOffset: isSelected ? (isDepot ? 1000 : 900) : 0,
            }).addTo(layers);

            marker.on("click", () => onSelectRoute(route));

            // Tooltip
            const loadBar =
              point.load_pct !== undefined
                ? `<div style="margin-top:5px;width:100%;height:4px;background:${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"};border-radius:2px;overflow:hidden;">
                     <div style="width:${Math.min(point.load_pct, 100)}%;height:100%;background:${point.load_pct > 90 ? "#ef4444" : point.load_pct > 70 ? "#f59e0b" : "#10b981"};border-radius:2px;"></div>
                   </div>`
                : "";
            const weightInfo = point.weight_kg
              ? `<div style="font-size:10px;color:${isPickup ? "#60a5fa" : "#34d399"};margin-top:2px;font-weight:700;">
                  ${isPickup ? "+" : "\u2212"}${point.weight_kg.toLocaleString()} kg
                 </div>`
              : "";
            const loadInfo =
              point.current_load_kg !== undefined
                ? `<div style="font-size:9px;opacity:0.7;margin-top:1px;">
                    Truck Load: ${point.current_load_kg?.toLocaleString()} kg
                    ${point.load_pct !== undefined ? `<span style="margin-left:4px;padding:1px 5px;border-radius:4px;font-weight:800;font-size:8px;background:${point.load_pct > 90 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)"};color:${point.load_pct > 90 ? "#ef4444" : "#10b981"}">${point.load_pct.toFixed(0)}%</span>` : ""}
                   </div>`
                : "";
            const codeInfo = point.shipment_code
              ? `<div style="font-size:8px;opacity:0.5;margin-top:2px;font-family:monospace;letter-spacing:0.3px;">${point.shipment_code}</div>`
              : "";

            marker.bindTooltip(
              `<div style="font-size:12px;font-weight:800;">${point.city}</div>
               <div style="font-size:9px;opacity:0.6;margin-top:2px;text-transform:uppercase;letter-spacing:0.6px;font-weight:700;">
                 ${isDepot ? "\uD83C\uDFED Depot" : isPickup ? "\uD83D\uDCE6 Pickup" : "\uD83D\uDCCD Delivery"}
                 ${isSelected ? ` \u00b7 Stop ${i + 1}` : ""}
               </div>
               ${weightInfo}${loadInfo}${loadBar}${codeInfo}
               ${isSelected ? `<div style="font-size:9px;color:${route.color};margin-top:3px;font-weight:700;">${route.vehicleName}</div>` : ""}`,
              {
                className: `lorri-tooltip ${isDark ? "lorri-tooltip-dark" : "lorri-tooltip-light"}`,
                direction: "top",
                offset: [0, -16],
              },
            );

            // Depot labels
            if (isDepot && isSelected) {
              const isStart = i === 0;
              L.marker([point.lat, point.lng], {
                icon: L.divIcon({
                  className: "",
                  html: `<div style="
                    background: linear-gradient(135deg, ${isStart ? "#f59e0b" : "#22c55e"}, ${isStart ? "#d97706" : "#16a34a"});
                    color: #fff;
                    font-size: 8px;
                    font-weight: 800;
                    padding: 3px 10px;
                    border-radius: 12px;
                    white-space: nowrap;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    box-shadow: 0 3px 12px ${isStart ? "rgba(245,158,11,0.5)" : "rgba(34,197,94,0.5)"};
                    border: 1.5px solid rgba(255,255,255,0.4);
                  ">${isStart ? "START" : "END"}</div>`,
                  iconSize: [48, 20],
                  iconAnchor: [24, -16],
                }),
                zIndexOffset: 1100,
              }).addTo(layers);
            }

            // Stop sequence numbers
            if (isSelected && !isDepot) {
              L.marker([point.lat, point.lng], {
                icon: L.divIcon({
                  className: "",
                  html: `<div style="
                    background: ${isPickup ? route.color : "#10b981"};
                    color: #fff;
                    font-size: 9px;
                    font-weight: 800;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid rgba(255,255,255,0.85);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
                    font-family: system-ui, sans-serif;
                  ">${i + 1}</div>`,
                  iconSize: [20, 20],
                  iconAnchor: [10, -10],
                }),
                zIndexOffset: 950,
              }).addTo(layers);
            }

            // Pulse effect on selected depot
            if (isDepot && isSelected) {
              L.marker([point.lat, point.lng], {
                icon: L.divIcon({
                  className: "",
                  html: `<div class="depot-pulse" style="
                    width: 40px; height: 40px; border-radius: 50%;
                    background: rgba(245,158,11,0.2);
                    border: 2px solid rgba(245,158,11,0.4);
                  "></div>`,
                  iconSize: [40, 40],
                  iconAnchor: [20, 20],
                }),
                zIndexOffset: -100,
              }).addTo(layers);
            }
          });

          // Direction arrows along road route for selected
          if (isSelected && displayLatLngs.length > 1) {
            const arrowPoints = roadLatLngs
              ? _samplePoints(displayLatLngs as [number, number][], 6)
              : route.points.slice(0, -1).map((p, i) => ({
                  lat: (p.lat + route.points[i + 1].lat) / 2,
                  lng: (p.lng + route.points[i + 1].lng) / 2,
                  angle:
                    Math.atan2(
                      route.points[i + 1].lng - p.lng,
                      route.points[i + 1].lat - p.lat,
                    ) *
                    (180 / Math.PI),
                }));

            arrowPoints.forEach((ap) => {
              L.marker([ap.lat, ap.lng], {
                icon: L.divIcon({
                  className: "",
                  html: `<div style="
                    width: 0; height: 0;
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-bottom: 10px solid ${route.color};
                    transform: rotate(${180 - ap.angle}deg);
                    filter: drop-shadow(0 0 4px ${route.color});
                    opacity: 0.85;
                  "></div>`,
                  iconSize: [12, 10],
                  iconAnchor: [6, 5],
                }),
                zIndexOffset: 800,
              }).addTo(layers);
            });
          }
        }
      };

      drawRoutes();
    }
  }, [routes, selectedRoute, viewMode, onSelectRoute, mapTheme]);

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
        /* ── Tooltip themes ── */
        .lorri-tooltip-dark {
          background: rgba(15, 23, 42, 0.96) !important;
          color: #f1f5f9 !important;
          backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(148, 163, 184, 0.12) !important;
          border-radius: 12px !important;
          padding: 10px 14px !important;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.6),
            0 0 0 1px rgba(255, 255, 255, 0.04) !important;
        }
        .lorri-tooltip-dark::before {
          border-top-color: rgba(15, 23, 42, 0.96) !important;
        }
        .lorri-tooltip-light {
          background: rgba(255, 255, 255, 0.97) !important;
          color: #1e293b !important;
          backdrop-filter: blur(16px) !important;
          border: 1px solid rgba(0, 0, 0, 0.08) !important;
          border-radius: 12px !important;
          padding: 10px 14px !important;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.12),
            0 0 0 1px rgba(0, 0, 0, 0.04) !important;
        }
        .lorri-tooltip-light::before {
          border-top-color: rgba(255, 255, 255, 0.97) !important;
        }

        /* ── Zoom controls ── */
        .leaflet-control-zoom a {
          background: rgba(15, 23, 42, 0.85) !important;
          color: #94a3b8 !important;
          border-color: rgba(148, 163, 184, 0.12) !important;
          backdrop-filter: blur(8px);
          transition: all 0.15s ease;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(30, 41, 59, 0.95) !important;
          color: #f8fafc !important;
        }

        /* ── Animated flowing dashes ── */
        .animated-dash {
          animation: dashFlow 1.5s linear infinite;
        }
        @keyframes dashFlow {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -24;
          }
        }

        /* ── Depot pulse ── */
        .depot-pulse {
          animation: pulse-ring 2s ease-out infinite;
        }
        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
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

/* ── Helper: sample N evenly-spaced arrow points along a polyline ── */
function _samplePoints(
  coords: [number, number][],
  count: number,
): { lat: number; lng: number; angle: number }[] {
  if (coords.length < 2) return [];
  // Total polyline length
  let totalLen = 0;
  const segs: { len: number; idx: number }[] = [];
  for (let i = 1; i < coords.length; i++) {
    const dx = coords[i][1] - coords[i - 1][1];
    const dy = coords[i][0] - coords[i - 1][0];
    const len = Math.sqrt(dx * dx + dy * dy);
    segs.push({ len, idx: i });
    totalLen += len;
  }
  if (totalLen === 0) return [];

  const step = totalLen / (count + 1);
  const results: { lat: number; lng: number; angle: number }[] = [];
  let accum = 0;
  let segIdx = 0;
  let segAccum = 0;

  for (let n = 1; n <= count; n++) {
    const target = step * n;
    while (segIdx < segs.length && accum + segs[segIdx].len < target) {
      accum += segs[segIdx].len;
      segIdx++;
    }
    if (segIdx >= segs.length) break;
    const remain = target - accum;
    const frac = remain / segs[segIdx].len;
    const i = segs[segIdx].idx;
    const lat = coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * frac;
    const lng = coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * frac;
    const angle =
      Math.atan2(
        coords[i][1] - coords[i - 1][1],
        coords[i][0] - coords[i - 1][0],
      ) *
      (180 / Math.PI);
    results.push({ lat, lng, angle });
  }
  return results;
}
