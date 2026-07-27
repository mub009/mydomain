export type UserRole = "CUSTOMER" | "BUSINESS_OWNER" | "DEALER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
export type Privilege = "MANAGE_LISTINGS" | "MANAGE_LEADS" | "MANAGE_BOOKINGS";

export const PRIVILEGE_LABELS: Record<Privilege, string> = {
  MANAGE_LISTINGS: "Manage listings",
  MANAGE_LEADS: "Manage leads",
  MANAGE_BOOKINGS: "Manage bookings",
};

export const ALL_PRIVILEGES: Privilege[] = ["MANAGE_LISTINGS", "MANAGE_LEADS", "MANAGE_BOOKINGS"];

export interface AdminUser {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  privileges?: Privilege[] | null;
  points?: number;
  avatarUrl?: string | null;
  createdAt: string;
  _count?: { businesses: number };
}

export type PointTransactionType = "ADMIN_GRANT" | "ADMIN_DEDUCTION" | "BUSINESS_CREATED";

export interface PointTransaction {
  id: string;
  type: PointTransactionType;
  amount: number;
  balanceAfter: number;
  note?: string | null;
  createdAt: string;
  grantedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
}

export interface PointsBalance {
  points: number;
  pointsPerBusiness: number;
  businessesRemaining: number;
  totalSpent: number;
  chargeable: boolean;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: string;
  privileges?: Privilege[];
  points?: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  children?: Category[];
}

export interface PopularCity {
  city: string;
  state: string;
  businessCount: number;
}

export interface Business {
  id: string;
  ownerId?: string;
  name: string;
  slug: string;
  description?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode?: string;
  country?: string;
  phone: string;
  email?: string | null;
  website?: string | null;
  latitude: number;
  longitude: number;
  avgRating: number;
  reviewCount: number;
  viewCount?: number;
  leadCount?: number;
  isVerified?: boolean;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  status: string;
  category?: Category;
  categoryName?: string;
  categorySlug?: string;
  // Populated by the search endpoint for listing rows.
  photoUrl?: string | null;
  owner?: { id: string; email: string; firstName: string; lastName: string; role: UserRole };
  // Present on the create response when a dealer/admin supplied a login for
  // the business team; `created` is false when an existing account was linked.
  ownerAccount?: { email: string; created: boolean };
  distanceKm?: number | null;
  photos?: Array<{ id: string; url: string; caption?: string | null }>;
  hours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>;
  services?: Service[];
  reviews?: Review[];
}

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  currency: string;
  durationMins: number;
  isActive: boolean;
}

export interface Review {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  ownerReply?: string | null;
  createdAt: string;
  user?: { firstName: string; lastName: string; avatarUrl?: string | null };
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
  source: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  scheduledAt: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  priceCents: number;
  currency: string;
  notes?: string | null;
  business?: Business;
  service?: Service;
}

export interface Rfq {
  id: string;
  title: string;
  description: string;
  quantity: number;
  city: string;
  state: string;
  status: "OPEN" | "QUOTED" | "AWARDED" | "CLOSED" | "CANCELLED";
  category?: Category;
  createdAt: string;
  quotes?: Quote[];
}

export interface Quote {
  id: string;
  priceCents: number;
  currency: string;
  message?: string | null;
  deliveryDays?: number | null;
  status: "SUBMITTED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  business?: { id: string; name: string; slug: string; avgRating: number };
}

export type ReviewChannel =
  | "GOOGLE"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "YOUTUBE"
  | "WEBSITE"
  | "DIRECTIONS"
  | "MARKKITO"
  | "MARKKITO_REVIEW";

// The two Markkito destinations are built from the listing's slug, so they
// work the moment a business exists — nothing for the shop to set up first.
export const MARKKITO_CHANNELS: ReviewChannel[] = ["MARKKITO_REVIEW", "MARKKITO"];

// Destination options offered in the QR "purpose" dropdowns.
export const REVIEW_CHANNELS: { value: ReviewChannel; label: string }[] = [
  { value: "GOOGLE", label: "Google review" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "WEBSITE", label: "Website" },
  { value: "DIRECTIONS", label: "Directions to shop" },
  { value: "MARKKITO_REVIEW", label: "Markkito review" },
  { value: "MARKKITO", label: "Markkito business page" },
];

export const CHANNEL_LABELS: Record<ReviewChannel, string> = {
  GOOGLE: "Google review",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  WEBSITE: "Website",
  DIRECTIONS: "Directions to shop",
  MARKKITO_REVIEW: "Markkito review",
  MARKKITO: "Markkito business page",
};

export interface ReviewLinks {
  slug: string;
  googlePlaceId?: string | null;
  googleReviewUrl?: string | null;
  instagramUsername?: string | null;
  facebookPageUrl?: string | null;
  youtubeUrl?: string | null;
  website?: string | null;
  preferredReviewChannel?: ReviewChannel | null;
  resolved: Record<ReviewChannel, string | null>;
  scanCounts: Record<string, number>;
  totalScans: number;
}

export type ReviewQrStatus = "UNASSIGNED" | "ASSIGNED" | "DISABLED";

export interface ReviewQrCode {
  id: string;
  code: string;
  status: ReviewQrStatus;
  channel?: ReviewChannel | null;
  batchLabel?: string | null;
  scanCount: number;
  assignedAt?: string | null;
  business?: { id: string; name: string; slug: string; city: string } | null;
  createdAt?: string;
}

export interface QrLookup {
  code: string;
  status: ReviewQrStatus;
  channel?: ReviewChannel | null;
  batchLabel?: string | null;
  scanCount: number;
  assignedAt?: string | null;
  business?: { id: string; name: string; slug: string; city: string } | null;
}

export interface QrClaimResult {
  code: string;
  status: ReviewQrStatus;
  channel?: ReviewChannel | null;
  business?: { id: string; name: string; slug: string; city: string } | null;
  assignedAt?: string | null;
  reviewChannelsConfigured: ReviewChannel[];
  needsReviewLinks: boolean;
  effectiveChannel?: ReviewChannel | null;
  effectiveUrl?: string | null;
}

export interface Visitor {
  id: string;
  phone: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  consentAt: string;
  locationAt?: string | null;
  userAgent?: string | null;
  visitCount: number;
  lastSeenAt: string;
  createdAt: string;
}

// --- Website / storefront ---------------------------------------------------

export type SiteType = "WEBSITE" | "ECOMMERCE";

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  WEBSITE: "Website",
  ECOMMERCE: "eCommerce",
};

/** Palette a chosen template contributes to a storefront. */
export interface StorefrontTheme {
  accent: string;
  accentAlt: string;
  onAccent: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  line: string;
  headerBg: string;
  headerText: string;
  radius: string;
  font: string;
  heading: string;
  uppercase: boolean;
}

export interface Product {
  id: string;
  businessId?: string;
  name: string;
  slug: string;
  description?: string | null;
  priceCents: number;
  compareAtCents?: number | null;
  currency: string;
  imageUrl?: string | null;
  sku?: string | null;
  trackStock: boolean;
  stock: number;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: string;
}

export type OrderStatus = "PENDING" | "CONFIRMED" | "PACKED" | "SHIPPED" | "DELIVERED" | "CANCELLED";

// The order a shop normally moves an order through, used for the "advance to
// next step" action in the dashboard.
export const ORDER_FLOW: OrderStatus[] = ["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "New",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export interface OrderItem {
  id: string;
  productId?: string | null;
  name: string;
  imageUrl?: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postalCode?: string | null;
  notes?: string | null;
  status: OrderStatus;
  paymentMethod: "COD" | "ONLINE";
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: string;
  placedAt: string;
  items: OrderItem[];
}

export interface OrderSummary {
  total: number;
  revenueCents: number;
  todayCount: number;
  byStatus: Partial<Record<OrderStatus, number>>;
}

/** A row of the shop's customer report, grouped by phone number. */
export interface ShopCustomer {
  phone: string;
  name: string;
  email?: string | null;
  city: string;
  address: string;
  lastOrderNumber: string;
  lastOrderStatus: OrderStatus | null;
  currency: string;
  orderCount: number;
  totalSpentCents: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

// --- WhatsApp broadcasts ----------------------------------------------------

export type WhatsappStatus = "DISCONNECTED" | "AWAITING_SCAN" | "CONNECTED";

/** Per-shop sending controls. */
export interface WhatsappSettings {
  dailyLimit: number;
  sendDelayMs: number;
  sendJitterMs: number;
  windowStartHour: number;
  windowEndHour: number;
  autoOptOut: boolean;
}

export interface WhatsappSession {
  status: WhatsappStatus;
  phoneNumber: string | null;
  qrDataUrl: string | null;
  lastError: string | null;
  connectedAt: string | null;
  /** True only when a send would work right now. */
  canSend: boolean;
  transport: "log" | "webjs";
  sentToday: number;
  settings: WhatsappSettings;
  /** False while the clock is outside the shop's sending window. */
  withinWindow: boolean;
  windowLabel: string;
  /** Roughly how many messages the current pace manages in an hour. */
  estimatedPerHour: number;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  tag?: string | null;
  optedOut: boolean;
  optedOutAt?: string | null;
  source: "MANUAL" | "IMPORT";
  createdAt: string;
}

export interface ContactSummary {
  optedOut: number;
  tags: { tag: string; count: number }[];
}

export interface ImportResult {
  imported: number;
  updated: number;
  duplicatesInFile: number;
  skipped: number;
  totalRows: number;
  stillOptedOut: number;
  problems: { row: number; value: string; reason: string }[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** Placeholders a template body may use. */
export const TEMPLATE_VARIABLES = ["name", "business", "city", "phone"] as const;

export type CampaignStatus = "DRAFT" | "SENDING" | "PAUSED" | "COMPLETED" | "CANCELLED";

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Ready to send",
  SENDING: "Sending",
  PAUSED: "Paused",
  COMPLETED: "Finished",
  CANCELLED: "Cancelled",
};

export interface Campaign {
  id: string;
  name: string;
  body: string;
  templateId?: string | null;
  template?: { name: string } | null;
  status: CampaignStatus;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export type CampaignMessageStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export interface CampaignMessage {
  id: string;
  name: string;
  phone: string;
  body: string;
  status: CampaignMessageStatus;
  error?: string | null;
  sentAt?: string | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
