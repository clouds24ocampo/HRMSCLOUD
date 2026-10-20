// Single place that reads environment variables. Server-only: client code cannot see these (NEXT_PUBLIC_* values
// must stay literal `process.env.NEXT_PUBLIC_X` reads where they are used, because Next inlines them at build time).
// Every value is a getter so it is read when used, which lets tests change the environment between cases.

const num = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  /** Postgres connection string. Required; the app cannot run without it. */
  get databaseUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
    return url;
  },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  /** Public origin of the site, without a trailing slash. Empty when unset (then the request's host is used). */
  get appUrl() { return process.env.APP_URL?.replace(/\/$/, "") ?? ""; },
  /** Force the Secure cookie flag on or off; undefined means decide from APP_URL and NODE_ENV. */
  get cookieSecure(): boolean | undefined {
    const v = process.env.COOKIE_SECURE;
    return v === "true" ? true : v === "false" ? false : undefined;
  },
  /** One company per install unless a test environment opts in to several. */
  get multiOrg() { return process.env.ALLOW_MULTIPLE_ORGS === "true"; },
  get sessionTtlHours() { return num(process.env.SESSION_TTL_HOURS, 8); },
  get registerLimitPerHour() { return num(process.env.REGISTER_LIMIT_PER_HOUR, 10); },
  get documentMaxMb() { return num(process.env.DOCUMENT_MAX_MB, 5); },
  /** Folder for uploaded files, relative to the working directory unless absolute. */
  get storageDir() { return process.env.STORAGE_DIR ?? "storage"; },
};
