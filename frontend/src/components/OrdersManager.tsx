import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Phone, Receipt, Search, ShoppingBag, TrendingUp } from "lucide-react";
import { ordersApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Order, OrderStatus, OrderSummary, ORDER_FLOW, ORDER_STATUS_LABELS } from "@/types";
import { ListSkeleton } from "@/components/Loading";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PACKED: "bg-indigo-50 text-indigo-700",
  SHIPPED: "bg-violet-50 text-violet-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

const FILTERS: { value: OrderStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  ...ORDER_FLOW.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
  { value: "CANCELLED", label: "Cancelled" },
];

function money(cents: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${(cents / 100).toLocaleString("en-IN")}`;
}

// The step a shop would normally move this order to next, or null at the end
// of the line (delivered or cancelled).
function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = ORDER_FLOW.indexOf(status);
  if (index === -1 || index === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[index + 1];
}

/** Orders placed on the shop, with the whole fulfilment flow in one screen. */
export default function OrdersManager({ business }: { business: Business }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.list(business.id, {
        page,
        pageSize: PAGE_SIZE,
        ...(status ? { status } : {}),
        ...(appliedSearch ? { search: appliedSearch } : {}),
      });
      setOrders(res.data);
      setSummary(res.summary);
      setTotalPages(res.meta.totalPages);
      setTotal(res.meta.total);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [business.id, page, status, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setOrderStatus(order: Order, next: OrderStatus) {
    if (next === "CANCELLED" && !window.confirm(`Cancel order ${order.orderNumber}? Any counted stock goes back.`)) {
      return;
    }
    setBusyId(order.id);
    setError("");
    try {
      await ordersApi.setStatus(business.id, order.id, next);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <h3 className="flex items-center gap-1.5 font-bold text-ink-900">
          <ShoppingBag size={16} className="text-brand-600" /> Orders
        </h3>
        <p className="mt-0.5 text-xs text-ink-500">
          Every order placed on your shop page. Move an order along as you confirm, pack and deliver it.
        </p>

        {summary && (
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Stat label="Orders today" value={String(summary.todayCount)} icon={<Receipt size={14} />} />
            <Stat label="Total orders" value={String(summary.total)} icon={<ShoppingBag size={14} />} />
            <Stat
              label="Revenue"
              value={money(summary.revenueCents)}
              icon={<TrendingUp size={14} />}
              hint="Excludes cancelled"
            />
            <Stat label="Awaiting you" value={String(summary.byStatus.PENDING ?? 0)} icon={<Receipt size={14} />} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.value || "all"}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                status === filter.value ? "bg-brand-600 text-white" : "bg-gray-100 text-ink-600 hover:bg-gray-200"
              }`}
            >
              {filter.label}
              {filter.value && summary?.byStatus[filter.value] ? ` (${summary.byStatus[filter.value]})` : ""}
            </button>
          ))}
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
              placeholder="Order number, customer name or phone…"
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
        <ListSkeleton rows={4} />
      ) : orders.length === 0 ? (
        <div className="card p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <ShoppingBag size={22} />
          </span>
          <p className="mt-3 font-semibold text-ink-900">
            {status || appliedSearch ? "No orders match those filters" : "No orders yet"}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {status || appliedSearch
              ? "Try clearing the filters."
              : "Once your shop is open and a customer checks out, their order shows up here."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {orders.map((order) => {
              const open = expanded === order.id;
              const next = nextStatus(order.status);
              return (
                <div key={order.id} className="card overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 p-3.5">
                    <div className="min-w-[11rem] flex-1">
                      <p className="flex items-center gap-2 text-sm font-bold text-ink-900">
                        {order.orderNumber}
                        <span className={`badge ${STATUS_STYLES[order.status]}`}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {order.customerName} ·{" "}
                        <a href={`tel:${order.customerPhone}`} className="hover:text-brand-600">
                          {order.customerPhone}
                        </a>
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {new Date(order.placedAt).toLocaleString()} · {order.items.length} item
                        {order.items.length === 1 ? "" : "s"}
                      </p>
                    </div>

                    <p className="text-right text-sm font-bold text-ink-900">
                      {money(order.totalCents, order.currency)}
                    </p>

                    <div className="flex items-center gap-1.5">
                      {next && (
                        <button
                          onClick={() => setOrderStatus(order, next)}
                          disabled={busyId === order.id}
                          className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          Mark {ORDER_STATUS_LABELS[next].toLowerCase()}
                        </button>
                      )}
                      {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
                        <button
                          onClick={() => setOrderStatus(order, "CANCELLED")}
                          disabled={busyId === order.id}
                          className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => setExpanded(open ? null : order.id)}
                        className="rounded-lg p-2 text-ink-400 hover:bg-gray-100 hover:text-ink-700"
                        aria-label={open ? "Hide order details" : "Show order details"}
                      >
                        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div className="grid gap-4 border-t border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-ink-500">Items</h4>
                        <ul className="mt-2 space-y-2">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex items-center gap-2.5">
                              {item.imageUrl && (
                                <img src={item.imageUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
                              )}
                              <span className="flex-1 text-sm text-ink-800">
                                {item.quantity} × {item.name}
                              </span>
                              <span className="text-sm font-semibold text-ink-900">
                                {money(item.lineTotalCents, order.currency)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <dl className="mt-3 space-y-1 border-t border-gray-200 pt-2 text-sm">
                          <div className="flex justify-between text-ink-500">
                            <dt>Subtotal</dt>
                            <dd>{money(order.subtotalCents, order.currency)}</dd>
                          </div>
                          <div className="flex justify-between text-ink-500">
                            <dt>Delivery</dt>
                            <dd>
                              {order.deliveryFeeCents === 0 ? "Free" : money(order.deliveryFeeCents, order.currency)}
                            </dd>
                          </div>
                          <div className="flex justify-between font-bold text-ink-900">
                            <dt>Total ({order.paymentMethod === "COD" ? "cash on delivery" : "paid online"})</dt>
                            <dd>{money(order.totalCents, order.currency)}</dd>
                          </div>
                        </dl>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-ink-500">Deliver to</h4>
                        <p className="mt-2 text-sm text-ink-800">{order.customerName}</p>
                        <p className="text-sm text-ink-600">
                          {[order.addressLine1, order.addressLine2, order.city, order.postalCode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                        {order.customerEmail && <p className="mt-1 text-sm text-ink-600">{order.customerEmail}</p>}
                        {order.notes && (
                          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            <strong>Note:</strong> {order.notes}
                          </p>
                        )}
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="btn-secondary mt-3 inline-flex px-3 py-2 text-sm"
                        >
                          <Phone size={14} /> Call {order.customerPhone}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-500">
              {total} order{total === 1 ? "" : "s"}
            </p>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        <span className="text-brand-600">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-ink-900">{value}</p>
      {hint && <p className="text-[10px] text-ink-400">{hint}</p>}
    </div>
  );
}
