import ExcelJS from "exceljs";

export interface ExcelSheet {
  name: string;
  rows: Record<string, unknown>[] | unknown[][];
  columnWidths?: number[];
}

export async function downloadExcelFile(sheets: ExcelSheet[], filename: string): Promise<void> {
  const wb = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name);

    const isAoa = Array.isArray(sheet.rows[0]);
    if (isAoa) {
      const aoa = sheet.rows as unknown[][];
      ws.addRows(aoa);
    } else {
      const jsonRows = sheet.rows as Record<string, unknown>[];
      if (jsonRows.length > 0) {
        ws.addRow(Object.keys(jsonRows[0]));
        for (const row of jsonRows) {
          ws.addRow(Object.values(row));
        }
      }
    }

    if (sheet.columnWidths) {
      sheet.columnWidths.forEach((width, i) => {
        ws.getColumn(i + 1).width = width;
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
