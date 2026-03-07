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
      center: [20.5937, 78.9629], // Center of India
      zoom: 5,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark CartoDB tiles (same as reference screenshot)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        subdomains: "abcd",
      },
    ).addTo(map);

    // Add Leaflet + CARTO attribution
    L.control
      .attribution({ position: "bottomright" })
      .addAttribution("🍃 Leaflet | © CARTO")
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
      // Before mode: show scattered individual shipment markers (no routes)
      const allPoints = routes.flatMap((r) => r.points);
      allPoints.forEach((point) => {
        const color = point.type === "depot" ? "#f59e0b" : "#ef4444";
        const radius = point.type === "depot" ? 8 : 5;

        const circle = L.circleMarker([point.lat, point.lng], {
          radius,
          fillColor: color,
          fillOpacity: 0.65,
          color: color,
          weight: 1.5,
        }).addTo(layers);

        circle.bindTooltip(point.city, {
          className: "leaflet-route-tooltip",
          direction: "top",
          offset: [0, -8],
        });
      });
    } else {
      // After mode: show optimized routes with polylines
      routes.forEach((route) => {
        const isSelected = selectedRoute?.id === route.id;
        const latLngs = route.points.map(
          (p) => [p.lat, p.lng] as L.LatLngExpression,
        );

        // Route polyline
        const polyline = L.polyline(latLngs, {
          color: route.color,
          weight: isSelected ? 4 : 2,
          opacity: isSelected ? 1 : 0.35,
          dashArray: isSelected ? undefined : "6 4",
          smoothFactor: 1.5,
        }).addTo(layers);

        polyline.on("click", () => onSelectRoute(route));

        // Glow line for selected route
        if (isSelected) {
          L.polyline(latLngs, {
            color: route.color,
            weight: 12,
            opacity: 0.12,
            smoothFactor: 1.5,
          }).addTo(layers);
        }

        // Point markers — color-coded by stop type
        route.points.forEach((point, i) => {
          const isDepot = point.type === "depot";
          const isPickup = point.type === "pickup";
          const isDelivery = point.type === "delivery";

          // Use distinct colors per stop type
          const color = isDepot ? "#f59e0b" : isPickup ? "#0ea5e9" : "#10b981";
          const radius = isDepot ? (isSelected ? 10 : 7) : isSelected ? 8 : 5;
          const fillOpacity = isSelected ? 0.9 : 0.5;

          const circle = L.circleMarker([point.lat, point.lng], {
            radius,
            fillColor: color,
            fillOpacity,
            color: isSelected ? "#ffffff" : color,
            weight: isSelected ? 2 : 1.5,
          }).addTo(layers);

          circle.on("click", () => onSelectRoute(route));

          // Build rich tooltip
          const loadInfo =
            point.current_load_kg !== undefined
              ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px;">
                Load: ${point.current_load_kg?.toLocaleString()} kg
                ${point.load_pct !== undefined ? ` (${point.load_pct.toFixed(0)}%)` : ""}
               </div>`
              : "";
          const weightInfo = point.weight_kg
            ? `<div style="font-size:10px;color:${isPickup ? "#38bdf8" : "#34d399"};margin-top:1px;">
                ${isPickup ? "+" : "−"}${point.weight_kg.toLocaleString()} kg
               </div>`
            : "";

          const tooltipContent = `
            <div style="font-size:12px;font-weight:700;color:#fff;">${point.city}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">
              ${isDepot ? "🏭 Depot" : isPickup ? "📦 Pickup" : "📍 Delivery"}
              ${isSelected ? ` · Stop ${i + 1}` : ""}
            </div>
            ${weightInfo}
            ${loadInfo}
            ${isSelected ? `<div style="font-size:10px;color:${route.color};margin-top:3px;">${route.vehicleName}</div>` : ""}
          `;

          circle.bindTooltip(tooltipContent, {
            className: "leaflet-route-tooltip",
            direction: "top",
            offset: [0, -10],
          });

          // Depot label (always visible when selected)
          if (isDepot && isSelected) {
            L.marker([point.lat, point.lng], {
              icon: L.divIcon({
                className: "depot-label",
                html: `<div style="
                  background: rgba(245,158,11,0.9);
                  color: #000;
                  font-size: 9px;
                  font-weight: 700;
                  padding: 2px 6px;
                  border-radius: 4px;
                  white-space: nowrap;
                  letter-spacing: 0.5px;
                ">DEPOT</div>`,
                iconSize: [40, 16],
                iconAnchor: [20, -12],
              }),
            }).addTo(layers);
          }

          // Stop sequence numbers for selected route (non-depot)
          if (isSelected && !isDepot) {
            L.marker([point.lat, point.lng], {
              icon: L.divIcon({
                className: "stop-number",
                html: `<div style="
                  background: ${color};
                  color: #fff;
                  font-size: 8px;
                  font-weight: 800;
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  border: 1.5px solid rgba(255,255,255,0.6);
                  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
                ">${i + 1}</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, -6],
              }),
            }).addTo(layers);
          }
        });

        // Direction arrows for selected route
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
                className: "route-arrow",
                html: `<div style="
                  color: ${route.color};
                  font-size: 16px;
                  transform: rotate(${90 - angle}deg);
                  text-shadow: 0 0 6px ${route.color};
                  line-height: 1;
                ">▶</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
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
    map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8 });
  }, [selectedRoute]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    />
  );
}
