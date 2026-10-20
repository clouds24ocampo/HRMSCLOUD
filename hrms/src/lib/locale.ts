// Regional defaults used when an organization has not chosen its own (timezone is an organization setting).
// Pure and client-safe: no environment or database access. Change these here, not at the call sites.

export const DEFAULT_TIMEZONE = "Asia/Manila";
export const DEFAULT_LOCALE = "en-PH";
export const DEFAULT_CURRENCY = "PHP";

/** OpenStreetMap link that drops a pin at a recorded time-stamp location. */
export const mapUrl = (lat: number, lng: number, zoom = 18) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
