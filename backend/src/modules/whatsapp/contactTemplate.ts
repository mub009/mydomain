import ExcelJS from "exceljs";

/**
 * The blank sheet a shop downloads before filling in their customers.
 *
 * The importer is forgiving about headings and phone formats, but handing
 * people a correct file to start from removes the guesswork — and setting the
 * phone column to text stops Excel doing the thing it always does: turning
 * 9876543210 into 9.87654E+09, or eating a leading zero.
 */
export async function buildContactTemplate(businessName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Markkito";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Contacts");

  sheet.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Email", key: "email", width: 30 },
    { header: "Tag", key: "tag", width: 18 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF128C4A" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;

  // Examples deliberately show different phone shapes, so it is obvious that
  // all of them are accepted and nobody reformats their whole list by hand.
  const examples = [
    { name: "Anil Menon", phone: "9876543210", email: "anil@example.com", tag: "regular" },
    { name: "Priya Suresh", phone: "+91 98000 11122", email: "", tag: "regular" },
    { name: "Ravi Kumar", phone: "098765 12345", email: "ravi@example.com", tag: "new" },
  ];
  examples.forEach((row) => sheet.addRow(row));

  // Keep the whole phone column as text, including the rows they add later.
  sheet.getColumn("phone").numFmt = "@";
  sheet.getColumn("phone").alignment = { horizontal: "left" };

  sheet.views = [{ state: "frozen", ySplit: 1 }];

  // Guidance lives on its own sheet rather than as comment rows, which would
  // otherwise be read back as contacts.
  const help = workbook.addWorksheet("How to use");
  help.columns = [{ width: 100 }];

  const lines: [string, boolean][] = [
    [`Contact list for ${businessName}`, true],
    ["", false],
    ["Fill in the Contacts sheet, then upload it under WhatsApp → Contacts → Upload Excel.", false],
    ["", false],
    ["Columns", true],
    ["Name  — required. If left blank the phone number is used instead.", false],
    ["Phone — required. This is the only column that must be filled in.", false],
    ["Email — optional.", false],
    ["Tag   — optional. Groups contacts so you can send to one group ('regular', 'diwali-2026').", false],
    ["", false],
    ["Phone numbers", true],
    ["Any of these work: 9876543210, +91 98000 11122, 098765 12345, 0091-9876543210.", false],
    ["A 10-digit number is treated as Indian (+91). Include the country code for anywhere else.", false],
    ["", false],
    ["Column order does not matter", true],
    ["Headings are matched by name, so 'Mobile No.', 'WhatsApp Number' and 'Contact no' all work.", false],
    ["You can delete the example rows and columns you do not need.", false],
    ["", false],
    ["What happens on upload", true],
    ["A number already in your contacts has its name refreshed instead of being added twice.", false],
    ["Rows without a usable phone number are skipped and reported back with the row number.", false],
    ["Anyone who previously opted out stays opted out — re-uploading never re-subscribes them.", false],
  ];

  lines.forEach(([text, bold]) => {
    const row = help.addRow([text]);
    if (bold) row.font = { bold: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
