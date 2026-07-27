import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { formatPhone, normalizePhone, toWhatsappId } from "@/modules/whatsapp/phone";
import { parseContactSheet } from "@/modules/whatsapp/importer";
import { buildContactTemplate } from "@/modules/whatsapp/contactTemplate";
import { renderTemplate } from "@/modules/whatsapp/whatsapp.service";
import { describeWindow, isWithinWindow, msUntilWindowOpens } from "@/modules/whatsapp/sendingWindow";
import { isOptOutReply } from "@/modules/whatsapp/transport";

// Numbers come off spreadsheets typed by many different hands.
describe("normalizePhone", () => {
  it("accepts the shapes an Indian number is written in", () => {
    for (const raw of ["9876543210", "+91 98765 43210", "098765 43210", "0091-9876543210", "+919876543210"]) {
      expect(normalizePhone(raw), raw).toMatchObject({ phone: "919876543210", ok: true });
    }
  });

  it("keeps an already-international number from another country", () => {
    expect(normalizePhone("+44 7700 900123")).toMatchObject({ phone: "447700900123", ok: true });
  });

  // Excel loves turning a phone column into a number and prefixing apostrophes.
  it("survives spreadsheet mangling", () => {
    expect(normalizePhone("'9876543210")).toMatchObject({ phone: "919876543210", ok: true });
    expect(normalizePhone(" 98765-43210 ")).toMatchObject({ phone: "919876543210", ok: true });
  });

  it("rejects what cannot be a phone number, with a reason", () => {
    expect(normalizePhone("").ok).toBe(false);
    expect(normalizePhone("n/a").ok).toBe(false);
    expect(normalizePhone("12345").ok).toBe(false);
    expect(normalizePhone("1234567890123456789").ok).toBe(false);
    expect(normalizePhone("12345").reason).toMatch(/short/i);
  });

  it("formats and addresses a stored number", () => {
    expect(formatPhone("919876543210")).toBe("+91 98765 43210");
    expect(toWhatsappId("919876543210")).toBe("919876543210@c.us");
  });
});

// Builds a real .xlsx in memory so the parser is exercised end to end.
async function sheet(rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Contacts");
  rows.forEach((row) => worksheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("parseContactSheet", () => {
  it("reads a normal export with headers", async () => {
    const file = await sheet([
      ["Name", "Mobile Number", "Email", "Group"],
      ["Anil Menon", "9876543210", "anil@test.dev", "walk-in"],
      ["Priya S", "+91 98000 11122", "", "walk-in"],
    ]);

    const parsed = await parseContactSheet(file);
    expect(parsed.contacts).toHaveLength(2);
    expect(parsed.contacts[0]).toEqual({
      name: "Anil Menon",
      phone: "919876543210",
      email: "anil@test.dev",
      tag: "walk-in",
    });
    expect(parsed.contacts[1].email).toBeUndefined();
  });

  // Column order is never the same twice between shops.
  it("matches columns by header name, not position", async () => {
    const file = await sheet([
      ["WhatsApp No.", "Customer Name"],
      ["9876543210", "Anil"],
    ]);
    expect((await parseContactSheet(file)).contacts[0]).toMatchObject({ name: "Anil", phone: "919876543210" });
  });

  // A hand-typed list often has no header row at all.
  it("falls back to name-then-phone when there is no header", async () => {
    const file = await sheet([
      ["Anil Menon", "9876543210"],
      ["Priya S", "9800011122"],
    ]);
    const parsed = await parseContactSheet(file);
    expect(parsed.contacts).toHaveLength(2);
    expect(parsed.contacts[0]).toMatchObject({ name: "Anil Menon", phone: "919876543210" });
  });

  it("reports bad rows instead of dropping them silently", async () => {
    const file = await sheet([
      ["Name", "Phone"],
      ["Good", "9876543210"],
      ["No phone", "n/a"],
      ["Too short", "12345"],
    ]);

    const parsed = await parseContactSheet(file);
    expect(parsed.contacts).toHaveLength(1);
    expect(parsed.problems).toHaveLength(2);
    expect(parsed.problems[0]).toMatchObject({ row: 3, value: "n/a" });
  });

  it("folds numbers repeated inside one file", async () => {
    const file = await sheet([
      ["Name", "Phone"],
      ["Anil", "9876543210"],
      ["Anil again", "+91 98765 43210"],
    ]);

    const parsed = await parseContactSheet(file);
    expect(parsed.contacts).toHaveLength(1);
    expect(parsed.duplicatesInFile).toBe(1);
  });

  it("skips blank padding rows and keeps a number with no name", async () => {
    const file = await sheet([["Name", "Phone"], ["Anil", "9876543210"], [], ["", "9800011122"]]);
    const parsed = await parseContactSheet(file);
    expect(parsed.contacts).toHaveLength(2);
    // A nameless row is still worth importing; the number stands in for a name.
    expect(parsed.contacts[1].name).toBe("919800011122");
  });

  it("refuses a file with nothing in it", async () => {
    await expect(parseContactSheet(await sheet([]))).rejects.toThrow(/no rows/i);
  });
});

describe("renderTemplate", () => {
  const values = { name: "Anil", business: "Spice Route", city: "Kozhikode", phone: "919876543210" };

  it("fills the placeholders a shop actually types", () => {
    expect(renderTemplate("Hi {{name}}, {{business}} in {{city}} has news!", values)).toBe(
      "Hi Anil, Spice Route in Kozhikode has news!",
    );
  });

  it("is forgiving about spacing and case", () => {
    expect(renderTemplate("Hi {{ Name }}", values)).toBe("Hi Anil");
  });

  // Blanking a typo would silently eat text; leaving it makes it visible in
  // the preview before anything is sent.
  it("leaves an unknown placeholder alone", () => {
    expect(renderTemplate("Hi {{nmae}}", values)).toBe("Hi {{nmae}}");
  });

  it("replaces every occurrence", () => {
    expect(renderTemplate("{{name}}, {{name}}", values)).toBe("Anil, Anil");
  });
});

// Regression: "WhatsApp No." matched nothing, so the parser silently fell back
// to positional mode and read a name-second sheet backwards.
describe("header spellings", () => {
  const cases: [string, string][] = [
    ["Mobile No.", "919876543210"],
    ["WhatsApp No.", "919876543210"],
    ["Phone Number", "919876543210"],
    ["Contact no", "919876543210"],
    ["MOBILE", "919876543210"],
    ["Cell Phone", "919876543210"],
    ["Number", "919876543210"],
  ];

  it.each(cases)("recognises %s as the phone column", async (header, expected) => {
    const file = await sheet([
      [header, "Customer Name"],
      ["9876543210", "Anil"],
    ]);
    const parsed = await parseContactSheet(file);
    expect(parsed.contacts[0]).toMatchObject({ name: "Anil", phone: expected });
  });
});

// A campaign of a few hundred at 8s apart runs for hours, so one started in
// the evening would otherwise still be going at 3am.
describe("sending window", () => {
  const at = (hour: number) => new Date(2026, 6, 27, hour, 30, 0);

  it("allows the hours inside a normal daytime window", () => {
    const window = { windowStartHour: 9, windowEndHour: 21 };
    expect(isWithinWindow(window, at(9))).toBe(true);
    expect(isWithinWindow(window, at(20))).toBe(true);
    expect(isWithinWindow(window, at(8))).toBe(false);
    expect(isWithinWindow(window, at(21))).toBe(false);
    expect(isWithinWindow(window, at(3))).toBe(false);
  });

  it("handles a window that wraps past midnight", () => {
    const window = { windowStartHour: 22, windowEndHour: 6 };
    expect(isWithinWindow(window, at(23))).toBe(true);
    expect(isWithinWindow(window, at(2))).toBe(true);
    expect(isWithinWindow(window, at(12))).toBe(false);
  });

  it("treats equal hours as no restriction", () => {
    const window = { windowStartHour: 0, windowEndHour: 0 };
    for (const hour of [0, 3, 12, 23]) expect(isWithinWindow(window, at(hour))).toBe(true);
  });

  it("reports nothing to wait while inside the window", () => {
    expect(msUntilWindowOpens({ windowStartHour: 9, windowEndHour: 21 }, at(10))).toBe(0);
  });

  it("waits until this morning's opening when the night is still young", () => {
    // 03:30, window opens at 09:00 — five and a half hours.
    const wait = msUntilWindowOpens({ windowStartHour: 9, windowEndHour: 21 }, at(3));
    expect(wait).toBe(5.5 * 60 * 60 * 1000);
  });

  it("rolls to tomorrow when today's opening has passed", () => {
    // 22:30, window opens at 09:00 — ten and a half hours away, not negative.
    const wait = msUntilWindowOpens({ windowStartHour: 9, windowEndHour: 21 }, at(22));
    expect(wait).toBe(10.5 * 60 * 60 * 1000);
  });

  it("describes the window the way the dashboard shows it", () => {
    expect(describeWindow({ windowStartHour: 9, windowEndHour: 21 })).toBe("9am – 9pm");
    expect(describeWindow({ windowStartHour: 0, windowEndHour: 12 })).toBe("12am – 12pm");
    expect(describeWindow({ windowStartHour: 8, windowEndHour: 8 })).toBe("any time");
  });
});

// Someone asking to be left alone should never have to guess the magic word.
describe("isOptOutReply", () => {
  it("catches the ways people actually ask to stop", () => {
    for (const reply of ["STOP", "stop", " Stop ", "unsubscribe", "UNSUB", "opt out", "optout", "remove me", "Don't message me"]) {
      expect(isOptOutReply(reply), reply).toBe(true);
    }
  });

  it("leaves ordinary replies alone", () => {
    for (const reply of ["thanks!", "what time do you open?", "stopped by yesterday", "I want to order", ""]) {
      expect(isOptOutReply(reply), reply).toBe(false);
    }
  });
});

// Handing people a correct file to start from only helps if that file
// actually imports — so the template is round-tripped through the parser.
describe("contact template", () => {
  it("parses cleanly through the importer it was built for", async () => {
    const buffer = await buildContactTemplate("Spice Route Kitchen");
    const parsed = await parseContactSheet(buffer);

    expect(parsed.problems).toEqual([]);
    expect(parsed.duplicatesInFile).toBe(0);
    expect(parsed.contacts).toHaveLength(3);
    // The three example rows deliberately use different phone shapes; all of
    // them must normalise to the same stored form.
    expect(parsed.contacts.map((c) => c.phone)).toEqual(["919876543210", "919800011122", "919876512345"]);
    expect(parsed.contacts[0]).toMatchObject({ name: "Anil Menon", email: "anil@example.com", tag: "regular" });
  });

  it("keeps the phone column as text so Excel cannot mangle it", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildContactTemplate("Test Shop")) as unknown as ArrayBuffer);
    expect(workbook.worksheets[0].getColumn(2).numFmt).toBe("@");
  });

  // The guidance sheet must not be the first one, or the importer would read
  // prose as contacts.
  it("puts the fillable sheet first and the guidance after it", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildContactTemplate("Test Shop")) as unknown as ArrayBuffer);
    expect(workbook.worksheets.map((w) => w.name)).toEqual(["Contacts", "How to use"]);
  });
});
