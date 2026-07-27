import rateLimit from "express-rate-limit";

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Storefront checkout is open to guests and writes an order plus an email on
// every call, so it gets a tighter budget than the rest of the API.
export const checkoutRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many orders from this device. Please try again shortly." },
  },
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many auth attempts, try again later" } },
});
