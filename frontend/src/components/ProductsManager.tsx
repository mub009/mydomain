import { useCallback, useEffect, useState } from "react";
import { ImageOff, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { productsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Product } from "@/types";
import { ListSkeleton } from "@/components/Loading";
import Modal from "@/components/Modal";
import Pagination from "@/components/Pagination";
import ImageUploadField from "@/components/ImageUploadField";

const PAGE_SIZE = 10;

function money(cents: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${(cents / 100).toLocaleString("en-IN")}`;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  compareAt: "",
  imageUrl: "",
  sku: "",
  trackStock: false,
  stock: "0",
  isActive: true,
};

type FormState = typeof EMPTY_FORM;

function formFor(product: Product): FormState {
  return {
    name: product.name,
    description: product.description ?? "",
    price: String(product.priceCents / 100),
    compareAt: product.compareAtCents == null ? "" : String(product.compareAtCents / 100),
    imageUrl: product.imageUrl ?? "",
    sku: product.sku ?? "",
    trackStock: product.trackStock,
    stock: String(product.stock),
    isActive: product.isActive ?? true,
  };
}

/** The shop's catalogue: what customers can put in their cart. */
export default function ProductsManager({ business }: { business: Business }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.list(business.id, {
        page,
        pageSize: PAGE_SIZE,
        ...(appliedSearch ? { search: appliedSearch } : {}),
      });
      setProducts(res.data);
      setTotalPages(res.meta.totalPages);
      setTotal(res.meta.total);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [business.id, page, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditing(null);
    setCreating(true);
  }

  function openEdit(product: Product) {
    setForm(formFor(product));
    setFormError("");
    setCreating(false);
    setEditing(product);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priceCents: Math.round(Number(form.price || 0) * 100),
      compareAtCents: form.compareAt.trim() === "" ? null : Math.round(Number(form.compareAt) * 100),
      imageUrl: form.imageUrl.trim() || null,
      sku: form.sku.trim() || null,
      trackStock: form.trackStock,
      stock: Math.max(0, Math.round(Number(form.stock || 0))),
      isActive: form.isActive,
    };

    try {
      if (editing) {
        await productsApi.update(business.id, editing.id, payload);
        setNotice(`Updated “${payload.name}”.`);
      } else {
        await productsApi.create(business.id, payload);
        setNotice(`Added “${payload.name}” to your catalogue.`);
        setPage(1);
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(product: Product) {
    if (!window.confirm(`Remove “${product.name}” from your catalogue? Past orders keep their details.`)) return;
    try {
      await productsApi.remove(business.id, product.id);
      setNotice(`Removed “${product.name}”.`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  // Quick on/off without opening the form — the switch shops reach for most.
  async function toggleActive(product: Product) {
    try {
      await productsApi.update(business.id, product.id, { isActive: !product.isActive });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-bold text-ink-900">
              <Package size={16} className="text-brand-600" /> Products
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">
              What customers can buy on your shop page. Switch a product off to hide it without deleting it.
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary px-3 py-2 text-sm">
            <Plus size={15} /> Add product
          </button>
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(search.trim());
          }}
        >
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search your products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-secondary px-4 py-2 text-sm">Search</button>
          {appliedSearch && (
            <button
              type="button"
              className="btn-ghost px-3 py-2 text-sm"
              onClick={() => {
                setSearch("");
                setAppliedSearch("");
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </form>

        {notice && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : products.length === 0 ? (
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Package size={22} />
          </span>
          <p className="mt-3 font-semibold text-ink-900">
            {appliedSearch ? "No products matched that search" : "No products yet"}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {appliedSearch
              ? "Try a different word, or clear the search."
              : "Add your first product and it will appear on your shop page straight away."}
          </p>
          {!appliedSearch && (
            <button onClick={openCreate} className="btn-primary mt-4 px-4 py-2 text-sm">
              <Plus size={15} /> Add your first product
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="card divide-y divide-gray-100">
            {products.map((product) => (
              <div key={product.id} className="flex flex-wrap items-center gap-3 p-3.5">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt=""
                    className="h-14 w-14 flex-none rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                    <ImageOff size={18} />
                  </span>
                )}

                <div className="min-w-[10rem] flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                    {product.name}
                    {!product.isActive && (
                      <span className="badge bg-gray-100 text-gray-600">Hidden</span>
                    )}
                    {product.trackStock && product.stock <= 0 && (
                      <span className="badge bg-red-50 text-red-700">Sold out</span>
                    )}
                  </p>
                  {product.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{product.description}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-400">
                    {product.trackStock ? `${product.stock} in stock` : "Stock not tracked"}
                    {product.sku ? ` · SKU ${product.sku}` : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-ink-900">{money(product.priceCents, product.currency)}</p>
                  {product.compareAtCents != null && product.compareAtCents > product.priceCents && (
                    <p className="text-xs text-ink-400 line-through">
                      {money(product.compareAtCents, product.currency)}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleActive(product)}
                    className="btn-secondary px-2.5 py-1.5 text-xs"
                    title={product.isActive ? "Hide from your shop" : "Show on your shop"}
                  >
                    {product.isActive ? "Hide" : "Show"}
                  </button>
                  <button onClick={() => openEdit(product)} className="btn-secondary px-2.5 py-1.5 text-xs">
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    onClick={() => remove(product)}
                    className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${product.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-500">
              {total} product{total === 1 ? "" : "s"}
            </p>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}

      {(creating || editing) && (
        <Modal title={editing ? `Edit ${editing.name}` : "Add a product"} onClose={closeForm}>
          <form onSubmit={submit} className="space-y-3 px-5 py-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-700">Product name *</span>
              <input
                required
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-700">Description</span>
              <textarea
                rows={2}
                className="input"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-700">Price (₹) *</span>
                <input
                  required
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-700">Was (₹)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="input"
                  placeholder="Optional"
                  value={form.compareAt}
                  onChange={(e) => setForm((f) => ({ ...f, compareAt: e.target.value }))}
                />
                <span className="mt-1 block text-[11px] text-ink-400">
                  Shown struck through next to the price. Must be higher than the price.
                </span>
              </label>
            </div>

            <ImageUploadField
              label="Image"
              purpose="products"
              value={form.imageUrl}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
            />

            {form.imageUrl.trim() && (
              <img
                src={form.imageUrl}
                alt=""
                className="h-24 w-24 rounded-lg border border-gray-200 object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-700">SKU / item code</span>
              <input
                className="input"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </label>

            <div className="rounded-lg bg-gray-50 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                <input
                  type="checkbox"
                  checked={form.trackStock}
                  onChange={(e) => setForm((f) => ({ ...f, trackStock: e.target.checked }))}
                />
                Count stock for this product
              </label>
              <p className="mt-1 text-[11px] text-ink-500">
                Leave off if you always have it available. When on, customers cannot order more than you have left.
              </p>
              {form.trackStock && (
                <label className="mt-2 block">
                  <span className="mb-1 block text-xs font-semibold text-ink-700">Units in stock</span>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                  />
                </label>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-ink-800">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Show this product on my shop
            </label>

            {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={closeForm} className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
