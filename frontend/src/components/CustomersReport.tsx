import { useCallback, useEffect, useState } from "react";
import { Download, Mail, Phone, Search, Users } from "lucide-react";
import { ordersApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, ShopCustomer, ORDER_STATUS_LABELS } from "@/types";
import { ListSkeleton } from "@/components/Loading";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 20;

function money(cents: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${(cents / 100).toLocaleString("en-IN")}`;
}

function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Who buys from this shop. Guests never create an account, so rows are grouped
 * by phone number — the one identity every order carries.
 */
export default function CustomersReport({ business }: { business: Business }) {
  const [customers, setCustomers] = useState<ShopCustomer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.customers(business.id, {
        page,
        pageSize: PAGE_SIZE,
        ...(appliedSearch ? { search: appliedSearch } : {}),
      });
      setCustomers(res.data);
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

  // Walks every page so the download is the whole list, not just what is on
  // screen — a shop exporting its customers wants all of them.
  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      const rows: ShopCustomer[] = [];
      let current = 1;
      let pages = 1;
      do {
        const res = await ordersApi.customers(business.id, { page: current, pageSize: 50 });
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
      link.download = `${business.slug}-customers.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 font-bold text-ink-900">
              <Users size={16} className="text-brand-600" /> Customers
            </h3>
            <p className="mt-0.5 text-xs text-ink-500">
              Everyone who has ordered from your shop, with what they have spent. Sorted by biggest spender first.
            </p>
          </div>
          <button
            onClick={exportCsv}
            disabled={exporting || total === 0}
            className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
          >
            <Download size={14} /> {exporting ? "Preparing…" : "Export CSV"}
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
              placeholder="Search by name or phone…"
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

        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : customers.length === 0 ? (
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Users size={22} />
          </span>
          <p className="mt-3 font-semibold text-ink-900">
            {appliedSearch ? "Nobody matched that search" : "No customers yet"}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {appliedSearch
              ? "Try a different name or phone number."
              : "As soon as someone orders from your shop, they appear here."}
          </p>
        </div>
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Where</th>
                  <th className="px-4 py-3 text-right font-semibold">Orders</th>
                  <th className="px-4 py-3 text-right font-semibold">Total spent</th>
                  <th className="px-4 py-3 font-semibold">Last order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer) => (
                  <tr key={customer.phone} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{customer.name || "—"}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                        <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                          <Phone size={11} /> {customer.phone}
                        </a>
                        {customer.email && (
                          <a
                            href={`mailto:${customer.email}`}
                            className="inline-flex items-center gap-1 hover:text-brand-600"
                          >
                            <Mail size={11} /> {customer.email}
                          </a>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      <p>{customer.city || "—"}</p>
                      {customer.address && <p className="text-xs text-ink-400">{customer.address}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-900">{customer.orderCount}</td>
                    <td className="px-4 py-3 text-right font-bold text-ink-900">
                      {money(customer.totalSpentCents, customer.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink-700">{new Date(customer.lastOrderAt).toLocaleDateString()}</p>
                      <p className="text-xs text-ink-400">
                        {customer.lastOrderNumber}
                        {customer.lastOrderStatus ? ` · ${ORDER_STATUS_LABELS[customer.lastOrderStatus]}` : ""}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-500">
              {total} customer{total === 1 ? "" : "s"}
            </p>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
