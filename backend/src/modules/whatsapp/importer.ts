import ExcelJS from "exceljs";
import { normalizePhone } from "./phone";

/**
 * Reads a contact list out of a spreadsheet a shop exported from wherever they
 * keep it. Column order is never the same twice, so headers are matched by
 * name rather than position, and a file with no usable header row falls back
 * to "first column is the name, second is the phone".
 */

export interface ParsedContact {
  name: string;
  phone: string;
  email?: string;
  tag?: string;
}

export interface ImportProblem {
  row: number;
  value: string;
  reason: string;
}

export interface ParsedSheet {
  contacts: ParsedContact[];
  problems: ImportProblem[];
  /** Rows that carried the same number as an earlier row in the same file. */
  duplicatesInFile: number;
  totalRows: number;
}

// Header stems, after punctuation and the usual "no./number" suffix are
// stripped. Listing stems rather than every spelling is what lets "Mobile",
// "Mobile No.", "WhatsApp Number" and "Contact no" all land in one place.
const NAME_HEADERS = ["name", "customername", "fullname", "contactname", "customer", "client", "person", "party"];
const PHONE_HEADERS = ["phone", "mobile", "mob", "whatsapp", "wa", "contact", "cell", "cellphone", "tel", "telephone", "number"];
const EMAIL_HEADERS = ["email", "emailid", "emailaddress", "mail"];
const TAG_HEADERS = ["tag", "group", "category", "segment", "label", "type"];

// "Mobile No." and "Phone Number" are the same column with different noise on
// the end. Strip that noise so the stem lists stay short and readable.
const SUFFIXES = ["number", "numbers", "num", "nos", "no", "id"];

function headerKey(value: unknown): string {
  const key = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  for (const suffix of SUFFIXES) {
    // Only strip when something is left behind: "no" on its own is a header,
    // "number" alone is a phone column.
    if (key.length > suffix.length && key.endsWith(suffix)) {
      return key.slice(0, -suffix.length);
    }
  }
  return key;
}

// Excel cells are not always strings: a phone column is often stored as a
// number, and a formula cell arrives as an object with a `result`.
function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const cell = value as { text?: unknown; result?: unknown; richText?: { text: string }[]; hyperlink?: string };
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text).join("").trim();
    if (cell.text != null) return String(cell.text).trim();
    if (cell.result != null) return String(cell.result).trim();
  }
  return String(value).trim();
}

function findColumns(headerRow: unknown[]): { name: number; phone: number; email: number; tag: number } {
  const found = { name: -1, phone: -1, email: -1, tag: -1 };
  headerRow.forEach((raw, index) => {
    const key = headerKey(raw);
    if (found.name === -1 && NAME_HEADERS.includes(key)) found.name = index;
    else if (found.phone === -1 && PHONE_HEADERS.includes(key)) found.phone = index;
    else if (found.email === -1 && EMAIL_HEADERS.includes(key)) found.email = index;
    else if (found.tag === -1 && TAG_HEADERS.includes(key)) found.tag = index;
  });
  return found;
}

export async function parseContactSheet(buffer: Buffer): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("That file has no sheets in it");

  // Collect rows as plain arrays; exceljs rows are 1-based and sparse.
  const rows: { index: number; cells: string[] }[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = cellText(cell.value);
    });
    rows.push({ index: rowNumber, cells });
  });

  if (rows.length === 0) throw new Error("That file has no rows in it");

  let columns = findColumns(rows[0].cells);
  let firstDataRow = 1;

  // No recognisable header: assume the sheet starts straight into data with
  // name first and phone second — the shape of a hand-typed list.
  if (columns.phone === -1) {
    columns = { name: 0, phone: 1, email: -1, tag: -1 };
    firstDataRow = 0;
  }

  const contacts: ParsedContact[] = [];
  const problems: ImportProblem[] = [];
  const seen = new Set<string>();
  let duplicatesInFile = 0;

  for (let i = firstDataRow; i < rows.length; i += 1) {
    const { index, cells } = rows[i];
    const rawPhone = columns.phone >= 0 ? cells[columns.phone] ?? "" : "";
    const rawName = columns.name >= 0 ? cells[columns.name] ?? "" : "";

    // A wholly blank row in the middle of a sheet is padding, not an error.
    if (!rawPhone && !rawName) continue;

    const { phone, ok, reason } = normalizePhone(rawPhone);
    if (!ok) {
      problems.push({ row: index, value: rawPhone || "(empty)", reason: reason ?? "Not a valid phone number" });
      continue;
    }

    if (seen.has(phone)) {
      duplicatesInFile += 1;
      continue;
    }
    seen.add(phone);

    const email = columns.email >= 0 ? cells[columns.email] ?? "" : "";
    const tag = columns.tag >= 0 ? cells[columns.tag] ?? "" : "";

    contacts.push({
      // A number with no name still deserves to be imported.
      name: rawName || phone,
      phone,
      email: email && email.includes("@") ? email : undefined,
      tag: tag ? tag.slice(0, 60) : undefined,
    });
  }

  return { contacts, problems, duplicatesInFile, totalRows: rows.length - firstDataRow };
}
