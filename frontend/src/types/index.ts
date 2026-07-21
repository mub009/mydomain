export type UserRole = "CUSTOMER" | "BUSINESS_OWNER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: string;
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
  isVerified?: boolean;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  status: string;
  category?: Category;
  categoryName?: string;
  categorySlug?: string;
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

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}
