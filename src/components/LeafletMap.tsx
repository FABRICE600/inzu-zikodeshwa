import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Flame, Globe, LocateFixed, Map as MapIcon, Minus, Plus } from 'lucide-react';
import { ListingItem } from '../lib/api.ts';

const QUICK_ZOOM_PRESETS = [
  { id: 'kigali-center', label: 'Kigali City Center', coords: [-1.9536, 30.0606] as [number, number], zoom: 14 },
  { id: 'kicukiro', label: 'Kicukiro', coords: [-1.9781, 30.1045] as [number, number], zoom: 14 },
  { id: 'gasabo', label: 'Gasabo', coords: [-1.9441, 30.0956] as [number, number], zoom: 14 },
] as const;

interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
}

/**
 * Native HTML5 Canvas Leaflet overlay that visualizes listing concentration
 * and demand without relying on legacy global UMD plugins.
 */
class DensityHeatmapLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null;
  private points: HeatPoint[] = [];
  private gradientLut: Uint8ClampedArray;
  private mapRef: L.Map | null = null;

  constructor(points: HeatPoint[] = []) {
    super();
    this.points = points;
    this.gradientLut = this.buildGradientLut();
  }

  private buildGradientLut(): Uint8ClampedArray {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Uint8ClampedArray(256 * 4);
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0.0, 'rgba(10, 77, 56, 0)');
    grad.addColorStop(0.25, 'rgba(16, 185, 129, 0.55)');
    grad.addColorStop(0.55, 'rgba(245, 158, 11, 0.72)');
    grad.addColorStop(0.82, 'rgba(234, 88, 12, 0.84)');
    grad.addColorStop(1.0, 'rgba(220, 38, 38, 0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 1);
    return ctx.getImageData(0, 0, 256, 1).data;
  }

  setPoints(points: HeatPoint[]) {
    this.points = points;
    this.redraw();
  }

  onAdd(map: L.Map): this {
    this.mapRef = map;
    const canvas = document.createElement('canvas');
    canvas.className = 'leaflet-heatmap-layer';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '250';
    this.canvas = canvas;

    const panes = map.getPanes();
    panes.overlayPane.appendChild(canvas);

    map.on('moveend zoomend resize', this.redraw, this);
    this.redraw();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('moveend zoomend resize', this.redraw, this);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.mapRef = null;
    return this;
  }

  redraw = () => {
    const map = this.mapRef;
    const canvas = this.canvas;
    if (!map || !canvas) return;

    const size = map.getSize();
    if (size.x <= 0 || size.y <= 0) return;

    canvas.width = size.x;
    canvas.height = size.y;
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, size.x, size.y);

    if (this.points.length === 0) return;

    const zoom = map.getZoom();
    const radius = Math.max(26, Math.min(54, 18 + (zoom - 10) * 5.5));

    // Create reusable radial alpha stamp
    const stampSize = Math.ceil(radius * 2);
    const stamp = document.createElement('canvas');
    stamp.width = stampSize;
    stamp.height = stampSize;
    const sCtx = stamp.getContext('2d');
    if (!sCtx) return;

    const radial = sCtx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    radial.addColorStop(0, 'rgba(0, 0, 0, 1)');
    radial.addColorStop(0.45, 'rgba(0, 0, 0, 0.55)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sCtx.fillStyle = radial;
    sCtx.fillRect(0, 0, stampSize, stampSize);

    // Draw overlapping weighted alpha blobs
    for (const pt of this.points) {
      const point = map.latLngToContainerPoint([pt.lat, pt.lng]);
      if (
        point.x < -radius ||
        point.y < -radius ||
        point.x > size.x + radius ||
        point.y > size.y + radius
      ) {
        continue;
      }
      ctx.globalAlpha = Math.max(0.28, Math.min(0.85, pt.weight * 0.48));
      ctx.drawImage(stamp, point.x - radius, point.y - radius);
    }

    ctx.globalAlpha = 1;

    // Colorize accumulated alpha channel via LUT
    const imgData = ctx.getImageData(0, 0, size.x, size.y);
    const pixels = imgData.data;
    const lut = this.gradientLut;

    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha > 0) {
        const idx = alpha * 4;
        pixels[i] = lut[idx];
        pixels[i + 1] = lut[idx + 1];
        pixels[i + 2] = lut[idx + 2];
        pixels[i + 3] = Math.min(200, Math.round(lut[idx + 3] * 0.85));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };
}

interface LeafletMapProps {
  mode: 'browse' | 'detail' | 'picker';
  listings?: ListingItem[];
  center?: [number, number];
  zoom?: number;
  selectedPosition?: { lat: number; lng: number };
  onPickPosition?: (lat: number, lng: number) => void;
  onSelectListing?: (id: number) => void;
  className?: string;
}

function formatCompactPrice(rwf: number): string {
  if (rwf >= 1000000) {
    return `${(rwf / 1000000).toFixed(1).replace(/\.0$/, '')}M RWF`;
  }
  return `${Math.round(rwf / 1000)}k RWF`;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  mode,
  listings = [],
  center = [-1.9536, 30.0928], // Kigali center default
  zoom = 12,
  selectedPosition,
  onPickPosition,
  onSelectListing,
  className = 'h-[440px] w-full rounded-xl border border-stone-200 overflow-hidden',
}) => {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const quickZoomRef = useRef<HTMLDivElement | null>(null);
  const topControlsRef = useRef<HTMLDivElement | null>(null);
  const zoomControlsRef = useRef<HTMLDivElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<DensityHeatmapLayer | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const browseBoundsRef = useRef<L.LatLngBounds | null>(null);

  const [mapLayer, setMapLayer] = useState<'street' | 'satellite'>('street');
  const [showHeatmap, setShowHeatmap] = useState<boolean>(mode === 'browse');
  const [activeQuickZoom, setActiveQuickZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;

    const map = L.map(mapDivRef.current, {
      center,
      zoom,
      zoomControl: false,
      scrollWheelZoom: mode !== 'detail',
    });

    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    });

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      }
    );

    streetLayer.addTo(map);

    const heatLayer = new DensityHeatmapLayer([]);
    if (mode === 'browse') {
      heatLayer.addTo(map);
    }

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;
    heatmapLayerRef.current = heatLayer;
    streetLayerRef.current = streetLayer;
    satelliteLayerRef.current = satelliteLayer;

    [quickZoomRef, topControlsRef, zoomControlsRef, legendRef].forEach((ref) => {
      if (ref.current) {
        L.DomEvent.disableClickPropagation(ref.current);
        L.DomEvent.disableScrollPropagation(ref.current);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      heatmapLayerRef.current = null;
      streetLayerRef.current = null;
      satelliteLayerRef.current = null;
    };
  }, []);

  // Swap street / satellite tile layer cleanly without destroying map or markers
  useEffect(() => {
    const map = mapRef.current;
    const street = streetLayerRef.current;
    const satellite = satelliteLayerRef.current;
    if (!map || !street || !satellite) return;

    if (mapLayer === 'satellite') {
      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(satellite)) satellite.addTo(map);
    } else {
      if (map.hasLayer(satellite)) map.removeLayer(satellite);
      if (!map.hasLayer(street)) street.addTo(map);
    }
  }, [mapLayer]);

  // Toggle density heatmap overlay in browse mode
  useEffect(() => {
    const map = mapRef.current;
    const heat = heatmapLayerRef.current;
    if (!map || !heat) return;

    if (mode === 'browse' && showHeatmap) {
      if (!map.hasLayer(heat)) heat.addTo(map);
      heat.redraw();
    } else if (map.hasLayer(heat)) {
      map.removeLayer(heat);
    }
  }, [mode, showHeatmap]);

  // Keep heatmap data synchronized with current listings
  useEffect(() => {
    const heat = heatmapLayerRef.current;
    if (!heat || mode !== 'browse') return;

    const heatPoints: HeatPoint[] = listings
      .filter((item) => Boolean(item.latitude && item.longitude))
      .map((item) => ({
        lat: item.latitude,
        lng: item.longitude,
        weight: Math.min(1.65, 0.78 + (item.viewsCount || 0) / 140),
      }));

    heat.setPoints(heatPoints);
  }, [mode, listings]);

  // Keep map centered when prop changes in picker/detail mode
  useEffect(() => {
    if (!mapRef.current) return;
    if (mode === 'detail' && selectedPosition) {
      mapRef.current.setView([selectedPosition.lat, selectedPosition.lng], 15);
    } else if (mode === 'picker' && selectedPosition) {
      mapRef.current.panTo([selectedPosition.lat, selectedPosition.lng]);
    }
  }, [mode, selectedPosition?.lat, selectedPosition?.lng]);

  // Render markers (with Leaflet.markercluster in browse mode)
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    browseBoundsRef.current = null;

    if (mode === 'browse') {
      const bounds: L.LatLngExpression[] = [];
      const clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 48,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `<div class="rw-cluster-badge">${count}</div>`,
            className: 'rw-price-marker',
            iconSize: L.point(40, 40),
          });
        },
      });

      for (const item of listings) {
        if (!item.latitude || !item.longitude) continue;
        bounds.push([item.latitude, item.longitude]);
        const icon = L.divIcon({
          className: 'rw-price-marker',
          html: `<div class="rw-price-tag">${formatCompactPrice(item.priceRwf)}</div>`,
          iconSize: [86, 28],
          iconAnchor: [43, 14],
        });

        const marker = L.marker([item.latitude, item.longitude], { icon });
        const popupEl = document.createElement('div');
        popupEl.className = 'min-w-[205px]';
        popupEl.innerHTML = `
          <div style="font-family: 'DM Sans', sans-serif;">
            <div style="font-weight: 700; font-size: 13px; color: #141816; margin-bottom: 4px;">${item.title.replace(/</g, '&lt;')}</div>
            <div style="font-size: 12px; color: #52525b; margin-bottom: 6px;">${item.sector}, ${item.district}</div>
            <div style="font-weight: 700; font-size: 13px; color: #0a4d38; margin-bottom: 8px;">${new Intl.NumberFormat('en-RW').format(item.priceRwf)} RWF / mo</div>
            <button id="view-listing-${item.id}" type="button" style="width:100%; background:#141816; color:#fff; border:none; padding:8px 10px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">View Details</button>
          </div>
        `;
        marker.bindPopup(popupEl);
        marker.on('popupopen', () => {
          const btn = document.getElementById(`view-listing-${item.id}`);
          if (btn && onSelectListing) {
            btn.onclick = () => onSelectListing(item.id);
          }
        });

        clusterGroup.addLayer(marker);
      }

      group.addLayer(clusterGroup);

      if (bounds.length > 0) {
        const computed = L.latLngBounds(bounds);
        browseBoundsRef.current = computed;
        map.fitBounds(computed, { padding: [40, 40], maxZoom: 14 });
      }
    } else if (mode === 'detail' && selectedPosition) {
      const pinIcon = L.divIcon({
        className: 'rw-price-marker',
        html: `<div style="width:18px;height:18px;background:#0a4d38;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([selectedPosition.lat, selectedPosition.lng], { icon: pinIcon }).addTo(group);
    } else if (mode === 'picker') {
      const pos = selectedPosition || { lat: -1.9536, lng: 30.0928 };
      const pinIcon = L.divIcon({
        className: 'rw-price-marker',
        html: `<div style="width:20px;height:20px;background:#0a4d38;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const marker = L.marker([pos.lat, pos.lng], { icon: pinIcon, draggable: true }).addTo(group);
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        onPickPosition?.(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
      });
    }
  }, [mode, listings, selectedPosition?.lat, selectedPosition?.lng, onSelectListing, onPickPosition]);

  // Map click listener for picker mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'picker') return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      onPickPosition?.(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [mode, onPickPosition]);

  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    mapRef.current?.zoomOut();
  }, []);

  const handleRecenter = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const map = mapRef.current;
      if (!map) return;
      setActiveQuickZoom(null);
      if (mode === 'browse' && browseBoundsRef.current) {
        map.fitBounds(browseBoundsRef.current, { padding: [40, 40], maxZoom: 14 });
      } else if (selectedPosition) {
        map.setView([selectedPosition.lat, selectedPosition.lng], mode === 'detail' ? 15 : 13);
      } else {
        map.setView(center, zoom);
      }
    },
    [mode, selectedPosition, center, zoom]
  );

  const handleQuickZoom = useCallback(
    (e: React.MouseEvent, preset: (typeof QUICK_ZOOM_PRESETS)[number]) => {
      e.stopPropagation();
      const map = mapRef.current;
      if (!map) return;
      if (activeQuickZoom === preset.id && mode === 'browse' && browseBoundsRef.current) {
        setActiveQuickZoom(null);
        map.fitBounds(browseBoundsRef.current, { padding: [40, 40], maxZoom: 14 });
        return;
      }
      setActiveQuickZoom(preset.id);
      map.flyTo(preset.coords, preset.zoom, { duration: 0.6 });
    },
    [activeQuickZoom, mode]
  );

  const handleToggleLayer = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMapLayer((prev) => (prev === 'street' ? 'satellite' : 'street'));
  }, []);

  const handleToggleHeatmap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowHeatmap((prev) => !prev);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapDivRef} className="w-full h-full" />

      {/* Quick Zoom Navigation Control */}
      {mode !== 'detail' && (
        <div
          ref={quickZoomRef}
          role="group"
          aria-label="Quick Zoom locations"
          className="absolute top-3 left-3 z-[1000] max-w-[calc(100%-15.5rem)] flex flex-wrap items-center gap-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-stone-200 dark:border-zinc-700 rounded-xl shadow-md p-1"
        >
          <span className="hidden lg:inline-block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 px-2 whitespace-nowrap">
            Quick Zoom:
          </span>
          {QUICK_ZOOM_PRESETS.map((preset) => {
            const active = activeQuickZoom === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={(e) => handleQuickZoom(e, preset)}
                className={`min-h-[38px] px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 interactive-press ${
                  active
                    ? 'bg-[#0A4D38] text-white shadow-xs'
                    : 'text-zinc-800 dark:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Top-Right Map Layer & Density Heatmap Toggles */}
      <div
        ref={topControlsRef}
        className="absolute top-3 right-3 z-[1000] flex items-center gap-2"
      >
        {mode === 'browse' && (
          <button
            type="button"
            onClick={handleToggleHeatmap}
            aria-label={showHeatmap ? 'Hide listing density heatmap' : 'Show listing density heatmap'}
            aria-pressed={showHeatmap}
            className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 border rounded-xl shadow-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 interactive-press ${
              showHeatmap
                ? 'bg-[#0A4D38] text-white border-[#0A4D38]'
                : 'bg-white/95 dark:bg-zinc-900/95 hover:bg-white dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-stone-200 dark:border-zinc-700'
            }`}
          >
            <Flame className={`w-4 h-4 shrink-0 ${showHeatmap ? 'text-amber-300' : 'text-amber-600'}`} />
            Heatmap
          </button>
        )}

        <button
          type="button"
          onClick={handleToggleLayer}
          aria-label={
            mapLayer === 'street' ? 'Switch to satellite imagery' : 'Switch to street map'
          }
          aria-pressed={mapLayer === 'satellite'}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 bg-white/95 dark:bg-zinc-900/95 hover:bg-white dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-stone-200 dark:border-zinc-700 rounded-xl shadow-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 interactive-press"
        >
          {mapLayer === 'street' ? (
            <>
              <Globe className="w-4 h-4 text-[#0A4D38] dark:text-emerald-400 shrink-0" />
              Satellite
            </>
          ) : (
            <>
              <MapIcon className="w-4 h-4 text-[#0A4D38] dark:text-emerald-400 shrink-0" />
              Street Map
            </>
          )}
        </button>
      </div>

      {/* Heatmap Density Legend */}
      {mode === 'browse' && showHeatmap && (
        <div
          ref={legendRef}
          className="absolute bottom-6 left-3 z-[1000] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border border-stone-200 dark:border-zinc-700 rounded-xl shadow-md px-3 py-2 flex items-center gap-2.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300"
        >
          <span className="font-semibold text-zinc-900 dark:text-white whitespace-nowrap">Demand Density</span>
          <span className="text-zinc-500 dark:text-zinc-400">Low</span>
          <span
            aria-hidden="true"
            className="w-20 h-2.5 rounded-full border border-stone-200 dark:border-zinc-700"
            style={{
              background:
                'linear-gradient(90deg, rgba(16,185,129,0.75) 0%, rgba(245,158,11,0.9) 55%, rgba(220,38,38,0.95) 100%)',
            }}
          />
          <span className="text-zinc-500 dark:text-zinc-400">High</span>
        </div>
      )}

      {/* Mobile-Friendly Custom Zoom & Recenter Controls */}
      <div
        ref={zoomControlsRef}
        className="absolute bottom-6 right-3 z-[1000] flex flex-col bg-white/95 dark:bg-zinc-900/95 border border-stone-200 dark:border-zinc-700 rounded-xl shadow-md overflow-hidden divide-y divide-stone-200 dark:divide-zinc-700"
      >
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 active:bg-stone-200 dark:active:bg-zinc-700 transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 active:bg-stone-200 dark:active:bg-zinc-700 transition-colors cursor-pointer"
        >
          <Minus className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={handleRecenter}
          aria-label="Recenter map"
          title="Recenter map"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#0A4D38] dark:text-emerald-400 hover:bg-stone-100 dark:hover:bg-zinc-800 active:bg-stone-200 dark:active:bg-zinc-700 transition-colors cursor-pointer"
        >
          <LocateFixed className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
