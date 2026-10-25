import { api, errorMessage } from "../lib/api";
import { $, $$, pageData } from "../lib/ui";

const biz = pageData("business-data");
const notice = $("[data-notice]");

function showNotice(text) {
  notice.textContent = text;
  notice.hidden = !text;
  if (text) notice.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Tabs: each section lists the tabs it belongs to. The chosen tab goes in
// the URL so a reload (or a reviews page link) keeps it.
function setTab(tab) {
  $$("[data-tab-link]").forEach((button) => {
    if (button.closest(".sticky") === null) return;
    const active = button.dataset.tabLink === tab;
    button.classList.toggle("border-brand-600", active);
    button.classList.toggle("text-brand-600", active);
    button.classList.toggle("border-transparent", !active);
    button.classList.toggle("text-ink-500", !active);
  });
  $$("[data-tabs]").forEach((section) => (section.hidden = !section.dataset.tabs.split(" ").includes(tab)));

  const url = new URL(window.location.href);
  if (tab === "Overview") url.searchParams.delete("tab");
  else url.searchParams.set("tab", tab);
  window.history.replaceState(null, "", url);
  $$("[data-pager] a").forEach((link) => {
    const href = new URL(link.href);
    if (tab === "Overview") href.searchParams.delete("tab");
    else href.searchParams.set("tab", tab);
    link.href = href.toString();
  });
}
$$("[data-tab-link]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tabLink)));

// "Open now / Closed" from today's hours, on the visitor's own clock.
(function openStatus() {
  const hours = biz.hours ?? [];
  const now = new Date();
  const today = hours.find((h) => h.dayOfWeek === now.getDay());
  if (!today) return;
  const toMin = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let status;
  if (today.isClosed) {
    status = { open: false, label: "Closed today", detail: "Opens as per weekly hours" };
  } else {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const open = toMin(today.openTime);
    const close = toMin(today.closeTime);
    if (nowMin >= open && nowMin < close) status = { open: true, label: "Open now", detail: `Closes at ${today.closeTime}` };
    else if (nowMin < open) status = { open: false, label: "Closed", detail: `Opens at ${today.openTime}` };
    else status = { open: false, label: "Closed", detail: "Opens tomorrow" };
  }
  const badge = $("[data-open-badge]");
  badge.classList.add(...(status.open ? ["bg-emerald-50", "text-emerald-700"] : ["bg-red-50", "text-red-600"]));
  $("span", badge).classList.add(status.open ? "bg-emerald-500" : "bg-red-500");
  $("[data-open-label]", badge).textContent = status.label;
  badge.hidden = false;
  const detail = $("[data-open-detail]");
  $("span", detail).textContent = status.detail;
  detail.hidden = false;
})();

$$("[data-show-number]").forEach((button) =>
  button.addEventListener("click", () => {
    $$("[data-show-number] span").forEach((span) => (span.textContent = biz.phone));
  }),
);

const bookmark = $("[data-bookmark]");
bookmark?.addEventListener("click", () => {
  const on = !bookmark.classList.contains("bg-brand-50");
  bookmark.title = on ? "Saved" : "Save";
  bookmark.classList.toggle("bg-brand-50", on);
  bookmark.classList.toggle("border-brand-200", on);
  bookmark.classList.toggle("text-brand-600", on);
  bookmark.classList.toggle("border-gray-300", !on);
  bookmark.classList.toggle("text-ink-500", !on);
  $("svg", bookmark).setAttribute("fill", on ? "currentColor" : "none");
});

async function share() {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: biz.name, url });
      return;
    } catch {
      // cancelled or unsupported — fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showNotice("Link copied to clipboard.");
  } catch {
    // no-op
  }
}
$$("[data-share]").forEach((button) => button.addEventListener("click", share));

const copyButton = $("[data-copy-address]");
copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(copyButton.dataset.copyAddress);
    $("span", copyButton).textContent = "Copied!";
    setTimeout(() => ($("span", copyButton).textContent = "Copy"), 1800);
  } catch {
    // clipboard blocked — no-op
  }
});

// Reviews: client-side ordering of the current page.
const reviewList = $("[data-review-list]");
$$("[data-review-sort] [data-sort]").forEach((button) =>
  button.addEventListener("click", () => {
    const key = button.dataset.sort;
    $$("[data-review-sort] [data-sort]").forEach((b) => {
      const active = b === button;
      b.classList.toggle("bg-brand-50", active);
      b.classList.toggle("border-brand-200", active);
      b.classList.toggle("text-brand-700", active);
      b.classList.toggle("border-gray-200", !active);
      b.classList.toggle("text-ink-600", !active);
    });
    const items = $$("[data-review]", reviewList);
    items.sort((a, b) => {
      if (key === "latest") return new Date(b.dataset.created) - new Date(a.dataset.created);
      if (key === "high") return Number(b.dataset.rating) - Number(a.dataset.rating);
      return Number(a.dataset.index) - Number(b.dataset.index);
    });
    items.forEach((item) => reviewList.appendChild(item));
  }),
);

// Star picker for the review composer.
const reviewForm = $("[data-review-form]");
if (reviewForm) {
  const ratingInput = $("[name=rating]", reviewForm);
  const paint = (value) =>
    $$("[data-star]", reviewForm).forEach((star) => {
      const on = Number(star.dataset.star) <= value;
      star.classList.toggle("text-gold-400", on);
      star.classList.toggle("text-gray-300", !on);
      const svg = $("svg", star);
      svg.setAttribute("fill", on ? "currentColor" : "none");
      svg.setAttribute("stroke-width", on ? "0" : "1.5");
    });
  $$("[data-star]", reviewForm).forEach((star) =>
    star.addEventListener("click", () => {
      ratingInput.value = star.dataset.star;
      paint(Number(star.dataset.star));
    }),
  );

  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(reviewForm));
    try {
      await api.post(`/businesses/${biz.id}/reviews`, {
        rating: Number(fields.rating),
        title: fields.title || undefined,
        comment: fields.comment || undefined,
      });
      // Reload on the first reviews page so the new review is visible.
      sessionStorage.setItem("business-notice", "Review submitted. Thank you!");
      window.location.href = `/business/${biz.slug}?tab=Reviews`;
    } catch (err) {
      showNotice(errorMessage(err));
    }
  });
}

const pendingNotice = sessionStorage.getItem("business-notice");
if (pendingNotice) {
  sessionStorage.removeItem("business-notice");
  showNotice(pendingNotice);
}

// Scroll the composer into view for a customer who scanned a review board.
if (biz.wantsReview) {
  setTimeout(() => $("[data-review-composer]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
}

$("[data-booking-form]")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const fields = Object.fromEntries(new FormData(form));
  try {
    await api.post(`/businesses/${biz.id}/bookings`, { serviceId: fields.serviceId, scheduledAt: fields.scheduledAt });
    showNotice("Booking request sent!");
    form.reset();
  } catch (err) {
    showNotice(errorMessage(err));
  }
});

$("[data-lead-form]")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const fields = Object.fromEntries(new FormData(form));
  try {
    await api.post(`/businesses/${biz.id}/leads`, { ...fields, source: "BUSINESS_PROFILE" });
    showNotice("Thanks! The business will contact you shortly.");
    form.reset();
  } catch (err) {
    showNotice(errorMessage(err));
  }
});
