import { Router } from "express";
import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { optionalAuth, requireAuth, requirePrivilege } from "@/middleware/auth";
import { checkoutRateLimit } from "@/middleware/rateLimit";
import { checkoutSchema, createProductSchema, orderStatusSchema, updateProductSchema } from "./storefront.validation";
import {
  checkoutHandler,
  createProductHandler,
  deleteProductHandler,
  getOrderHandler,
  listCustomersHandler,
  listOrdersHandler,
  listProductsHandler,
  publicProductsHandler,
  updateOrderStatusHandler,
  updateProductHandler,
} from "./storefront.controller";

const pageQuery = {
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(120).optional(),
};

const listProductsQuerySchema = z.object({ ...pageQuery, includeInactive: z.coerce.boolean().optional() });
const listOrdersQuerySchema = z.object({ ...pageQuery, status: z.nativeEnum(OrderStatus).optional() });
const listCustomersQuerySchema = z.object(pageQuery);

// Owner-facing catalogue, orders and customer report, nested under the
// business they belong to.
export const storefrontRouter = Router();

const listingPriv = requirePrivilege("MANAGE_LISTINGS");

storefrontRouter.get(
  "/:id/products",
  requireAuth,
  validate({ query: listProductsQuerySchema }),
  asyncHandler(listProductsHandler),
);
storefrontRouter.post(
  "/:id/products",
  requireAuth,
  listingPriv,
  validate({ body: createProductSchema }),
  asyncHandler(createProductHandler),
);
storefrontRouter.patch(
  "/:id/products/:productId",
  requireAuth,
  listingPriv,
  validate({ body: updateProductSchema }),
  asyncHandler(updateProductHandler),
);
storefrontRouter.delete("/:id/products/:productId", requireAuth, listingPriv, asyncHandler(deleteProductHandler));

storefrontRouter.get(
  "/:id/orders",
  requireAuth,
  validate({ query: listOrdersQuerySchema }),
  asyncHandler(listOrdersHandler),
);
storefrontRouter.get("/:id/orders/:orderId", requireAuth, asyncHandler(getOrderHandler));
storefrontRouter.patch(
  "/:id/orders/:orderId/status",
  requireAuth,
  listingPriv,
  validate({ body: orderStatusSchema }),
  asyncHandler(updateOrderStatusHandler),
);
storefrontRouter.get(
  "/:id/customers",
  requireAuth,
  validate({ query: listCustomersQuerySchema }),
  asyncHandler(listCustomersHandler),
);

// Public: what a shopper on a published storefront can reach. Checkout is open
// to guests — most buyers will not have an account — but a signed-in shopper
// gets the order linked to them.
export const publicStorefrontRouter = Router();

publicStorefrontRouter.get(
  "/:slug/products",
  validate({ query: z.object(pageQuery) }),
  asyncHandler(publicProductsHandler),
);
publicStorefrontRouter.post(
  "/:slug/orders",
  checkoutRateLimit,
  optionalAuth,
  validate({ body: checkoutSchema }),
  asyncHandler(checkoutHandler),
);
