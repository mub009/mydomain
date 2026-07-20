import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, TrendingUp, X } from "lucide-react";
import { searchApi } from "@/api/endpoints";
import { PopularCity } from "@/types";

const RECENTS_KEY = "mydomain-recent-locations";
const MAX_RECENTS = 5;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecents(list: string[]): void {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    // localStorage unavailable (private browsing, quota) — recents just won't persist
  }
}

interface LocationInputProps {
  value: string;
  onChange: (city: string) => void;
  onDetect?: (lat: number, lng: number, label: string) => void;
  placeholder?: string;
  className?: string;
}

export default function LocationInput({ value, onChange, onDetect, placeholder, className }: LocationInputProps) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [trending, setTrending] = useState<PopularCity[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState("");
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setRecents(loadRecents());
    searchApi
      .popularCities()
      .then(setTrending)
      .catch(() => undefined);
  }, []);

  function commit(city: string) {
    onChange(city);
    if (city.trim()) {
      const next = [city, ...recents.filter((r) => r.toLowerCase() !== city.toLowerCase())].slice(0, MAX_RECENTS);
      setRecents(next);
      saveRecents(next);
    }
    setOpen(false);
  }

  function clearRecents(e: React.MouseEvent) {
    e.stopPropagation();
    setRecents([]);
    saveRecents([]);
  }

  function handleFocus() {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function handleBlur() {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  async function detectLocation() {
    setDetectError("");
    if (!navigator.geolocation) {
      setDetectError("Geolocation isn't supported by this browser.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let label = "Current location";
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            { signal: controller.signal, headers: { Accept: "application/json" } },
          );
          clearTimeout(timeout);
          if (res.ok) {
            const data = await res.json();
            const addr = data?.address ?? {};
            label = addr.city || addr.town || addr.village || addr.county || label;
          }
        } catch {
          // reverse geocoding is best-effort; fall back to a generic label
        }
        setDetecting(false);
        onChange(label);
        onDetect?.(latitude, longitude, label);
        setOpen(false);
      },
      (err) => {
        setDetecting(false);
        setDetectError(err.code === err.PERMISSION_DENIED ? "Location access denied." : "Couldn't detect your location.");
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-3 focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500">
        <MapPin size={18} className="text-brand-600 shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onClick={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder ?? "City / Location"}
          className="w-full text-sm text-ink-900 placeholder:text-gray-400 focus:outline-none"
        />
      </div>

      {open && (
        <div className="absolute z-40 top-full mt-1.5 w-full sm:w-80 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-popover py-2">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={detectLocation}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
          >
            <LocateFixed size={16} className={detecting ? "animate-pulse" : ""} />
            {detecting ? "Detecting your location…" : "Detect my location"}
          </button>
          {detectError && <p className="px-4 pb-1.5 text-xs text-red-600">{detectError}</p>}

          {recents.length > 0 && (
            <div className="pt-1.5">
              <div className="flex items-center justify-between px-4 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Recent locations</span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearRecents}
                  className="text-[11px] font-semibold text-brand-600 hover:underline flex items-center gap-0.5"
                >
                  <X size={11} /> Clear all
                </button>
              </div>
              {recents.map((r) => (
                <button
                  key={r}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(r)}
                  className="w-full text-left px-4 py-2 text-sm text-ink-800 hover:bg-gray-50 transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {trending.length > 0 && (
            <div className="pt-1.5 border-t border-gray-100 mt-1.5">
              <div className="flex items-center gap-1.5 px-4 py-1">
                <TrendingUp size={12} className="text-ink-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Trending areas</span>
              </div>
              {trending.map((t) => (
                <button
                  key={`${t.city}-${t.state}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(t.city)}
                  className="w-full text-left px-4 py-2 text-sm text-ink-800 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <span>
                    {t.city}, {t.state}
                  </span>
                  <span className="text-xs text-ink-500">{t.businessCount}</span>
                </button>
              ))}
            </div>
          )}

          {recents.length === 0 && trending.length === 0 && !detectError && (
            <p className="px-4 py-2 text-xs text-ink-500">Start typing a city, or detect your location above.</p>
          )}
        </div>
      )}
    </div>
  );
}
