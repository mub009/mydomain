import { Request, Response } from "express";
import { ok, paginated } from "@/common/apiResponse";
import * as searchService from "./search.service";
import { SearchQuery } from "./search.validation";

export async function searchHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as SearchQuery;
  const { items, total, page, pageSize } = await searchService.searchBusinesses(query);
  paginated(res, items, { page, pageSize, total });
}

export async function popularCitiesHandler(_req: Request, res: Response): Promise<void> {
  ok(res, await searchService.listPopularCities());
}
