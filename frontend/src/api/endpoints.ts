import { api } from "./client";
import {
  AdminUser,
  ApiResponse,
  AuthResponse,
  Booking,
  Business,
  Category,
  Lead,
  PaginatedResponse,
  PointsBalance,
  PointTransaction,
  PopularCity,
  Review,
  Rfq,
  UserRole,
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
  mine: () => api.get<ApiResponse<Business[]>>("/businesses/mine").then((r) => r.data.data),
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
};

export const reviewsApi = {
  list: (businessId: string) => api.get<PaginatedResponse<Review>>(`/businesses/${businessId}/reviews`).then((r) => r.data),
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
