import { OrderStatus, Prisma, SiteType, UserRole } from "@prisma/client";
import { prisma } from "@/config/database";
import { AppError } from "@/common/errors";
import { parsePagination } from "@/common/pagination";
import { logger } from "@/config/logger";
import { sendMail } from "@/common/mailer";

interface Actor {
  sub: string;
  role: UserRole;
}

function assertOwnerOrAdmin(actor: Actor, ownerId: string): void {
  if (actor.role === UserRole.ADMIN) return;
  if (actor.sub !== ownerId) throw AppError.forbidden("You do not own this business");
}

async function ownedBusiness(actor: Actor, businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw AppError.notFound("Business not found");
  assertOwnerOrAdmin(actor, business.ownerId);
  return business;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 140) || "item"
  );
}

// Slugs are unique per shop, so two products called "Masala Dosa" in the same
// catalogue get -2, -3 and so on rather than colliding.
async function uniqueSlug(businessId: string, name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await prisma.product.findFirst({
      where: { businessId, slug: candidate, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export interface ProductInput {
  name: string;
  description?: string | null;
  priceCents: number;
  compareAtCents?: number | null;
  currency?: string;
  imageUrl?: string | null;
  sku?: string | null;
  trackStock?: boolean;
  stock?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export async function listProducts(
  actor: Actor,
  businessId: string,
  query: { search?: string; page?: number; pageSize?: number; includeInactive?: boolean },
) {
  await ownedBusiness(actor, businessId);
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.ProductWhereInput = {
    businessId,
    ...(query.includeInactive === false ? { isActive: true } : {}),
    ...(query.search ? { name: { contains: query.search } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    prisma.product.count({ where }),
  ]);

  return { items, meta: { page, pageSize, total } };
}

export async function createProduct(actor: Actor, businessId: string, data: ProductInput) {
  await ownedBusiness(actor, businessId);
  assertPricing(data);

  return prisma.product.create({
    data: {
      businessId,
      slug: await uniqueSlug(businessId, data.name),
      name: data.name,
      description: data.description ?? null,
      priceCents: data.priceCents,
      compareAtCents: data.compareAtCents ?? null,
      currency: data.currency ?? "INR",
      imageUrl: data.imageUrl ?? null,
      sku: data.sku ?? null,
      trackStock: data.trackStock ?? false,
      stock: data.stock ?? 0,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateProduct(actor: Actor, productId: string, data: Partial<ProductInput>) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { business: true } });
  if (!product) throw AppError.notFound("Product not found");
  assertOwnerOrAdmin(actor, product.business.ownerId);
  assertPricing({ ...product, ...data });

  return prisma.product.update({
    where: { id: productId },
    data: {
      ...data,
      // Keep the slug in step with a renamed product so its link stays readable.
      ...(data.name && data.name !== product.name
        ? { slug: await uniqueSlug(product.businessId, data.name, productId) }
        : {}),
    },
  });
}

export async function deleteProduct(actor: Actor, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { business: true } });
  if (!product) throw AppError.notFound("Product not found");
  assertOwnerOrAdmin(actor, product.business.ownerId);

  // Order items keep a snapshot of what was bought, so removing a product from
  // the catalogue never rewrites what a customer was charged.
  await prisma.product.delete({ where: { id: productId } });
  return { id: productId };
}

function assertPricing(data: { priceCents?: number; compareAtCents?: number | null }): void {
  if (data.priceCents != null && data.priceCents < 0) throw AppError.badRequest("Price cannot be negative");
  if (data.compareAtCents != null && data.priceCents != null && data.compareAtCents <= data.priceCents) {
    throw AppError.badRequest("The compare-at price must be higher than the selling price");
  }
}

// ---------------------------------------------------------------------------
// Public catalogue (what shoppers see)
// ---------------------------------------------------------------------------

export async function listPublicProducts(slug: string, query: { search?: string; page?: number; pageSize?: number }) {
  const site = await prisma.businessSite.findFirst({
    where: { business: { slug }, isPublished: true, siteType: SiteType.ECOMMERCE },
    select: { businessId: true },
  });
  if (!site) throw AppError.notFound("This shop is not open for orders");

  const { page, pageSize, skip, take } = parsePagination(query);
  const where: Prisma.ProductWhereInput = {
    businessId: site.businessId,
    isActive: true,
    ...(query.search ? { name: { contains: query.search } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        priceCents: true,
        compareAtCents: true,
        currency: true,
        imageUrl: true,
        trackStock: true,
        stock: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { items, meta: { page, pageSize, total } };
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export interface CheckoutInput {
  items: { productId: string; quantity: number }[];
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode?: string;
  notes?: string;
}

// Human-friendly and hard to guess by counting: MK-<base36 time>-<random>.
function makeOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `MK-${stamp}-${rand}`;
}

/**
 * Places an order against a published storefront. Prices, availability and
 * totals are all recomputed here — the basket the browser posts is only a list
 * of product ids and quantities, so a tampered cart cannot change what is
 * charged.
 */
export async function placeOrder(slug: string, customerId: string | undefined, input: CheckoutInput) {
  const business = await prisma.business.findUnique({
    where: { slug },
    select: { id: true, name: true, email: true, ownerId: true, site: true },
  });
  if (!business) throw AppError.notFound("Shop not found");

  const site = business.site;
  if (!site || !site.isPublished || site.siteType !== SiteType.ECOMMERCE) {
    throw AppError.badRequest("This shop is not open for orders");
  }
  if (input.items.length === 0) throw AppError.badRequest("Your cart is empty");

  // Fold duplicate lines so "add to cart" twice is one line of quantity 2.
  const wanted = new Map<string, number>();
  for (const line of input.items) {
    if (line.quantity < 1) throw AppError.badRequest("Quantity must be at least 1");
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: [...wanted.keys()] }, businessId: business.id, isActive: true },
  });
  if (products.length !== wanted.size) {
    throw AppError.badRequest("Some items are no longer available. Please review your cart.");
  }

  const lines = products.map((product) => {
    const quantity = wanted.get(product.id) as number;
    if (product.trackStock && product.stock < quantity) {
      throw AppError.badRequest(
        product.stock > 0
          ? `Only ${product.stock} left of "${product.name}"`
          : `"${product.name}" is out of stock`,
      );
    }
    return {
      productId: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      unitPriceCents: product.priceCents,
      quantity,
      lineTotalCents: product.priceCents * quantity,
    };
  });

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const qualifiesForFreeDelivery =
    site.freeDeliveryAboveCents != null && subtotalCents >= site.freeDeliveryAboveCents;
  const deliveryFeeCents = qualifiesForFreeDelivery ? 0 : site.deliveryFeeCents;
  const currency = products[0]?.currency ?? "INR";

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        businessId: business.id,
        orderNumber: makeOrderNumber(),
        customerId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        city: input.city,
        postalCode: input.postalCode ?? null,
        notes: input.notes ?? null,
        subtotalCents,
        deliveryFeeCents,
        totalCents: subtotalCents + deliveryFeeCents,
        currency,
        items: { create: lines },
      },
      include: { items: true },
    });

    // Only shops that actually count stock have it decremented.
    for (const line of lines) {
      const product = products.find((p) => p.id === line.productId);
      if (product?.trackStock) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        });
      }
    }

    return created;
  });

  notifyNewOrder(business, order).catch((err) => logger.error({ err }, "order notification failed"));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotalCents: order.subtotalCents,
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: order.totalCents,
    currency: order.currency,
    placedAt: order.placedAt,
    items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, lineTotalCents: i.lineTotalCents })),
  };
}

function money(cents: number, currency: string): string {
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${(cents / 100).toLocaleString("en-IN")}`;
}

// Tells the shop an order came in, and gives the customer their reference.
async function notifyNewOrder(
  business: { id: string; name: string; email: string | null; ownerId: string },
  order: { orderNumber: string; totalCents: number; currency: string; customerName: string; customerPhone: string; items: { name: string; quantity: number }[] },
): Promise<void> {
  // Nothing to send to when the listing has no contact address on file.
  if (!business.email) return;

  const list = order.items.map((i) => `  ${i.quantity} × ${i.name}`).join("\n");
  const total = money(order.totalCents, order.currency);

  sendMail({
    to: business.email,
    userId: business.ownerId,
    subject: `New order ${order.orderNumber} — ${total}`,
    text: `You have a new order on ${business.name}.

Order: ${order.orderNumber}
Customer: ${order.customerName} (${order.customerPhone})
Total: ${total}

Items:
${list}

Open your dashboard to confirm it.`,
  });
}

// ---------------------------------------------------------------------------
// Orders (business dashboard)
// ---------------------------------------------------------------------------

export async function listOrders(
  actor: Actor,
  businessId: string,
  query: { status?: OrderStatus; search?: string; page?: number; pageSize?: number },
) {
  await ownedBusiness(actor, businessId);
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.OrderWhereInput = {
    businessId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { orderNumber: { contains: query.search } },
            { customerName: { contains: query.search } },
            { customerPhone: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [items, total, summary] = await Promise.all([
    prisma.order.findMany({ where, skip, take, orderBy: { placedAt: "desc" }, include: { items: true } }),
    prisma.order.count({ where }),
    orderSummary(businessId),
  ]);

  return { items, meta: { page, pageSize, total }, summary };
}

// Headline numbers for the dashboard. Cancelled orders are excluded from
// revenue — they were never earned.
async function orderSummary(businessId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [byStatus, total, earned, today] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { businessId }, _count: { _all: true } }),
    prisma.order.count({ where: { businessId } }),
    prisma.order.aggregate({
      where: { businessId, status: { not: OrderStatus.CANCELLED } },
      _sum: { totalCents: true },
    }),
    prisma.order.count({ where: { businessId, placedAt: { gte: startOfToday } } }),
  ]);

  return {
    total,
    revenueCents: earned._sum.totalCents ?? 0,
    todayCount: today,
    byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Record<string, number>,
  };
}

export async function getOrder(actor: Actor, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, business: { select: { ownerId: true, name: true } } },
  });
  if (!order) throw AppError.notFound("Order not found");
  assertOwnerOrAdmin(actor, order.business.ownerId);
  return order;
}

export async function updateOrderStatus(actor: Actor, orderId: string, status: OrderStatus) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, business: { select: { ownerId: true, name: true } } },
  });
  if (!order) throw AppError.notFound("Order not found");
  assertOwnerOrAdmin(actor, order.business.ownerId);
  if (order.status === status) return order;

  return prisma.$transaction(async (tx) => {
    // Cancelling puts tracked stock back on the shelf; it must only happen on
    // the transition, never on a repeated cancel.
    if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
      for (const item of order.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { trackStock: true } });
        if (product?.trackStock) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }
      }
    }

    return tx.order.update({ where: { id: orderId }, data: { status }, include: { items: true } });
  });
}

// ---------------------------------------------------------------------------
// Customer report
// ---------------------------------------------------------------------------

/**
 * Who has bought from this shop, built from the orders themselves. Guests
 * never create an account, so the phone number is the identity we group on.
 */
export async function listCustomers(
  actor: Actor,
  businessId: string,
  query: { search?: string; page?: number; pageSize?: number },
) {
  await ownedBusiness(actor, businessId);
  const { page, pageSize, skip, take } = parsePagination(query);

  const where: Prisma.OrderWhereInput = {
    businessId,
    ...(query.search
      ? {
          OR: [{ customerName: { contains: query.search } }, { customerPhone: { contains: query.search } }],
        }
      : {}),
  };

  // One row per phone number, ordered by what they have spent.
  const grouped = await prisma.order.groupBy({
    by: ["customerPhone"],
    where,
    _count: { _all: true },
    _sum: { totalCents: true },
    _max: { placedAt: true },
    _min: { placedAt: true },
    orderBy: { _sum: { totalCents: "desc" } },
    skip,
    take,
  });

  const distinct = await prisma.order.findMany({ where, distinct: ["customerPhone"], select: { customerPhone: true } });

  // The name, email and address on their most recent order — what the shop
  // would use to reach them today.
  const latest = await Promise.all(
    grouped.map((row) =>
      prisma.order.findFirst({
        where: { businessId, customerPhone: row.customerPhone },
        orderBy: { placedAt: "desc" },
        select: {
          customerName: true,
          customerEmail: true,
          city: true,
          addressLine1: true,
          status: true,
          orderNumber: true,
          currency: true,
        },
      }),
    ),
  );

  const items = grouped.map((row, index) => ({
    phone: row.customerPhone,
    name: latest[index]?.customerName ?? "",
    email: latest[index]?.customerEmail ?? null,
    city: latest[index]?.city ?? "",
    address: latest[index]?.addressLine1 ?? "",
    lastOrderNumber: latest[index]?.orderNumber ?? "",
    lastOrderStatus: latest[index]?.status ?? null,
    currency: latest[index]?.currency ?? "INR",
    orderCount: row._count._all,
    totalSpentCents: row._sum.totalCents ?? 0,
    firstOrderAt: row._min.placedAt,
    lastOrderAt: row._max.placedAt,
  }));

  return { items, meta: { page, pageSize, total: distinct.length } };
}
