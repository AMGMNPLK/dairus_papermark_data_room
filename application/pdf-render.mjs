// Local MuPDF application worker child. No vendor service, network URL fetch,
// notification or investor publication. Each PDF runs in a separate process.
import mupdf from "mupdf";
import fs from "node:fs/promises";
import path from "node:path";

const [input, destination] = process.argv.slice(2);
let doc;
try {
  const bytes = await fs.readFile(input);
  if (bytes.length > 20 * 1024 * 1024) throw new Error("PDF exceeds 20 MB");
  doc = new mupdf.PDFDocument(bytes);
  if (doc.needsPassword()) throw new Error("Upload an unencrypted PDF");
  const count = doc.countPages();
  if (count < 1 || count > 80)
    throw new Error("PDF must contain 1 to 80 pages");
  const pages = [];
  for (let i = 0; i < count; i++) {
    const page = doc.loadPage(i);
    let pixmap;
    try {
      const bounds = page.getBounds();
      const width = bounds[2] - bounds[0],
        height = bounds[3] - bounds[1];
      if (!Number.isFinite(width + height) || width <= 0 || height <= 0)
        throw new Error("Invalid PDF page bounds");
      const scale = Math.min(
        2,
        1600 / Math.max(width, height),
        Math.sqrt(4000000 / (width * height)),
      );
      pixmap = page.toPixmap(
        mupdf.Matrix.scale(scale, scale),
        mupdf.ColorSpace.DeviceRGB,
        false,
        true,
      );
      const png = Buffer.from(pixmap.asPNG());
      const file = `page-${i + 1}.png`;
      await fs.writeFile(path.join(destination, file), png, { mode: 0o600 });
      pages.push({
        pageNumber: i + 1,
        file,
        metadata: {
          originalWidth: width,
          originalHeight: height,
          scaledWidth: pixmap.getWidth(),
          scaledHeight: pixmap.getHeight(),
          scaleFactor: scale,
        },
      });
    } finally {
      pixmap?.destroy();
      page.destroy();
    }
  }
  await fs.writeFile(
    path.join(destination, "pages.json"),
    JSON.stringify(pages),
    { mode: 0o600 },
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "PDF rendering failed",
  );
  process.exitCode = 1;
} finally {
  doc?.destroy();
}
