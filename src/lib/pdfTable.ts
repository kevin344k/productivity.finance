// Extrae el texto de un PDF como líneas "a;b;c" ordenadas por posición visual.
export async function pdfToText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const out: string[] = [];

  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .flatMap((item) => {
        if (!("str" in item) || !item.str.trim()) return [];
        const m = pdfjs.Util.transform(viewport.transform, item.transform);
        return [{ text: item.str.trim(), x: m[4], y: m[5] }];
      })
      .sort((a, b) => a.y - b.y || a.x - b.x);

    let line: typeof items = [];
    const flush = () => {
      if (line.length) out.push(line.sort((a, b) => a.x - b.x).map((i) => i.text).join(";"));
      line = [];
    };
    for (const item of items) {
      if (line.length && Math.abs(item.y - line[0].y) > 3) flush();
      line.push(item);
    }
    flush();
  }
  return out.join("\n");
}
