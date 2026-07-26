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

export type ReviewChannel = "GOOGLE" | "INSTAGRAM" | "FACEBOOK";

export interface ReviewLinks {
  slug: string;
  googlePlaceId?: string | null;
  googleReviewUrl?: string | null;
  instagramUsername?: string | null;
  facebookPageUrl?: string | null;
  preferredReviewChannel?: ReviewChannel | null;
  resolved: Record<ReviewChannel, string | null>;
  scanCounts: Record<string, number>;
  totalScans: number;
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

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
