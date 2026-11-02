import { api, errorMessage } from "../lib/api";
import { initSearchableSelects } from "../lib/searchable-select";
import { $, $$, esc, openModal } from "../lib/ui";
import { reloadWithFlash, showError } from "../lib/widgets";

// The admin console's "Card Templates" tab (pages/admin/tabs/card-templates.blade.php).

const root = $("[data-card-templates]");
const errorBox = $("[data-error]");
const fail = (err) => showError(errorBox, errorMessage(err));

if (root) {
  initSearchableSelects(root);

  $("[data-install-starters]", root)?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      const { data } = await api.post("/admin/card-templates/starter");
      reloadWithFlash(data.added ? `Added ${data.added} starter designs.` : "All starter designs are already installed.");
    } catch (err) {
      e.currentTarget.disabled = false;
      fail(err);
    }
  });

  $$("[data-template-row]", root).forEach((row) => {
    const id = row.dataset.templateRow;

    $$("[data-toggle]", row).forEach((btn) =>
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await api.patch(`/admin/card-templates/${id}`, { [btn.dataset.toggle]: btn.dataset.value === "1" });
          reloadWithFlash("Template updated.");
        } catch (err) {
          btn.disabled = false;
          fail(err);
        }
      }),
    );

    $("[data-duplicate]", row)?.addEventListener("click", async () => {
      try {
        const { data } = await api.post(`/admin/card-templates/${id}/duplicate`);
        reloadWithFlash("Copy made. It stays inactive until you activate it.", `/admin/card-templates/${data.id}`);
      } catch (err) {
        fail(err);
      }
    });

    $("[data-delete]", row)?.addEventListener("click", (e) => {
      const { name, used } = e.currentTarget.dataset;
      const modal = openModal(
        "Delete template",
        `<p class="text-sm text-ink-700">Delete <strong>${esc(name)}</strong>?
          ${Number(used) > 0 ? `${esc(used)} card(s) use it — they switch to their category's default design.` : ""}</p>
         <div class="mt-4 flex justify-end gap-2">
           <button type="button" class="btn-secondary px-4 py-2 text-sm" data-close>Cancel</button>
           <button type="button" class="btn-primary !bg-red-600 px-4 py-2 text-sm" data-confirm>Delete</button>
         </div>`,
      );
      $("[data-confirm]", modal.body).addEventListener("click", async () => {
        try {
          await api.delete(`/admin/card-templates/${id}`);
          reloadWithFlash("Template deleted.");
        } catch (err) {
          modal.close();
          fail(err);
        }
      });
    });
  });
}
