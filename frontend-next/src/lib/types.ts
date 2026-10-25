// Trimmed to what the public, crawlable pages need — mirrors (and must stay
// in sync with) frontend/src/types/index.ts, the source of truth for the
// full app. Fields the SPA-only screens use (auth, dashboards, admin) are
// deliberately left out here.

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

export interface Business {
  id: string;
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
  isVerified?: boolean;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  status: string;
  businessType?: "B2C" | "B2B";
  category?: Category;
  categoryName?: string;
  categorySlug?: string;
  photoUrl?: string | null;
  distanceKm?: number | null;
  photos?: Array<{ id: string; url: string; caption?: string | null }>;
  hours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>;
  services?: Service[];
  reviews?: Review[];
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
