import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useEventData } from "../hooks/useEventData";
import type { EnrichedEvent } from "../lib/types";

type FilterMode = "all" | "single";

type EventWithDay = {
  dayDate: string;
  dayLabel: string;
  event: EnrichedEvent;
};

type Coordinates = {
  lat: number;
  lng: number;
};

type PointWithEvent = EventWithDay & {
  coordinates: Coordinates;
};

const DEFAULT_CENTER: Coordinates = { lat: 43.6532, lng: -79.3832 };
const GEO_CACHE_KEY = "serendipity.event_geocodes.v1";
const CITY_COORDINATES: Record<string, Coordinates> = {
  "toronto, on": { lat: 43.6532, lng: -79.3832 },
  "north york, on": { lat: 43.7615, lng: -79.4111 },
  "scarborough, on": { lat: 43.7764, lng: -79.2318 },
  "gananoque, on": { lat: 44.331, lng: -76.1636 },
  "calgary, ab": { lat: 51.0447, lng: -114.0719 },
};

function getPinColor(score: number): string {
  if (score >= 70) return "#4ade80";
  if (score >= 45) return "#facc15";
  return "#fb7185";
}

function hashOffset(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return (hash % 7) * 0.003;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const query = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) return null;

    const rows = (await response.json()) as Array<{ lat: string; lon: string }>;
    const row = rows[0];
    if (!row) return null;

    return { lat: Number(row.lat), lng: Number(row.lon) };
  } catch {
    return null;
  }
}

export function MapView({ onSelectEvent }: { onSelectEvent: (eventId: string) => void }) {
  const { data } = useEventData();
  const [mode, setMode] = useState<FilterMode>("all");
  const [selectedDay, setSelectedDay] = useState<string>(data.days[0]?.date ?? "");
  const [geoCache, setGeoCache] = useState<Record<string, Coordinates>>({});
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(GEO_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, Coordinates>;
      setGeoCache(parsed);
    } catch {
      // ignore malformed cache
    }
  }, []);

  const eventsWithDay = useMemo<EventWithDay[]>(
    () =>
      data.days.flatMap((day) =>
        day.events.map((event) => ({
          dayDate: day.date,
          dayLabel: day.label,
          event,
        })),
      ),
    [data.days],
  );

  const filteredEvents = useMemo(
    () => (mode === "all" ? eventsWithDay : eventsWithDay.filter((d) => d.dayDate === selectedDay)),
    [eventsWithDay, mode, selectedDay],
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveMissingCoordinates() {
      const next = { ...geoCache };
      let changed = false;

      for (const row of filteredEvents) {
        const address = row.event.location?.address?.trim();
        if (!address) continue;

        const key = address.toLowerCase();
        if (next[key]) continue;

        const geocoded = await geocodeAddress(address);
        if (cancelled) return;

        if (geocoded) {
          next[key] = geocoded;
          changed = true;
          continue;
        }

        const city = row.event.location?.city?.toLowerCase().trim() ?? "";
        const cityCenter = CITY_COORDINATES[city];
        if (!cityCenter) continue;

        next[key] = cityCenter;
        changed = true;
      }

      if (!changed || cancelled) return;

      setGeoCache(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(next));
      }
    }

    void resolveMissingCoordinates();

    return () => {
      cancelled = true;
    };
  }, [filteredEvents, geoCache]);

  const points = useMemo<PointWithEvent[]>(() => {
    return filteredEvents.flatMap((row) => {
      const address = row.event.location?.address?.trim();
      if (!address) return [];

      const cached = geoCache[address.toLowerCase()];
      if (!cached) return [];

      return [
        {
          ...row,
          coordinates: {
            lat: cached.lat + hashOffset(row.event.id),
            lng: cached.lng + hashOffset(`${row.event.id}-lng`),
          },
        },
      ];
    });
  }, [filteredEvents, geoCache]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 10);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markersLayerRef.current = layer;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (points.length === 0) {
      map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 10);
      return;
    }

    const latLngs: [number, number][] = [];
    for (const point of points) {
      const latLng: [number, number] = [point.coordinates.lat, point.coordinates.lng];
      latLngs.push(latLng);

      const marker = L.circleMarker(latLng, {
        color: getPinColor(point.event.serendipity.score),
        fillColor: getPinColor(point.event.serendipity.score),
        fillOpacity: 0.92,
        radius: 8,
        weight: 1.5,
      });

      const safeTitle = escapeHtml(point.event.title);
      const safeDayLabel = escapeHtml(point.dayLabel);
      const safeStart = escapeHtml(point.event.time.start_local);

      const popupContainer = document.createElement("div");
      popupContainer.className = "serendipity-popup-content";
      popupContainer.innerHTML = `
        <div class="serendipity-popup-card">
          <h3 class="serendipity-popup-title">${safeTitle}</h3>
          <p class="serendipity-popup-kicker">${safeDayLabel}</p>
          <p class="serendipity-popup-row">${safeStart}</p>
          <p class="serendipity-popup-row">serendipity score: <strong>${point.event.serendipity.score}</strong></p>
          <p class="serendipity-popup-row">warm intros: <strong>${point.event.serendipity.warm_connections.length}</strong></p>
          <p class="serendipity-popup-row">guest list: <strong>${point.event.guest_list?.total_count ?? 0}</strong></p>
          <div class="serendipity-popup-actions">
            <button type="button" data-action="details" class="serendipity-popup-button">details</button>
            <a href="${point.event.url}" target="_blank" rel="noreferrer" class="serendipity-popup-link">event page</a>
          </div>
        </div>
      `;

      const detailsButton = popupContainer.querySelector<HTMLButtonElement>('button[data-action="details"]');
      if (detailsButton) {
        detailsButton.addEventListener("click", () => {
          onSelectEvent(point.event.id);
          map.closePopup();
        });
      }

      marker.bindPopup(popupContainer, { className: "serendipity-leaflet-popup" });
      marker.addTo(layer);
    }

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 12);
      return;
    }

    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds.pad(0.2), { animate: true });
  }, [onSelectEvent, points]);

  return (
    <div className="space-y-5">
      <div className="glass-card-static p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-white/10 p-1">
            <button
              onClick={() => setMode("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "all"
                  ? "bg-[var(--color-accent-bg)] text-[var(--color-accent-400)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              all days
            </button>
            <button
              onClick={() => setMode("single")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "single"
                  ? "bg-[var(--color-accent-bg)] text-[var(--color-accent-400)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              specific day
            </button>
          </div>

          <select
            value={selectedDay}
            disabled={mode !== "single"}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="rounded-lg border border-white/10 bg-[var(--color-surface-900)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {data.days.map((day) => (
              <option key={day.date} value={day.date}>
                {day.label}
              </option>
            ))}
          </select>

          <p className="ml-auto text-xs text-[var(--color-text-secondary)]">
            {points.length} pinned {points.length === 1 ? "event" : "events"}
          </p>
        </div>
      </div>

      <div className="glass-card-static overflow-hidden">
        <div ref={mapContainerRef} className="h-[66vh] min-h-[460px] w-full" />
      </div>
    </div>
  );
}
