import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ListingItem } from '../lib/api.ts';

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
  className = 'h-[440px] w-full rounded-xl border border-zinc-200 overflow-hidden',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      scrollWheelZoom: mode !== 'detail',
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Keep map centered when prop changes in picker/detail mode
  useEffect(() => {
    if (!mapRef.current) return;
    if (mode === 'detail' && selectedPosition) {
      mapRef.current.setView([selectedPosition.lat, selectedPosition.lng], 15);
    } else if (mode === 'picker' && selectedPosition) {
      mapRef.current.panTo([selectedPosition.lat, selectedPosition.lng]);
    }
  }, [mode, selectedPosition?.lat, selectedPosition?.lng]);

  // Render markers and click handlers
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (mode === 'browse') {
      const bounds: L.LatLngExpression[] = [];
      for (const item of listings) {
        if (!item.latitude || !item.longitude) continue;
        bounds.push([item.latitude, item.longitude]);
        const icon = L.divIcon({
          className: 'rw-price-marker',
          html: `<div class="rw-price-tag">${formatCompactPrice(item.priceRwf)}</div>`,
          iconSize: [86, 28],
          iconAnchor: [43, 14],
        });

        const marker = L.marker([item.latitude, item.longitude], { icon }).addTo(group);
        const popupEl = document.createElement('div');
        popupEl.className = 'min-w-[200px]';
        popupEl.innerHTML = `
          <div style="font-family: 'DM Sans', sans-serif;">
            <div style="font-weight: 700; font-size: 13px; color: #18181b; margin-bottom: 4px;">${item.title.replace(/</g, '&lt;')}</div>
            <div style="font-size: 12px; color: #52525b; margin-bottom: 6px;">${item.sector}, ${item.district}</div>
            <div style="font-weight: 700; font-size: 13px; color: #0d5c43; margin-bottom: 8px;">${new Intl.NumberFormat('en-RW').format(item.priceRwf)} RWF / mo</div>
            <button id="view-listing-${item.id}" style="width:100%; background:#18181b; color:#fff; border:none; padding:6px 10px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">View Details</button>
          </div>
        `;
        marker.bindPopup(popupEl);
        marker.on('popupopen', () => {
          const btn = document.getElementById(`view-listing-${item.id}`);
          if (btn && onSelectListing) {
            btn.onclick = () => onSelectListing(item.id);
          }
        });
      }

      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
      }
    } else if (mode === 'detail' && selectedPosition) {
      const pinIcon = L.divIcon({
        className: 'rw-price-marker',
        html: `<div style="width:18px;height:18px;background:#0d5c43;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([selectedPosition.lat, selectedPosition.lng], { icon: pinIcon }).addTo(group);
    } else if (mode === 'picker') {
      const pos = selectedPosition || { lat: -1.9536, lng: 30.0928 };
      const pinIcon = L.divIcon({
        className: 'rw-price-marker',
        html: `<div style="width:20px;height:20px;background:#0d5c43;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
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

  return <div ref={containerRef} className={className} />;
};
