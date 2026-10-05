// CSV text that is safe to open in a spreadsheet: values that start with a formula character are quoted.
export const cell = (v: string | number) => {
  const s = String(v);
  return /^[=+\-@]/.test(s) || /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csv = (rows: (string | number)[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n");
export const pesos = (c: number) => (c / 100).toFixed(2);
export const csvResponse = (name: string, body: string) =>
  new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
