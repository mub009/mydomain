import { Request, Response } from "express";
import { created, ok, paginated } from "@/common/apiResponse";
import { AppError } from "@/common/errors";
import * as storefront from "./storefront.service";

function actor(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

// --- Catalogue (owner) ------------------------------------------------------

export async function listProductsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await storefront.listProducts(actor(req), req.params.id, req.query as never);
  paginated(res, items, meta);
}

export async function createProductHandler(req: Request, res: Response): Promise<void> {
  created(res, await storefront.createProduct(actor(req), req.params.id, req.body));
}

export async function updateProductHandler(req: Request, res: Response): Promise<void> {
  ok(res, await storefront.updateProduct(actor(req), req.params.productId, req.body));
}

export async function deleteProductHandler(req: Request, res: Response): Promise<void> {
  ok(res, await storefront.deleteProduct(actor(req), req.params.productId));
}

// --- Orders (owner) ---------------------------------------------------------

export async function listOrdersHandler(req: Request, res: Response): Promise<void> {
  const { items, meta, summary } = await storefront.listOrders(actor(req), req.params.id, req.query as never);
  res.status(200).json({
    success: true,
    data: items,
    meta: { ...meta, totalPages: Math.ceil(meta.total / meta.pageSize) || 1 },
    summary,
  });
}

export async function getOrderHandler(req: Request, res: Response): Promise<void> {
  ok(res, await storefront.getOrder(actor(req), req.params.orderId));
}

export async function updateOrderStatusHandler(req: Request, res: Response): Promise<void> {
  ok(res, await storefront.updateOrderStatus(actor(req), req.params.orderId, req.body.status));
}

export async function listCustomersHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await storefront.listCustomers(actor(req), req.params.id, req.query as never);
  paginated(res, items, meta);
}

// --- Public storefront ------------------------------------------------------

export async function publicProductsHandler(req: Request, res: Response): Promise<void> {
  const { items, meta } = await storefront.listPublicProducts(req.params.slug, req.query as never);
  paginated(res, items, meta);
}

export async function checkoutHandler(req: Request, res: Response): Promise<void> {
  created(res, await storefront.placeOrder(req.params.slug, req.user?.sub, req.body));
}
