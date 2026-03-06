'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Layers, Clock, Fuel, Navigation,
  ChevronRight, MapPin, Truck, Loader2
} from 'lucide-react';
import { mockRoutes, type Route as RouteType } from '@/lib/mock-data';

// Dynamic import for Leaflet — it requires window/document (no SSR)
const LeafletMap = dynamic(() => import('@/components/ui/LeafletMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #0c1427 0%, #162032 50%, #0f1a2e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 size={28} style={{ color: 'var(--lorri-primary)', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '12px' }}>Loading map...</p>
      </div>
    </div>
  ),
});

export default function RoutesPage() {
  const [selectedRoute, setSelectedRoute] = useState<RouteType | null>(mockRoutes[0]);
  const [viewMode, setViewMode] = useState<'after' | 'before'>('after');

  const handleSelectRoute = useCallback((route: RouteType) => {
    setSelectedRoute(route);
  }, []);

  // Compute summary stats
  const totalDistance = useMemo(() => mockRoutes.reduce((s, r) => s + r.totalDistanceKm, 0), []);
  const totalFuel = useMemo(() => mockRoutes.reduce((s, r) => s + r.fuelCost, 0), []);
  const totalStops = useMemo(() => mockRoutes.reduce((s, r) => s + r.points.length, 0), []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Route Visualization</h1>
          <p className="page-subtitle">Interactive Leaflet map showing optimized delivery routes</p>
        </div>
        <div className="tabs">
          <button
            className={`tab ${viewMode === 'before' ? 'active' : ''}`}
            onClick={() => setViewMode('before')}
          >
            Before
          </button>
          <button
            className={`tab ${viewMode === 'after' ? 'active' : ''}`}
            onClick={() => setViewMode('after')}
          >
            After Consolidation
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary Stats Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '20px',
        }}>
          {[
            { label: 'Active Routes', value: mockRoutes.length, icon: Navigation, color: '#0ea5e9' },
            { label: 'Total Distance', value: `${totalDistance.toLocaleString()} km`, icon: MapPin, color: '#8b5cf6' },
            { label: 'Total Stops', value: totalStops, icon: Layers, color: '#10b981' },
            { label: 'Total Fuel Cost', value: `₹${totalFuel.toLocaleString()}`, icon: Fuel, color: '#f59e0b' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: 'var(--radius-md)',
                  background: `${stat.color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} style={{ color: stat.color }} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          {/* Leaflet Map */}
          <div className="card" style={{ overflow: 'hidden', height: '600px', position: 'relative' }}>
            <LeafletMap
              routes={mockRoutes}
              selectedRoute={selectedRoute}
              onSelectRoute={handleSelectRoute}
              viewMode={viewMode}
            />

            {/* Overlay: Mode Badge */}
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              zIndex: 1000,
              display: 'flex',
              gap: '8px',
            }}>
              <span className={`badge ${viewMode === 'after' ? 'badge-success' : 'badge-warning'}`} style={{ backdropFilter: 'blur(8px)', background: viewMode === 'after' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(245, 158, 11, 0.8)' }}>
                {viewMode === 'after' ? '✓ Consolidated Routes' : '⚠ Pre-Consolidation'}
              </span>
              <span className="badge badge-primary" style={{ backdropFilter: 'blur(8px)', background: 'rgba(14, 165, 233, 0.8)' }}>
                {mockRoutes.length} Routes
              </span>
            </div>

            {/* Overlay: Map Legend */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              zIndex: 1000,
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              fontSize: '11px',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Routes</div>
              {mockRoutes.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px',
                    cursor: 'pointer',
                    opacity: selectedRoute?.id === r.id ? 1 : 0.6,
                    transition: 'opacity 0.2s',
                  }}
                  onClick={() => handleSelectRoute(r)}
                >
                  <div style={{
                    width: '16px', height: '3px',
                    background: r.color,
                    borderRadius: '2px',
                    boxShadow: selectedRoute?.id === r.id ? `0 0 6px ${r.color}` : 'none',
                  }} />
                  <span style={{ color: 'var(--text-secondary)' }}>{r.vehicleName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Route Details Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Route Details</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Click a route to inspect</div>
            </div>

            {mockRoutes.map((route) => (
              <div
                key={route.id}
                className="card"
                onClick={() => handleSelectRoute(route)}
                style={{
                  cursor: 'pointer',
                  borderColor: selectedRoute?.id === route.id ? route.color : undefined,
                  boxShadow: selectedRoute?.id === route.id ? `0 0 15px ${route.color}30` : undefined,
                  transition: 'all 0.25s ease',
                }}
              >
                <div className="card-body" style={{ padding: '16px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: route.color,
                      boxShadow: selectedRoute?.id === route.id ? `0 0 8px ${route.color}80` : 'none',
                      transition: 'box-shadow 0.25s',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{route.vehicleName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        Cluster {route.clusterId.split('-')[1]}
                      </div>
                    </div>
                    <ChevronRight
                      size={14}
                      style={{
                        color: selectedRoute?.id === route.id ? route.color : 'var(--text-tertiary)',
                        transition: 'color 0.2s',
                      }}
                    />
                  </div>

                  {/* Stops */}
                  <div style={{ marginBottom: '12px' }}>
                    {route.points.map((point, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        paddingLeft: '4px',
                        position: 'relative',
                      }}>
                        {i < route.points.length - 1 && (
                          <div style={{
                            position: 'absolute',
                            left: '8px',
                            top: '20px',
                            bottom: '-8px',
                            width: '1px',
                            background: selectedRoute?.id === route.id ? `${route.color}40` : 'var(--border-primary)',
                            transition: 'background 0.25s',
                          }} />
                        )}
                        <div style={{
                          width: '10px', height: '10px', borderRadius: '50%',
                          background: point.type === 'depot' ? '#f59e0b' : route.color,
                          border: `2px solid ${selectedRoute?.id === route.id ? 'rgba(255,255,255,0.3)' : 'var(--bg-card)'}`,
                          flexShrink: 0,
                          zIndex: 1,
                          transition: 'border-color 0.25s',
                        }} />
                        <div style={{
                          fontSize: '12px',
                          color: point.type === 'depot' ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: point.type === 'depot' ? 600 : 400,
                          padding: '6px 0',
                        }}>
                          {point.city}
                          {point.type === 'depot' && (
                            <span style={{
                              fontSize: '9px',
                              color: '#fbbf24',
                              marginLeft: '6px',
                              fontWeight: 700,
                              letterSpacing: '0.5px',
                            }}>DEPOT</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Route Metrics */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px',
                    paddingTop: '12px', borderTop: '1px solid var(--border-secondary)',
                    fontSize: '11px',
                  }}>
                    <div>
                      <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={10} /> Distance
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{route.totalDistanceKm} km</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} /> ETA
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{route.estimatedTime}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Fuel size={10} /> Fuel
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>₹{route.fuelCost.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
