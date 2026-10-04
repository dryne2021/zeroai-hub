import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Builds the watermarked, partial preview a client sees before accepting work.
 * Images are downscaled and covered in a tiled watermark. PDFs keep only the first
 * pages. Documents, spreadsheets, code and text become a short watermarked PDF excerpt.
 * Returns null when the format can't be previewed safely.
 */

export interface Preview {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

const MARK = "ZeroAI Hub preview - not for use";
const MAX_PREVIEW_INPUT = 60 * 1024 * 1024;

const TEXT_EXT = new Set([
  "txt", "md", "csv", "tsv", "json", "xml", "html", "htm", "css", "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "h",
  "cs", "go", "rb", "php", "rs", "kt", "swift", "sql", "yaml", "yml", "sh", "r", "dart", "vue", "svelte", "srt",
]);

export async function generatePreview(input: Buffer, fileName: string, mime: string | null): Promise<Preview | null> {
  if (input.byteLength > MAX_PREVIEW_INPUT) return null;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const type = (mime || "").toLowerCase();
  try {
    if (type.startsWith("image/") && !type.includes("svg")) return await imagePreview(input);
    if (type === "application/pdf" || ext === "pdf") return await pdfPreview(input);
    if (ext === "docx") return await textPdf(await docxText(input), fileName);
    if (ext === "xlsx") return await textPdf(await xlsxText(input), fileName);
    if (type.startsWith("text/") || TEXT_EXT.has(ext)) return await textPdf(input.toString("utf8"), fileName, true);
  } catch (err) {
    console.error("preview generation failed", fileName, err);
  }
  return null;
}

async function imagePreview(input: Buffer): Promise<Preview> {
  const sharp = (await import("sharp")).default;
  const img = sharp(input, { failOn: "none" }).rotate().resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true });
  const meta = await img.clone().toBuffer({ resolveWithObject: true });
  const { width, height } = meta.info;
  const tile = 220;
  let marks = "";
  for (let y = -tile; y < height + tile; y += tile * 0.6) {
    for (let x = -tile; x < width + tile; x += tile * 1.4) {
      marks += `<text x="${x}" y="${y}" transform="rotate(-28 ${x} ${y})">${MARK}</text>`;
    }
  }
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>text{font:600 15px sans-serif;fill:rgba(20,33,61,.45);stroke:rgba(255,255,255,.5);stroke-width:1.2px;paint-order:stroke;}</style>
      <rect x="0" y="${height - 34}" width="${width}" height="34" fill="rgba(20,33,61,.82)"/>
      ${marks}
      <text x="12" y="${height - 12}" style="fill:#fff;font:600 13px sans-serif">Low-resolution preview. Accept the work to download the original.</text>
    </svg>`,
  );
  const buffer = await sharp(meta.data).composite([{ input: svg }]).jpeg({ quality: 55 }).toBuffer();
  return { buffer, contentType: "image/jpeg", extension: "jpg" };
}

function stampPage(page: PDFPage, font: PDFFont, footer: string) {
  const { width, height } = page.getSize();
  const size = Math.max(14, Math.min(width, height) / 22);
  for (let y = 40; y < height; y += size * 7) {
    for (let x = -width * 0.2; x < width; x += size * 18) {
      page.drawText(MARK, {
        x,
        y,
        size,
        font,
        color: rgb(0.08, 0.13, 0.24),
        opacity: 0.22,
        rotate: degrees(28),
      });
    }
  }
  page.drawRectangle({ x: 0, y: 0, width, height: 26, color: rgb(0.08, 0.13, 0.24), opacity: 0.9 });
  page.drawText(footer, { x: 12, y: 9, size: 9, font, color: rgb(1, 1, 1) });
}

async function pdfPreview(input: Buffer): Promise<Preview> {
  const src = await PDFDocument.load(input, { ignoreEncryption: false });
  const total = src.getPageCount();
  const keep = Math.max(1, Math.min(3, Math.ceil(total * 0.3)));
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, Array.from({ length: keep }, (_, i) => i));
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  pages.forEach((p, i) => {
    out.addPage(p);
    stampPage(p, font, `Preview: page ${i + 1} of ${total}. ${total - keep} page(s) unlock after you accept the work.`);
  });
  return { buffer: Buffer.from(await out.save()), contentType: "application/pdf", extension: "pdf" };
}

async function docxText(input: Buffer) {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: input });
  return value;
}

async function xlsxText(input: Buffer) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(input as unknown as ArrayBuffer);
  const lines: string[] = [];
  wb.worksheets.slice(0, 2).forEach((ws) => {
    lines.push(`Sheet: ${ws.name} (${ws.rowCount} rows)`);
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n > 25) return;
      const cells = (row.values as unknown[]).slice(1).map((v) => {
        if (v == null) return "";
        if (typeof v === "object" && v && "result" in v) return String((v as { result: unknown }).result ?? "");
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return String(typeof v === "object" ? JSON.stringify(v) : v);
      });
      lines.push(cells.map((c) => c.slice(0, 18).padEnd(18)).join(" | "));
    });
    lines.push("");
  });
  return lines.join("\n");
}

/** pdf-lib's standard fonts only cover WinAnsi; replace anything else. */
function sanitize(s: string) {
  return s.replace(/\t/g, "    ").replace(/[^\x20-\x7E -ÿ]/g, "?");
}

async function textPdf(text: string, fileName: string, mono = false): Promise<Preview> {
  const all = text.replace(/\r\n/g, "\n").split("\n");
  const keepLines = Math.max(10, Math.min(120, Math.ceil(all.length * 0.35)));
  const lines = all.slice(0, keepLines);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(mono ? StandardFonts.Courier : StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = mono ? 8.5 : 10.5;
  const lineHeight = size * 1.45;
  const margin = 48;
  const width = 595;
  const height = 842;
  const maxWidth = width - margin * 2;

  const wrapped: string[] = [];
  for (const raw of lines) {
    let line = sanitize(raw);
    if (!line) {
      wrapped.push("");
      continue;
    }
    while (line.length) {
      let cut = line.length;
      while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut = Math.floor(cut * 0.9);
      wrapped.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }

  const perPage = Math.floor((height - margin * 2 - 30) / lineHeight);
  const pageCount = Math.max(1, Math.min(4, Math.ceil(wrapped.length / perPage)));
  for (let p = 0; p < pageCount; p++) {
    const page = doc.addPage([width, height]);
    page.drawText(sanitize(`${fileName}: excerpt`), { x: margin, y: height - margin, size: 11, font: bold, color: rgb(0.08, 0.13, 0.24) });
    wrapped.slice(p * perPage, (p + 1) * perPage).forEach((l, i) => {
      page.drawText(l, { x: margin, y: height - margin - 24 - i * lineHeight, size, font, color: rgb(0.15, 0.17, 0.22) });
    });
    stampPage(page, bold, `Preview shows the first ${keepLines} of ${all.length} lines. The full file unlocks after you accept the work.`);
  }
  return { buffer: Buffer.from(await doc.save()), contentType: "application/pdf", extension: "pdf" };
}
