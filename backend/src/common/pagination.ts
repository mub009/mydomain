export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export function parsePagination(query: Record<string, unknown>): { page: number; pageSize: number; skip: number; take: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
