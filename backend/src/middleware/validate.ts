import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

interface Schemas {
  body?: AnyZodObject;
  query?: AnyZodObject;
  params?: AnyZodObject;
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) req.query = schemas.query.parse(req.query) as unknown as typeof req.query;
    if (schemas.params) req.params = schemas.params.parse(req.params) as unknown as typeof req.params;
    next();
  };
}
