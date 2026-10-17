// Browser-side location for a time stamp. Watches the position for a few seconds and keeps the most accurate fix,
// because the first fix a phone returns is often a rough cell-tower guess and GPS sharpens within seconds.
// Asked only at the moment of the stamp; nothing runs in the background.
export type Geo = { lat: number; lng: number; accuracy: number };
export type GeoResult = { geo: Geo | null; geoError?: "DENIED" | "UNAVAILABLE" };

export function bestFix({ targetMeters = 20, maxMs = 12_000 } = {}): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ geo: null, geoError: "UNAVAILABLE" });
    let best: Geo | null = null;
    let done = false;
    const finish = (r: GeoResult) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(id);
      clearTimeout(timer);
      resolve(r);
    };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        if (!best || fix.accuracy < best.accuracy) best = fix;
        if (fix.accuracy <= targetMeters) finish({ geo: best });
      },
      (e) => finish(best ? { geo: best } : { geo: null, geoError: e.code === 1 ? "DENIED" : "UNAVAILABLE" }),
      { enableHighAccuracy: true, timeout: maxMs, maximumAge: 0 },
    );
    const timer = setTimeout(() => finish(best ? { geo: best } : { geo: null, geoError: "UNAVAILABLE" }), maxMs);
  });
}

// Laptops and desktops have no GPS: the browser estimates from nearby Wi-Fi, or worse from the IP address.
export const isDesktop = () =>
  typeof window !== "undefined" && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && window.matchMedia("(pointer: fine)").matches;
