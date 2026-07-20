import { Router } from "express";
import { asyncHandler } from "@/common/asyncHandler";
import { validate } from "@/middleware/validate";
import { searchQuerySchema } from "./search.validation";
import { searchHandler } from "./search.controller";

export const searchRouter = Router();

searchRouter.get("/", validate({ query: searchQuerySchema }), asyncHandler(searchHandler));
