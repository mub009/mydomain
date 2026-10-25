import { initAiDescription } from "../lib/ai-describe";
import { initAssistant } from "../lib/assistant";
import { api, errorMessage, uploadImage } from "../lib/api";
import { CHANNEL_LABELS, boardUrl, downloadDataUrl, renderQrDataUrl } from "../lib/channels";
import { $, $$, openModal, pageData } from "../lib/ui";
import { boardPreviewModal, initCloneButtons, initUploadFields, reloadWithFlash, showError, showFlash } from "../lib/widgets";

// Managing one business: each section is server-rendered; these handlers
// save through the API and reload so the page shows the saved state.

const biz = pageData("manage-data");
const base = `/businesses/${biz.id}`;
const errorBox = $("[data-error]");
const fail = (err) => showError(errorBox, errorMessage(err));

showFlash();
initUploadFields();
initAssistant(biz.id);
initCloneButtons();

// Runs an API call with the button showing a busy label.
async function busy(button, label, work) {
  const before = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.textContent = label;
  }
  try {
    return await work();
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = before;
    }
  }
}

$("[data-submit-approval]")?.addEventListener("click", async (e) => {
  // Dealers and admins publish straight away; owners wait for review.
  const publishes = "publishes" in e.currentTarget.dataset;
  try {
    await api.post(`${base}/submit`);
    reloadWithFlash(publishes ? "Published — the listing is live." : "Submitted for approval.");
  } catch (err) {
    fail(err);
  }
});

// --- Details ----------------------------------------------------------------
const details = $("[data-details-form]");
initAiDescription(details);
if (details) {
  const preview = $("[data-logo-preview]", details);
  const letter = $("[data-logo-letter]", details);
  const syncLogo = () => {
    const url = details.logoUrl.value.trim();
    preview.hidden = !url;
    letter.hidden = Boolean(url);
    if (url) {
      preview.style.visibility = "visible";
      preview.src = url;
    }
    letter.textContent = (details.name.value.trim()[0] ?? "?").toUpperCase();
  };
  preview.addEventListener("error", () => (preview.style.visibility = "hidden"));
  details.logoUrl.addEventListener("input", syncLogo);
  details.name.addEventListener("input", syncLogo);

  const detectButton = $("[data-detect-location]", details);
  const locationError = $("[data-location-error]", details);
  detectButton.addEventListener("click", () => {
    showError(locationError, "");
    if (!navigator.geolocation) return showError(locationError, "Geolocation isn't supported by this browser.");
    detectButton.disabled = true;
    $("span", detectButton).textContent = "Detecting…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        detectButton.disabled = false;
        $("span", detectButton).textContent = "Use my current location";
        details.latitude.value = String(position.coords.latitude);
        details.longitude.value = String(position.coords.longitude);
      },
      (err) => {
        detectButton.disabled = false;
        $("span", detectButton).textContent = "Use my current location";
        showError(locationError, err.code === err.PERMISSION_DENIED ? "Location access denied." : "Couldn't detect your location.");
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  });

  details.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(details));
    showError(errorBox, "");
    try {
      await busy($("[data-save]", details), "Saving…", () =>
        api.patch(base, {
          name: f.name,
          description: f.description,
          categoryId: f.categoryId,
          businessType: f.businessType,
          phone: f.phone,
          addressLine1: f.addressLine1,
          city: f.city,
          state: f.state,
          postalCode: f.postalCode,
          latitude: Number(f.latitude),
          longitude: Number(f.longitude),
          email: f.email || undefined,
          website: f.website || undefined,
          logoUrl: f.logoUrl || undefined,
          coverImageUrl: f.coverImageUrl || undefined,
          addressLine2: f.addressLine2 || undefined,
        }),
      );
      reloadWithFlash("Details saved.");
    } catch (err) {
      fail(err);
    }
  });
}

// --- Hours ------------------------------------------------------------------
const hoursForm = $("[data-hours-form]");
if (hoursForm) {
  $$("[data-day]", hoursForm).forEach((row) =>
    $("[data-closed]", row).addEventListener("change", (e) => ($("[data-times]", row).hidden = e.target.checked)),
  );
  hoursForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hours = $$("[data-day]", hoursForm).map((row) => ({
      dayOfWeek: Number(row.dataset.day),
      openTime: $("[data-open]", row).value,
      closeTime: $("[data-close]", row).value,
      isClosed: $("[data-closed]", row).checked,
    }));
    try {
      await busy($("[data-save]", hoursForm), "Saving…", () => api.put(`${base}/hours`, { hours }));
      reloadWithFlash("Opening hours saved.");
    } catch (err) {
      fail(err);
    }
  });
}

// --- Services ---------------------------------------------------------------
$("[data-service-form]")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.currentTarget));
  try {
    await api.post(`${base}/services`, {
      name: f.name,
      description: f.description || undefined,
      priceCents: Math.round(Number(f.price || 0) * 100),
      durationMins: Number(f.durationMins),
    });
    reloadWithFlash("Service added.");
  } catch (err) {
    fail(err);
  }
});
$$("[data-toggle-service]").forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      await api.patch(`${base}/services/${button.dataset.toggleService}`, { isActive: button.dataset.active !== "1" });
      window.location.reload();
    } catch (err) {
      fail(err);
    }
  }),
);
$$("[data-delete-service]").forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      await api.delete(`${base}/services/${button.dataset.deleteService}`);
      reloadWithFlash("Service removed.");
    } catch (err) {
      fail(err);
    }
  }),
);

// --- Photos -----------------------------------------------------------------
const photoForm = $("[data-photo-form]");
if (photoForm) {
  const add = $("[data-add-photo]", photoForm);
  photoForm.url.addEventListener("input", () => (add.disabled = !photoForm.url.value.trim()));
  photoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.post(`${base}/photos`, { url: photoForm.url.value, caption: photoForm.caption.value || undefined });
      reloadWithFlash("Photo added.");
    } catch (err) {
      fail(err);
    }
  });
}
$$("[data-delete-photo]").forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      await api.delete(`${base}/photos/${button.dataset.deletePhoto}`);
      window.location.reload();
    } catch (err) {
      fail(err);
    }
  }),
);

// --- Slider / Our Gallery ----------------------------------------------------
// The website's own photo sets. Every change saves the whole list straight
// away; the website picks it up on its next visit.
const imageSet = pageData("image-set-data");
if (imageSet) {
  const { kind, max } = imageSet;
  const images = [...imageSet.images];
  const where = kind === "slider" ? "your slider" : "your gallery";
  const save = async (message) => {
    try {
      await api.put(`${base}/site/${kind}`, { images });
      reloadWithFlash(message);
    } catch (err) {
      fail(err);
    }
  };

  $("[data-image-upload]")?.addEventListener("change", async (e) => {
    const files = [...e.target.files].slice(0, max - images.length);
    if (!files.length) return;
    const label = $("[data-image-label]");
    const drop = $("[data-image-drop]");
    drop.classList.add("pointer-events-none", "opacity-60");
    let added = 0;
    for (const [i, file] of files.entries()) {
      label.textContent = `Uploading ${i + 1} of ${files.length}…`;
      try {
        images.push(await uploadImage(file, `site-${kind}`));
        added += 1;
      } catch (err) {
        showError(errorBox, `${file.name}: ${errorMessage(err)}`);
      }
    }
    if (added) await save(`${added} photo${added === 1 ? "" : "s"} added to ${where}.`);
    else {
      label.textContent = "Upload photos";
      drop.classList.remove("pointer-events-none", "opacity-60");
    }
  });
  $$("[data-image-move]").forEach((button) =>
    button.addEventListener("click", () => {
      const from = Number(button.dataset.imageMove);
      const to = Number(button.dataset.to);
      [images[from], images[to]] = [images[to], images[from]];
      save("Order saved.");
    }),
  );
  $$("[data-image-remove]").forEach((button) =>
    button.addEventListener("click", () => {
      images.splice(Number(button.dataset.imageRemove), 1);
      save(`Photo removed from ${where}.`);
    }),
  );
}

// --- Reviews & QR -----------------------------------------------------------
$("[data-review-links-form]")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const f = Object.fromEntries(new FormData(form));
  try {
    await busy($("[data-save]", form), "Saving…", () =>
      api.patch(`${base}/review-links`, { ...f, preferredReviewChannel: f.preferredReviewChannel || null }),
    );
    reloadWithFlash("Review links saved. Your QR board is ready to print.");
  } catch (err) {
    fail(err);
  }
});

// Scannable thumbnails of the shop's boards.
$$("[data-board-thumb]").forEach((slot) =>
  renderQrDataUrl(boardUrl(slot.dataset.boardThumb), 160)
    .then((url) => (slot.outerHTML = `<img src="${url}" alt="QR code ${slot.dataset.boardThumb}" class="h-14 w-14" />`))
    .catch(() => undefined),
);
$$("[data-board-preview]").forEach((button) =>
  button.addEventListener("click", () => boardPreviewModal(button.dataset.boardPreview, biz.name, button.dataset.boardChannel || null)),
);
$$("[data-board-download]").forEach((button) =>
  button.addEventListener("click", async () => {
    const code = button.dataset.boardDownload;
    try {
      downloadDataUrl(await renderQrDataUrl(boardUrl(code)), `${code}-qr.png`);
    } catch {
      showError(errorBox, "Could not generate that QR image. Try the View option instead.");
    }
  }),
);
// Re-point an issued board at a different platform.
$$("[data-board-channel-select]").forEach((select) =>
  select.addEventListener("change", async () => {
    try {
      const { data: updated } = await api.patch(`${base}/qr-codes/${select.dataset.boardChannelSelect}`, { channel: select.value || null });
      reloadWithFlash(
        `${select.dataset.boardCode} now sends people to ${updated.channel ? CHANNEL_LABELS[updated.channel] : "your default channel"}.`,
      );
    } catch (err) {
      fail(err);
    }
  }),
);

// --- SEO --------------------------------------------------------------------
// Character counters and a live Google-result preview while typing; an
// empty box previews the text written from the listing.
const seoForm = $("[data-seo-form]");
if (seoForm) {
  const preview = {
    seoTitle: $("[data-preview-title]", seoForm),
    seoDescription: $("[data-preview-description]", seoForm),
  };
  const sync = () => {
    $$("[data-counter]", seoForm).forEach((counter) => {
      const length = seoForm[counter.dataset.counter].value.trim().length;
      const max = Number(counter.dataset.max);
      counter.textContent = `${length}/${max}`;
      counter.classList.toggle("text-red-600", length > max);
    });
    Object.entries(preview).forEach(([name, el]) => {
      el.textContent = seoForm[name].value.trim() || el.dataset.fallback;
    });
  };
  ["seoTitle", "seoDescription"].forEach((name) => seoForm[name].addEventListener("input", sync));
  sync();

  seoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(seoForm));
    showError(errorBox, "");
    try {
      await busy($("[data-save]", seoForm), "Saving…", () =>
        api.patch(base, {
          seoTitle: f.seoTitle.trim() || null,
          seoDescription: f.seoDescription.trim() || null,
          seoKeywords: f.seoKeywords.trim() || null,
        }),
      );
      reloadWithFlash("SEO saved.");
    } catch (err) {
      fail(err);
    }
  });
}

// --- Products ---------------------------------------------------------------
function openProductForm(product) {
  const template = $("#product-form-template");
  const modal = openModal(product ? `Edit ${product.name}` : "Add a product", template.innerHTML);
  const form = $("[data-product-form]", modal.body);
  initUploadFields(form);

  const stockField = $("[data-stock-field]", form);
  const trackStock = $("[data-track-stock]", form);
  const preview = $("[data-image-preview]", form);
  trackStock.addEventListener("change", () => (stockField.hidden = !trackStock.checked));
  const syncPreview = () => {
    const url = form.imageUrl.value.trim();
    preview.hidden = !url;
    if (url) preview.src = url;
  };
  preview.addEventListener("error", () => (preview.hidden = true));
  form.imageUrl.addEventListener("input", syncPreview);

  if (product) {
    form.name.value = product.name;
    form.description.value = product.description ?? "";
    form.price.value = String(product.priceCents / 100);
    form.compareAt.value = product.compareAtCents == null ? "" : String(product.compareAtCents / 100);
    form.imageUrl.value = product.imageUrl ?? "";
    form.sku.value = product.sku ?? "";
    trackStock.checked = product.trackStock;
    form.stock.value = String(product.stock);
    form.isActive.checked = product.isActive ?? true;
    stockField.hidden = !product.trackStock;
    $("[data-submit]", form).textContent = "Save changes";
    syncPreview();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.value.trim(),
      description: form.description.value.trim() || null,
      priceCents: Math.round(Number(form.price.value || 0) * 100),
      compareAtCents: form.compareAt.value.trim() === "" ? null : Math.round(Number(form.compareAt.value) * 100),
      imageUrl: form.imageUrl.value.trim() || null,
      sku: form.sku.value.trim() || null,
      trackStock: trackStock.checked,
      stock: Math.max(0, Math.round(Number(form.stock.value || 0))),
      isActive: form.isActive.checked,
    };
    const formError = $("[data-form-error]", form);
    showError(formError, "");
    try {
      await busy($("[data-submit]", form), "Saving…", () =>
        product ? api.patch(`${base}/products/${product.id}`, payload) : api.post(`${base}/products`, payload),
      );
      reloadWithFlash(
        product ? `Updated “${payload.name}”.` : `Added “${payload.name}” to your catalogue.`,
        product ? undefined : "?section=Products",
      );
    } catch (err) {
      showError(formError, errorMessage(err));
    }
  });
}
$$("[data-product-create]").forEach((button) => button.addEventListener("click", () => openProductForm(null)));
$$("[data-product-edit]").forEach((button) =>
  button.addEventListener("click", () => openProductForm(JSON.parse(button.dataset.productEdit))),
);
// Quick on/off without opening the form — the switch shops reach for most.
$$("[data-product-toggle]").forEach((button) =>
  button.addEventListener("click", async () => {
    try {
      await api.patch(`${base}/products/${button.dataset.productToggle}`, { isActive: button.dataset.active !== "1" });
      window.location.reload();
    } catch (err) {
      fail(err);
    }
  }),
);
$$("[data-product-delete]").forEach((button) =>
  button.addEventListener("click", () => {
    const name = button.dataset.name;
    const modal = openModal(
      "Remove product",
      `<p class="text-sm text-ink-700">Remove “${name.replace(/</g, "&lt;")}” from your catalogue? Past orders keep their details.</p>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" data-close class="btn-secondary px-4 py-2 text-sm">Keep it</button>
        <button type="button" data-confirm class="btn-primary !bg-red-600 hover:!bg-red-700 px-4 py-2 text-sm">Remove</button>
      </div>`,
    );
    $("[data-confirm]", modal.body).addEventListener("click", async () => {
      try {
        await api.delete(`${base}/products/${button.dataset.productDelete}`);
        reloadWithFlash(`Removed “${name}”.`);
      } catch (err) {
        modal.close();
        fail(err);
      }
    });
  }),
);

// --- Orders -----------------------------------------------------------------
$$("[data-order-expand]").forEach((button) =>
  button.addEventListener("click", () => {
    const details = $(`[data-order-details="${button.dataset.orderExpand}"]`);
    details.hidden = !details.hidden;
    $('[data-when="closed"]', button).hidden = !details.hidden;
    $('[data-when="open"]', button).hidden = details.hidden;
    button.setAttribute("aria-label", details.hidden ? "Show order details" : "Hide order details");
  }),
);

async function setOrderStatus(button) {
  const orderId = button.dataset.order;
  const buttons = $$(`[data-order="${orderId}"]`);
  buttons.forEach((b) => (b.disabled = true));
  showError(errorBox, "");
  try {
    await api.patch(`${base}/orders/${orderId}/status`, { status: button.dataset.orderStatus });
    window.location.reload();
  } catch (err) {
    buttons.forEach((b) => (b.disabled = false));
    fail(err);
  }
}
$$("[data-order-status]").forEach((button) =>
  button.addEventListener("click", () => {
    if (button.dataset.orderStatus !== "CANCELLED") return setOrderStatus(button);
    const modal = openModal(
      "Cancel order",
      `<p class="text-sm text-ink-700">Cancel order ${button.dataset.number}? Any counted stock goes back.</p>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" data-close class="btn-secondary px-4 py-2 text-sm">Keep order</button>
        <button type="button" data-confirm class="btn-primary !bg-red-600 hover:!bg-red-700 px-4 py-2 text-sm">Cancel order</button>
      </div>`,
    );
    $("[data-confirm]", modal.body).addEventListener("click", () => {
      modal.close();
      setOrderStatus(button);
    });
  }),
);

// --- Customers --------------------------------------------------------------
function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Walks every page so the download is the whole list, not just what is on
// screen — a shop exporting its customers wants all of them.
const exportButton = $("[data-export-customers]");
exportButton?.addEventListener("click", async () => {
  exportButton.disabled = true;
  $("span", exportButton).textContent = "Preparing…";
  showError(errorBox, "");
  try {
    const rows = [];
    let current = 1;
    let pages = 1;
    do {
      const res = await api.get(`${base}/customers`, { page: current, pageSize: 50 });
      rows.push(...res.data);
      pages = res.meta.totalPages;
      current += 1;
    } while (current <= pages);

    const header = ["Name", "Phone", "Email", "City", "Address", "Orders", "Total spent", "First order", "Last order"];
    const body = rows.map((c) =>
      [
        c.name,
        c.phone,
        c.email ?? "",
        c.city,
        c.address,
        c.orderCount,
        (c.totalSpentCents / 100).toFixed(2),
        new Date(c.firstOrderAt).toLocaleDateString(),
        new Date(c.lastOrderAt).toLocaleDateString(),
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${biz.slug}-customers.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    fail(err);
  } finally {
    exportButton.disabled = false;
    $("span", exportButton).textContent = "Export CSV";
  }
});
