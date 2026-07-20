import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { searchQuerySchema } from "./search.validation";
import { popularCitiesHandler, searchHandler } from "./search.controller";

export const searchRouter = Router();

searchRouter.get("/cities", asyncHandler(popularCitiesHandler));
searchRouter.get("/", validate({ query: searchQuerySchema }), asyncHandler(searchHandler));
