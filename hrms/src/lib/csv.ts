// CSV text that is safe to open in a spreadsheet. Quoting alone does not stop a spreadsheet from running a formula,
// so text that starts with = + - @ tab or CR gets a leading apostrophe (shown as plain text). Plain numbers, such as "-1.00", stay as they are.
export const cell = (v: string | number) => {
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const csv = (rows: (string | number)[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n");
export const pesos = (c: number) => (c / 100).toFixed(2);
export const csvResponse = (name: string, body: string) =>
  new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
