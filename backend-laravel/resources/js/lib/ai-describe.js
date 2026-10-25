import { api, errorMessage } from "./api";
import { $ } from "./ui";

// Written-for-you descriptions on the listing forms. The form holds a
// <div data-ai-description> around its description box
// (see the Add business and Contact forms). As soon as the business has a
// name and a category, an empty description is filled in by
// POST /ai/business-description; "Write with AI" rewrites it on demand.
// A description the owner has typed themselves is never replaced without
// them asking, and a rewrite can be undone.
export function initAiDescription(form) {
  const wrap = form && $("[data-ai-description]", form);
  if (!wrap) return;

  // By name through .elements: form.name would clash with the form's own
  // name attribute.
  const field = (name) => form.elements.namedItem(name);
  const box = field("description");
  const button = $("[data-ai-write]", wrap);
  const status = $("[data-ai-status]", wrap);
  let aiText = ""; // what the AI last wrote, to tell it apart from the owner's own words
  let request = 0;

  const brief = () => {
    const category = field("categoryId");
    return {
      name: field("name").value.trim(),
      categoryId: category.value || undefined,
      category: category.value ? category.options[category.selectedIndex].text : undefined,
      city: field("city")?.value.trim() || undefined,
      businessType: field("businessType")?.value || undefined,
    };
  };
  const ready = () => {
    const { name, categoryId } = brief();
    return name.length >= 2 && Boolean(categoryId);
  };
  const ownWords = () => box.value.trim() !== "" && box.value !== aiText;

  const show = (text, tone = "muted", undo = null) => {
    status.hidden = !text;
    status.className = `mt-1 text-[11px] ${tone === "error" ? "text-red-600" : "text-ink-500"}`;
    status.textContent = text;
    if (undo) {
      const link = document.createElement("button");
      link.type = "button";
      link.className = "ml-1 font-semibold text-brand-600 hover:underline";
      link.textContent = "Undo";
      link.addEventListener("click", () => {
        box.value = undo;
        aiText = "";
        show("");
      });
      status.append(link);
    }
  };

  async function write() {
    if (!ready()) {
      show("Enter the business name and choose a category first.", "error");
      return;
    }
    const mine = ++request;
    const before = box.value;
    box.readOnly = true;
    if (button) button.disabled = true;
    show("✨ Writing a description…");
    try {
      const { data } = await api.post("/ai/business-description", brief());
      if (mine !== request) return; // a newer request has taken over
      // The owner may have started typing while it was writing; keep that.
      if (box.value !== before) {
        show("");
        return;
      }
      box.value = aiText = data.description;
      show(
        data.source === "builtin"
          ? "Suggested from your business details — edit it to make it your own."
          : "Written by AI — check it and edit anything that isn't right.",
        "muted",
        before.trim() ? before : null,
      );
    } catch (err) {
      if (mine === request) show(errorMessage(err), "error");
    } finally {
      if (mine === request) {
        box.readOnly = false;
        if (button) button.disabled = false;
      }
    }
  }

  // Fill in automatically once there is enough to go on, and again if the
  // name or category changes while the text is still the AI's.
  let timer = null;
  const autoWrite = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (ready() && !ownWords()) write();
    }, 700);
  };
  field("name").addEventListener("change", autoWrite);
  field("categoryId").addEventListener("change", autoWrite);
  box.addEventListener("input", () => {
    if (box.value !== aiText) show("");
  });
  button?.addEventListener("click", write);
}
