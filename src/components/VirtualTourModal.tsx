import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  MoveHorizontal,
  Pause,
  Play,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ListingItem } from '../lib/api.ts';
import { formatRwf } from '../lib/rwandaData.ts';
import { buildTourStops } from '../lib/virtualTour.ts';

interface VirtualTourModalProps {
  listing: ListingItem;
  onClose: () => void;
  onOpenListing?: (id: number) => void;
}

export const VirtualTourModal: React.FC<VirtualTourModalProps> = ({
  listing,
  onClose,
  onOpenListing,
}) => {
  const stops = useMemo(() => buildTourStops(listing), [listing]);
  const [stopIdx, setStopIdx] = useState(0);
  const [panPercent, setPanPercent] = useState(50); // 0 to 100 across wide panoramic canvas
  const [zoomScale, setZoomScale] = useState(1.25);
  const [autoPan, setAutoPan] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{ x: number; pan: number } | null>(null);
  const activeStop = stops[stopIdx] || stops[0];

  // Smooth auto-pan oscillation when enabled and not dragging
  useEffect(() => {
    if (!autoPan || isDragging) return;
    let rafId = 0;
    let last = performance.now();
    let dir = 1;

    const tick = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      setPanPercent((prev) => {
        let next = prev + dir * (dt * 0.009);
        if (next >= 92) {
          next = 92;
          dir = -1;
        } else if (next <= 8) {
          next = 8;
          dir = 1;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [autoPan, isDragging]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') {
        setAutoPan(false);
        setPanPercent((p) => Math.max(0, p - 8));
      }
      if (e.key === 'ArrowRight') {
        setAutoPan(false);
        setPanPercent((p) => Math.min(100, p + 8));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const selectStop = (index: number) => {
    const nextIdx = (index + stops.length) % stops.length;
    setStopIdx(nextIdx);
    setPanPercent(50);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setAutoPan(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, pan: panPercent };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const nextPan = Math.max(0, Math.min(100, dragStartRef.current.pan - dx * 0.14));
    setPanPercent(nextPan);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const headingDeg = Math.round(((panPercent / 100) * 360 + activeStop.defaultAngle) % 360);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`360 degree virtual tour for ${listing.title}`}
      className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-700/80 text-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Top Tour Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
              <Compass className="w-4 h-4 shrink-0" />
              <span>360° Interactive Virtual Tour</span>
              <span className="text-zinc-500">·</span>
              <span className="font-mono tabular-nums text-zinc-300">{headingDeg}°</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white truncate mt-0.5">
              {listing.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenListing && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenListing(listing.id);
                }}
                className="hidden sm:inline-flex items-center px-3.5 py-2 text-xs font-semibold bg-[#0D5C43] hover:bg-[#0f7454] text-white rounded-lg cursor-pointer whitespace-nowrap"
              >
                Open Listing
              </button>
            )}
            <button
              type="button"
              aria-label="Close virtual tour"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Panoramic Interactive Stage */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative h-[340px] sm:h-[440px] w-full overflow-hidden select-none touch-none bg-zinc-950 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <img
            src={activeStop.photoUrl}
            alt={`${listing.title} — ${activeStop.label}`}
            referrerPolicy="no-referrer"
            draggable={false}
            style={{
              objectPosition: `${panPercent}% 50%`,
              transform: `scale(${zoomScale})`,
              transformOrigin: `${panPercent}% 50%`,
            }}
            className="w-full h-full object-cover transition-[transform] duration-150 ease-out"
          />

          {/* Subtle Contrast Vignette */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/35" />

          {/* Interactive Hotspots inside scene */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              selectStop(stopIdx + 1);
            }}
            style={{ left: `${Math.max(18, Math.min(82, 110 - panPercent))}%`, top: '52%' }}
            className="absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 bg-white/95 hover:bg-white text-zinc-900 text-xs font-semibold rounded-lg shadow-lg border border-zinc-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-transform hover:scale-105"
          >
            <span className="w-2 h-2 rounded-full bg-[#0D5C43]" />
            Move to {stops[(stopIdx + 1) % stops.length].label.split(' ')[0]}
          </button>

          {/* Drag / Pan Instruction & Overlay Controls */}
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-xs text-zinc-200 inline-flex items-center gap-1.5 pointer-events-none">
            <MoveHorizontal className="w-3.5 h-3.5 text-emerald-300" />
            Drag left or right to look around
          </div>

          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={() => setAutoPan((v) => !v)}
              aria-label={autoPan ? 'Pause auto-pan' : 'Start auto-pan'}
              className="min-h-[38px] px-3 py-1.5 bg-black/65 hover:bg-black/80 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              {autoPan ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {autoPan ? 'Pause' : 'Auto-Pan'}
            </button>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(1.85, Number((z + 0.15).toFixed(2))))}
              aria-label="Zoom in tour"
              className="min-w-[38px] min-h-[38px] flex items-center justify-center bg-black/65 hover:bg-black/80 text-white rounded-lg cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(1.05, Number((z - 0.15).toFixed(2))))}
              aria-label="Zoom out tour"
              className="min-w-[38px] min-h-[38px] flex items-center justify-center bg-black/65 hover:bg-black/80 text-white rounded-lg cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPanPercent(50);
                setZoomScale(1.25);
              }}
              aria-label="Reset camera view"
              className="min-w-[38px] min-h-[38px] flex items-center justify-center bg-black/65 hover:bg-black/80 text-white rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Room Info Caption */}
          <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-end justify-between gap-3 pointer-events-none">
            <div>
              <div className="text-xs font-semibold text-emerald-300">
                Room {stopIdx + 1} of {stops.length} · {activeStop.label}
              </div>
              <div className="text-xs text-zinc-200 mt-0.5">{activeStop.description}</div>
            </div>
            <div className="text-sm font-bold font-mono tabular-nums text-white bg-black/55 px-3 py-1.5 rounded-lg">
              {formatRwf(listing.priceRwf)} / mo
            </div>
          </div>
        </div>

        {/* Bottom Room Switcher Strip */}
        <div className="px-4 sm:px-6 py-3.5 bg-zinc-900 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {stops.map((stop, idx) => {
              const active = idx === stopIdx;
              return (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => selectStop(idx)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#0D5C43] border-[#0D5C43] text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <img
                    src={stop.photoUrl}
                    alt={stop.label}
                    className="w-6 h-6 rounded object-cover shrink-0"
                  />
                  {stop.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => selectStop(stopIdx - 1)}
              aria-label="Previous room"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => selectStop(stopIdx + 1)}
              aria-label="Next room"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
