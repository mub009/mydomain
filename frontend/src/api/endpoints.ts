import { api } from "./client";
import {
  AdminUser,
  ApiResponse,
  AuthResponse,
  Booking,
  Business,
  Category,
  Lead,
  Order,
  OrderStatus,
  OrderSummary,
  PaginatedResponse,
  PointsBalance,
  PointTransaction,
  PopularCity,
  Product,
  QrClaimResult,
  QrLookup,
  Review,
  ReviewLinks,
  ReviewQrCode,
  Campaign,
  CampaignMessage,
  Contact,
  ContactSummary,
  ImportResult,
  MessageTemplate,
  Rfq,
  ShopCustomer,
  SiteType,
  StorefrontTheme,
  UserRole,
  Visitor,
  WhatsappSession,
  WhatsappSettings,
} from "@/types";

export const authApi = {
  register: (payload: { email: string; password: string; firstName: string; lastName: string; role?: string }) =>
    api.post<ApiResponse<AuthResponse>>("/auth/register", payload).then((r) => r.data.data),
  login: (payload: { email: string; password: string }) =>
    api.post<ApiResponse<AuthResponse>>("/auth/login", payload).then((r) => r.data.data),
  me: () => api.get<ApiResponse<AuthResponse["user"]>>("/auth/me").then((r) => r.data.data),
};

export const categoriesApi = {
  list: () => api.get<ApiResponse<Category[]>>("/categories").then((r) => r.data.data),
};

export const searchApi = {
  search: (params: Record<string, unknown>) =>
    api.get<PaginatedResponse<Business>>("/search", { params }).then((r) => r.data),
  popularCities: () => api.get<ApiResponse<PopularCity[]>>("/search/cities").then((r) => r.data.data),
};

export const businessesApi = {
  get: (slug: string) => api.get<ApiResponse<Business>>(`/businesses/${slug}`).then((r) => r.data.data),
  manage: (id: string) => api.get<ApiResponse<Business>>(`/businesses/${id}/manage`).then((r) => r.data.data),
  mine: (params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<Business>>("/businesses/mine", { params }).then((r) => r.data),
  create: (payload: Record<string, unknown>) =>
    api.post<ApiResponse<Business>>("/businesses", payload).then((r) => r.data.data),
  update: (id: string, payload: Record<string, unknown>) =>
    api.patch<ApiResponse<Business>>(`/businesses/${id}`, payload).then((r) => r.data.data),
  submitForApproval: (id: string) => api.post<ApiResponse<Business>>(`/businesses/${id}/submit`).then((r) => r.data.data),
  setHours: (id: string, hours: unknown[]) => api.put(`/businesses/${id}/hours`, { hours }).then((r) => r.data.data),
  addPhoto: (id: string, payload: { url: string; caption?: string; sortOrder?: number }) =>
    api.post(`/businesses/${id}/photos`, payload).then((r) => r.data.data),
  removePhoto: (id: string, photoId: string) => api.delete(`/businesses/${id}/photos/${photoId}`),
  addService: (id: string, payload: Record<string, unknown>) =>
    api.post(`/businesses/${id}/services`, payload).then((r) => r.data.data),
  updateService: (id: string, serviceId: string, payload: Record<string, unknown>) =>
    api.patch(`/businesses/${id}/services/${serviceId}`, payload).then((r) => r.data.data),
  deleteService: (id: string, serviceId: string) => api.delete(`/businesses/${id}/services/${serviceId}`),

  // QR review board
  reviewLinks: (id: string) => api.get<ApiResponse<ReviewLinks>>(`/businesses/${id}/review-links`).then((r) => r.data.data),
  updateReviewLinks: (id: string, payload: Record<string, unknown>) =>
    api.patch<ApiResponse<ReviewLinks>>(`/businesses/${id}/review-links`, payload).then((r) => r.data.data),
};

export const reviewsApi = {
  list: (businessId: string, params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<Review>>(`/businesses/${businessId}/reviews`, { params }).then((r) => r.data),
  create: (businessId: string, payload: { rating: number; title?: string; comment?: string }) =>
    api.post<ApiResponse<Review>>(`/businesses/${businessId}/reviews`, payload).then((r) => r.data.data),
};

export const leadsApi = {
  create: (businessId: string, payload: { name: string; phone: string; email?: string; message?: string; source?: string }) =>
    api.post<ApiResponse<Lead>>(`/businesses/${businessId}/leads`, payload).then((r) => r.data.data),
  listForBusiness: (businessId: string, params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<Lead>>(`/businesses/${businessId}/leads`, { params }).then((r) => r.data),
  updateStatus: (leadId: string, status: string) =>
    api.patch<ApiResponse<Lead>>(`/leads/${leadId}/status`, { status }).then((r) => r.data.data),
};

export const bookingsApi = {
  create: (businessId: string, payload: { serviceId: string; scheduledAt: string; notes?: string }) =>
    api.post<ApiResponse<Booking>>(`/businesses/${businessId}/bookings`, payload).then((r) => r.data.data),
  mine: () => api.get<PaginatedResponse<Booking>>("/bookings/mine").then((r) => r.data),
  forBusiness: (businessId: string, params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<Booking>>(`/businesses/${businessId}/bookings`, { params }).then((r) => r.data),
  updateStatus: (bookingId: string, status: string) =>
    api.patch<ApiResponse<Booking>>(`/bookings/${bookingId}/status`, { status }).then((r) => r.data.data),
};

export const b2bApi = {
  list: (params: Record<string, unknown> = {}) => api.get<PaginatedResponse<Rfq>>("/b2b/rfqs", { params }).then((r) => r.data),
  mine: () => api.get<ApiResponse<Rfq[]>>("/b2b/rfqs/mine").then((r) => r.data.data),
  get: (id: string) => api.get<ApiResponse<Rfq>>(`/b2b/rfqs/${id}`).then((r) => r.data.data),
  create: (payload: Record<string, unknown>) => api.post<ApiResponse<Rfq>>("/b2b/rfqs", payload).then((r) => r.data.data),
  submitQuote: (rfqId: string, payload: Record<string, unknown>) =>
    api.post(`/b2b/rfqs/${rfqId}/quotes`, payload).then((r) => r.data.data),
  awardQuote: (rfqId: string, quoteId: string) =>
    api.post(`/b2b/rfqs/${rfqId}/quotes/${quoteId}/award`).then((r) => r.data.data),
};

export const usersApi = {
  // Admin: any user; dealer: only accounts they created.
  resetPassword: (id: string, password: string) =>
    api.patch<ApiResponse<{ id: string; email: string }>>(`/users/${id}/password`, { password }).then((r) => r.data.data),
  created: (params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<AdminUser>>("/users/created", { params }).then((r) => r.data),
};

export interface QrCodeListResponse {
  success: boolean;
  data: ReviewQrCode[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { unassigned: number; assigned: number };
}

/** A business a QR board may be attached to, as offered on the claim screen. */
export interface AssignableBusiness {
  id: string;
  name: string;
  slug: string;
  city: string;
  ownerId: string;
  createdById: string | null;
  _count: { reviewQrCodes: number };
}

export const qrCodesApi = {
  // Public: confirm what a scanned board is before claiming it.
  lookup: (code: string) => api.get<ApiResponse<QrLookup>>(`/qr-codes/lookup/${encodeURIComponent(code)}`).then((r) => r.data.data),
  claim: (code: string, businessId: string, channel?: string) =>
    api.post<ApiResponse<QrClaimResult>>("/qr-codes/claim", { code, businessId, channel }).then((r) => r.data.data),
  // Businesses this user may attach a board to. A dealer gets the shops they
  // registered, which their own "my businesses" list does not include.
  assignableBusinesses: (search?: string) =>
    api
      .get<ApiResponse<AssignableBusiness[]>>("/qr-codes/assignable-businesses", {
        params: search ? { search } : undefined,
      })
      .then((r) => r.data.data),
  forBusiness: (businessId: string) =>
    api.get<ApiResponse<ReviewQrCode[]>>(`/businesses/${businessId}/qr-codes`).then((r) => r.data.data),
  // Re-point one of the shop's boards at a different platform.
  setChannel: (businessId: string, qrId: string, channel: string | null) =>
    api.patch<ApiResponse<ReviewQrCode>>(`/businesses/${businessId}/qr-codes/${qrId}`, { channel }).then((r) => r.data.data),
};

export interface SiteTemplateChoice {
  id: string;
  name: string;
  description: string;
  accent: string;
  bestFor: string;
  /** Palette the design contributes when the site is a storefront. */
  theme: StorefrontTheme;
}

export interface SiteEditorPayload {
  businessId: string;
  slug: string;
  projectData: unknown | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
  hasSavedDraft: boolean;
  /** Brochure website, or a storefront that takes orders. */
  siteType: SiteType;
  storefront: { deliveryFeeCents: number; freeDeliveryAboveCents: number | null; productCount: number };
  /** The design saved against this site. */
  templateId: string;
  /** The design `starterHtml`/`starterCss` below were rendered with. */
  renderedTemplateId: string;
  templates: SiteTemplateChoice[];
  starterHtml: string;
  starterCss: string;
  businessData: Record<string, unknown>;
}

export interface PublishedBusiness {
  id: string;
  name: string;
  slug: string;
  city: string;
  description: string | null;
  phone: string;
  email: string | null;
  logoUrl: string | null;
  addressLine1: string;
  addressLine2: string | null;
  state: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  instagramUsername: string | null;
  avgRating: number;
  reviewCount: number;
  photos: { url: string; caption: string | null }[];
  hours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
}

export interface PublishedSite {
  siteType: SiteType;
  business: PublishedBusiness;
  theme: StorefrontTheme;
  templateId: string;
  storefront: { deliveryFeeCents: number; freeDeliveryAboveCents: number | null } | null;
  html: string;
  css: string;
  publishedAt: string | null;
}

export const sitesApi = {
  // Builder (owner only)
  get: (businessId: string) =>
    api.get<ApiResponse<SiteEditorPayload>>(`/businesses/${businessId}/site`).then((r) => r.data.data),
  save: (
    businessId: string,
    payload: { projectData?: unknown; html?: string; css?: string; templateId?: string },
  ) =>
    api
      .put<ApiResponse<{ savedAt: string; isPublished: boolean; templateId: string }>>(
        `/businesses/${businessId}/site`,
        payload,
      )
      .then((r) => r.data.data),
  // Renders one of the designs for this business without saving it.
  previewTemplate: (businessId: string, templateId: string) =>
    api
      .get<ApiResponse<{ templateId: string; html: string; css: string }>>(
        `/businesses/${businessId}/site/templates/${templateId}`,
      )
      .then((r) => r.data.data),
  // Brochure website vs storefront, plus the storefront's delivery settings.
  // Kept apart from `save` so switching never touches the builder document.
  setType: (
    businessId: string,
    payload: { siteType?: SiteType; deliveryFeeCents?: number; freeDeliveryAboveCents?: number | null },
  ) =>
    api
      .patch<ApiResponse<{ siteType: SiteType; isPublished: boolean; deliveryFeeCents: number; freeDeliveryAboveCents: number | null }>>(
        `/businesses/${businessId}/site/type`,
        payload,
      )
      .then((r) => r.data.data),
  publish: (businessId: string, isPublished: boolean) =>
    api
      .post<ApiResponse<{ isPublished: boolean; publishedAt: string | null; url: string }>>(
        `/businesses/${businessId}/site/publish`,
        { isPublished },
      )
      .then((r) => r.data.data),

  // Public page
  published: (slug: string) => api.get<ApiResponse<PublishedSite>>(`/sites/${slug}`).then((r) => r.data.data),
};

export const visitorsApi = {
  capture: (payload: { phone: string; consent: true; latitude?: number; longitude?: number; city?: string }) =>
    api.post<ApiResponse<{ id: string; phone: string }>>("/visitors", payload).then((r) => r.data.data),
  updateLocation: (id: string, latitude: number, longitude: number, city?: string) =>
    api.patch<ApiResponse<{ id: string }>>(`/visitors/${id}/location`, { latitude, longitude, city }).then((r) => r.data.data),
};

export interface VisitorListResponse {
  success: boolean;
  data: Visitor[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
  summary: { located: number; todayCount: number };
}

export const pointsApi = {
  mine: () => api.get<ApiResponse<PointsBalance>>("/points/mine").then((r) => r.data.data),
  myTransactions: (params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<PointTransaction>>("/points/mine/transactions", { params }).then((r) => r.data),
};

export interface CreatorReportRow {
  creator: { id: string; firstName: string; lastName: string; email: string; role: UserRole } | null;
  businessCount: number;
  publishedCount: number;
  todayCount: number;
}

export interface CreatorReport {
  items: CreatorReportRow[];
  totalBusinesses: number;
  dealerBusinessCount: number;
  registeredToday: number;
  dealerRegisteredToday: number;
}

export const adminApi = {
  stats: () => api.get<ApiResponse<Record<string, number>>>("/admin/stats").then((r) => r.data.data),
  businessCreatorsReport: () =>
    api.get<ApiResponse<CreatorReport>>("/admin/reports/business-creators").then((r) => r.data.data),

  // Visitors captured by the welcome popup
  visitors: (params: Record<string, unknown> = {}) =>
    api.get<VisitorListResponse>("/admin/visitors", { params }).then((r) => r.data),

  // Pre-printed review QR boards
  qrCodes: (params: Record<string, unknown> = {}) =>
    api.get<QrCodeListResponse>("/admin/qr-codes", { params }).then((r) => r.data),
  generateQrBatch: (count: number, batchLabel?: string, channel?: string) =>
    api
      .post<ApiResponse<{ created: number; codes: string[]; batchLabel: string | null }>>("/admin/qr-codes/batch", {
        count,
        batchLabel,
        channel,
      })
      .then((r) => r.data.data),
  updateQrCode: (id: string, payload: { status?: string; businessId?: string | null }) =>
    api.patch<ApiResponse<ReviewQrCode>>(`/admin/qr-codes/${id}`, payload).then((r) => r.data.data),

  // Approvals
  pendingBusinesses: (params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<Business>>("/admin/businesses/pending", { params }).then((r) => r.data),
  approve: (id: string) => api.post(`/admin/businesses/${id}/approve`).then((r) => r.data.data),
  reject: (id: string) => api.post(`/admin/businesses/${id}/reject`).then((r) => r.data.data),
  suspend: (id: string) => api.post(`/admin/businesses/${id}/suspend`).then((r) => r.data.data),

  // Users
  users: (params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<AdminUser>>("/admin/users", { params }).then((r) => r.data),
  createUser: (payload: Record<string, unknown>) =>
    api.post<ApiResponse<AdminUser>>("/admin/users", payload).then((r) => r.data.data),
  updateUser: (id: string, payload: Record<string, unknown>) =>
    api.patch<ApiResponse<AdminUser>>(`/admin/users/${id}`, payload).then((r) => r.data.data),

  // Dealer points
  adjustPoints: (id: string, amount: number, note?: string) =>
    api.patch<ApiResponse<AdminUser>>(`/admin/users/${id}/points`, { amount, note }).then((r) => r.data.data),
  pointTransactions: (id: string, params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<PointTransaction>>(`/admin/users/${id}/points/transactions`, { params }).then((r) => r.data),

  // Businesses (admin-wide)
  businesses: (params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<Business>>("/admin/businesses", { params }).then((r) => r.data),
  updateBusiness: (id: string, payload: Record<string, unknown>) =>
    api.patch<ApiResponse<Business>>(`/admin/businesses/${id}`, payload).then((r) => r.data.data),
  reassignBusiness: (id: string, ownerId: string) =>
    api.post<ApiResponse<Business>>(`/admin/businesses/${id}/reassign`, { ownerId }).then((r) => r.data.data),
};

// ---------------------------------------------------------------------------
// Storefront: catalogue, orders and the shop's customer report
// ---------------------------------------------------------------------------

export interface OrderListResponse extends PaginatedResponse<Order> {
  summary: OrderSummary;
}

export const productsApi = {
  list: (businessId: string, params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<Product>>(`/businesses/${businessId}/products`, { params }).then((r) => r.data),
  create: (businessId: string, payload: Record<string, unknown>) =>
    api.post<ApiResponse<Product>>(`/businesses/${businessId}/products`, payload).then((r) => r.data.data),
  update: (businessId: string, productId: string, payload: Record<string, unknown>) =>
    api
      .patch<ApiResponse<Product>>(`/businesses/${businessId}/products/${productId}`, payload)
      .then((r) => r.data.data),
  remove: (businessId: string, productId: string) =>
    api.delete<ApiResponse<{ id: string }>>(`/businesses/${businessId}/products/${productId}`).then((r) => r.data.data),
};

export const ordersApi = {
  list: (businessId: string, params: Record<string, unknown> = {}) =>
    api.get<OrderListResponse>(`/businesses/${businessId}/orders`, { params }).then((r) => r.data),
  get: (businessId: string, orderId: string) =>
    api.get<ApiResponse<Order>>(`/businesses/${businessId}/orders/${orderId}`).then((r) => r.data.data),
  setStatus: (businessId: string, orderId: string, status: OrderStatus) =>
    api
      .patch<ApiResponse<Order>>(`/businesses/${businessId}/orders/${orderId}/status`, { status })
      .then((r) => r.data.data),
  customers: (businessId: string, params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<ShopCustomer>>(`/businesses/${businessId}/customers`, { params }).then((r) => r.data),
};

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: string;
  placedAt: string;
  items: { name: string; quantity: number; lineTotalCents: number }[];
}

// Public storefront — what a shopper on a published shop page calls.
export const shopApi = {
  products: (slug: string, params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<Product>>(`/sites/${slug}/products`, { params }).then((r) => r.data),
  checkout: (
    slug: string,
    payload: {
      items: { productId: string; quantity: number }[];
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      postalCode?: string;
      notes?: string;
    },
  ) => api.post<ApiResponse<PlacedOrder>>(`/sites/${slug}/orders`, payload).then((r) => r.data.data),
};

// ---------------------------------------------------------------------------
// WhatsApp broadcasts
// ---------------------------------------------------------------------------

export interface ContactListResponse extends PaginatedResponse<Contact> {
  summary: ContactSummary;
}

/** Pulls the server's suggested filename out of a Content-Disposition header. */
function filenameFromDisposition(header: unknown): string {
  const match = typeof header === "string" ? /filename="?([^";]+)"?/.exec(header) : null;
  return match?.[1] ?? "contacts-template.xlsx";
}

export const whatsappApi = {
  // Session
  session: (businessId: string) =>
    api.get<ApiResponse<WhatsappSession>>(`/businesses/${businessId}/whatsapp/session`).then((r) => r.data.data),
  connect: (businessId: string) =>
    api.post<ApiResponse<WhatsappSession>>(`/businesses/${businessId}/whatsapp/connect`).then((r) => r.data.data),
  disconnect: (businessId: string) =>
    api.post<ApiResponse<WhatsappSession>>(`/businesses/${businessId}/whatsapp/disconnect`).then((r) => r.data.data),
  updateSettings: (businessId: string, payload: Partial<WhatsappSettings>) =>
    api
      .patch<ApiResponse<WhatsappSession>>(`/businesses/${businessId}/whatsapp/settings`, payload)
      .then((r) => r.data.data),
  // One message to a number of your choosing, to check wording before a blast.
  sendTest: (businessId: string, phone: string, body: string) =>
    api
      .post<ApiResponse<{ phone: string; body: string }>>(`/businesses/${businessId}/whatsapp/test`, { phone, body })
      .then((r) => r.data.data),

  // Contacts
  contacts: (businessId: string, params: Record<string, unknown> = {}) =>
    api.get<ContactListResponse>(`/businesses/${businessId}/contacts`, { params }).then((r) => r.data),
  addContact: (businessId: string, payload: { name: string; phone: string; email?: string; tag?: string }) =>
    api.post<ApiResponse<Contact>>(`/businesses/${businessId}/contacts`, payload).then((r) => r.data.data),
  updateContact: (
    businessId: string,
    contactId: string,
    payload: { name?: string; tag?: string | null; optedOut?: boolean },
  ) =>
    api
      .patch<ApiResponse<Contact>>(`/businesses/${businessId}/contacts/${contactId}`, payload)
      .then((r) => r.data.data),
  deleteContact: (businessId: string, contactId: string) =>
    api.delete<ApiResponse<{ id: string }>>(`/businesses/${businessId}/contacts/${contactId}`).then((r) => r.data.data),
  // The blank sheet to fill in. Comes back as a file, so it is fetched as a
  // blob and handed to the browser rather than parsed.
  contactTemplate: (businessId: string) =>
    api
      .get<Blob>(`/businesses/${businessId}/contacts/template`, { responseType: "blob" })
      .then((r) => ({ blob: r.data, filename: filenameFromDisposition(r.headers["content-disposition"]) })),
  importContacts: (businessId: string, file: File, tag?: string) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<ApiResponse<ImportResult>>(`/businesses/${businessId}/contacts/import`, form, {
        params: tag ? { tag } : undefined,
      })
      .then((r) => r.data.data);
  },

  // Templates
  templates: (businessId: string) =>
    api.get<ApiResponse<MessageTemplate[]>>(`/businesses/${businessId}/templates`).then((r) => r.data.data),
  createTemplate: (businessId: string, payload: { name: string; body: string }) =>
    api.post<ApiResponse<MessageTemplate>>(`/businesses/${businessId}/templates`, payload).then((r) => r.data.data),
  updateTemplate: (businessId: string, templateId: string, payload: { name?: string; body?: string }) =>
    api
      .patch<ApiResponse<MessageTemplate>>(`/businesses/${businessId}/templates/${templateId}`, payload)
      .then((r) => r.data.data),
  deleteTemplate: (businessId: string, templateId: string) =>
    api
      .delete<ApiResponse<{ id: string }>>(`/businesses/${businessId}/templates/${templateId}`)
      .then((r) => r.data.data),

  // Campaigns
  campaigns: (businessId: string, params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<Campaign>>(`/businesses/${businessId}/campaigns`, { params }).then((r) => r.data),
  createCampaign: (
    businessId: string,
    payload: { name: string; body: string; templateId?: string; tag?: string; contactIds?: string[] },
  ) => api.post<ApiResponse<Campaign>>(`/businesses/${businessId}/campaigns`, payload).then((r) => r.data.data),
  campaign: (businessId: string, campaignId: string, params: Record<string, unknown> = {}) =>
    api
      .get<{
        success: boolean;
        data: { campaign: Campaign; messages: CampaignMessage[] };
        meta: { page: number; pageSize: number; total: number; totalPages: number };
      }>(`/businesses/${businessId}/campaigns/${campaignId}`, { params })
      .then((r) => r.data),
  startCampaign: (businessId: string, campaignId: string) =>
    api
      .post<ApiResponse<Campaign>>(`/businesses/${businessId}/campaigns/${campaignId}/start`)
      .then((r) => r.data.data),
  retryFailed: (businessId: string, campaignId: string) =>
    api
      .post<ApiResponse<{ requeued: number; campaign: Campaign }>>(
        `/businesses/${businessId}/campaigns/${campaignId}/retry`,
      )
      .then((r) => r.data.data),
  setCampaignStatus: (businessId: string, campaignId: string, status: string) =>
    api
      .patch<ApiResponse<Campaign>>(`/businesses/${businessId}/campaigns/${campaignId}/status`, { status })
      .then((r) => r.data.data),
};

// ---------------------------------------------------------------------------
// Poster Studio
// ---------------------------------------------------------------------------

export type PosterSize = "SQUARE" | "PORTRAIT" | "STORY";
export type PosterCopyEngine = "offline" | "claude";

export interface PosterDesign {
  id: string;
  name: string;
  description: string | null;
  layout: string;
  palette: string;
  size: PosterSize;
  headline: string | null;
  subheadline: string | null;
  ctaText: string | null;
  badgeText: string | null;
  footnote: string | null;
  backgroundImageUrl: string | null;
  /** Only returned by `get`; the list reports `hasArtwork` instead, because
   *  an uploaded image lives inline and would be megabytes per row. */
  artworkUrl?: string | null;
  hasArtwork?: boolean;
  headerText: string | null;
  footerText: string | null;
  showHeader: boolean;
  showFooter: boolean;
  logoPosition: string;
  logoScale: number;
  bandStyle: string;
  bandColor: string | null;
  bandTextColor: string | null;
  /** Derived from the prompt, not stored — a poster carries a QR when its
   *  prompt names `@qr`. */
  showQr?: boolean;
  qrPosition: string;
  qrScale: number;
  categoryId: string | null;
  city: string | null;
  isPublished: boolean;
  aiPrompt: string | null;
  aiEngine: string | null;
  updatedAt: string;
  category?: { id: string; name: string } | null;
  /** Placeholders nothing will fill — shown before the design is published. */
  warnings?: string[];
  businessesUsing?: number;
  downloads?: number;
}

export interface PosterStudioOptions {
  layouts: { id: string; name: string; description: string; bestFor: string }[];
  palettes: { id: string; name: string; bg: string; accent: string; ink: string; dark: boolean }[];
  sizes: { id: PosterSize; width: number; height: number; label: string; hint: string }[];
  placeholders: { token: string; label: string; example: string }[];
  logoPositions: { id: string; label: string }[];
  bandStyles: { id: string; label: string; hint: string }[];
  qrPositions: { id: string; label: string }[];
  maxArtworkBytes: number;
  tones: string[];
  ai: { engine: PosterCopyEngine };
}

export interface PosterBandSuggestion {
  headerText: string;
  footerText: string;
  logoPosition: string;
  bandStyle: string;
}

export interface PosterCopySuggestion {
  headline: string;
  subheadline: string;
  ctaText: string;
  badgeText: string;
  footnote: string;
}

export interface RenderedPoster {
  designId: string;
  name: string;
  layout: string;
  palette: string;
  size: PosterSize;
  width: number;
  height: number;
  svg: string;
  fileName: string;
  logoEmbedded: boolean;
}

export interface PosterPreviewBusiness {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  category: { name: string } | null;
}

export const postersApi = {
  options: () => api.get<ApiResponse<PosterStudioOptions>>("/admin/posters/options").then((r) => r.data.data),
  list: (params: Record<string, unknown> = {}) =>
    api.get<PaginatedResponse<PosterDesign>>("/admin/posters", { params }).then((r) => r.data),
  // The stored prompt with one business's details filled in.
  resolvePrompt: (prompt: string, businessId?: string) =>
    api
      .post<
        ApiResponse<{
          business: { id: string; name: string; city: string };
          prompt: string;
          resolved: string;
          unknown: string[];
        }>
      >("/admin/posters/resolve-prompt", { prompt, businessId })
      .then((r) => r.data.data),
  // The only call that returns the uploaded artwork itself.
  get: (id: string) => api.get<ApiResponse<PosterDesign>>(`/admin/posters/${id}`).then((r) => r.data.data),
  create: (payload: Record<string, unknown>) =>
    api.post<ApiResponse<PosterDesign>>("/admin/posters", payload).then((r) => r.data.data),
  update: (id: string, payload: Record<string, unknown>) =>
    api.patch<ApiResponse<PosterDesign>>(`/admin/posters/${id}`, payload).then((r) => r.data.data),
  remove: (id: string) => api.delete(`/admin/posters/${id}`).then(() => undefined),
  usage: (id: string) =>
    api
      .get<ApiResponse<{ downloads: number; lastAt: string; business: { id: string; name: string; city: string } }[]>>(
        `/admin/posters/${id}/usage`,
      )
      .then((r) => r.data.data),
  // Renders a design that has not been saved yet, against a real listing.
  preview: (payload: Record<string, unknown>) =>
    api.post<ApiResponse<RenderedPoster>>("/admin/posters/preview", payload).then((r) => r.data.data),
  previewBusinesses: (search?: string) =>
    api
      .get<ApiResponse<PosterPreviewBusiness[]>>("/admin/posters/preview-businesses", {
        params: search ? { search } : undefined,
      })
      .then((r) => r.data.data),
  // Header, footer and logo placement for an uploaded design.
  aiBands: (prompt: string, count = 3) =>
    api
      .post<ApiResponse<{ engine: PosterCopyEngine; suggestions: PosterBandSuggestion[]; note?: string }>>(
        "/admin/posters/ai-bands",
        { prompt, count },
      )
      .then((r) => r.data.data),
  uploadArtwork: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api
      .post<ApiResponse<{ dataUrl: string; type: string; bytes: number }>>("/admin/posters/artwork", body)
      .then((r) => r.data.data);
  },
  aiSuggest: (brief: Record<string, unknown>) =>
    api
      .post<ApiResponse<{ engine: PosterCopyEngine; suggestions: PosterCopySuggestion[]; note?: string }>>(
        "/admin/posters/ai-suggest",
        brief,
      )
      .then((r) => r.data.data),
};

export interface BusinessPoster {
  id: string;
  name: string;
  description: string | null;
  layout: string;
  palette: string;
  size: PosterSize;
  dimensions: { width: number; height: number; label: string; hint: string };
  updatedAt: string;
  forCategory: string | null;
  forCity: string | null;
  downloads: number;
  lastDownloadedAt: string | null;
}

export const businessPostersApi = {
  list: (businessId: string) =>
    api
      .get<
        ApiResponse<{
          business: { id: string; name: string; logoUrl: string | null; hasLogo: boolean };
          designs: BusinessPoster[];
        }>
      >(`/businesses/${businessId}/posters`)
      .then((r) => r.data.data),
  render: (businessId: string, designId: string) =>
    api.get<ApiResponse<RenderedPoster>>(`/businesses/${businessId}/posters/${designId}`).then((r) => r.data.data),
  countDownload: (businessId: string, designId: string) =>
    api
      .post<ApiResponse<{ downloads: number }>>(`/businesses/${businessId}/posters/${designId}/downloaded`)
      .then((r) => r.data.data),
};
