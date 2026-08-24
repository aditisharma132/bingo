/* Client-side PDF export for agreements. */
import { jsPDF } from "jspdf";

export function downloadTextPdf(fileName: string, title: string, body: string, footer?: string[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, margin, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(body, width) as string[];
  for (const line of lines) {
    if (y > bottom) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 16;
  }

  if (footer?.length) {
    y += 12;
    doc.setFont("helvetica", "bold");
    if (y > bottom) {
      doc.addPage();
      y = margin;
    }
    doc.text("Signatures", margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    for (const f of footer) {
      const wrapped = doc.splitTextToSize(f, width) as string[];
      for (const line of wrapped) {
        if (y > bottom) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 16;
      }
    }
  }

  doc.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}
