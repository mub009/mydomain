import { describe, expect, it } from "vitest";
import { parsePagination } from "@/common/pagination";

describe("parsePagination", () => {
  it("defaults to page 1 and pageSize 20", () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 20, skip: 0, take: 20 });
  });

  it("computes skip/take from page and pageSize", () => {
    expect(parsePagination({ page: 3, pageSize: 10 })).toEqual({ page: 3, pageSize: 10, skip: 20, take: 10 });
  });

  it("caps pageSize at 50 and floors page at 1", () => {
    expect(parsePagination({ page: 0, pageSize: 500 })).toEqual({ page: 1, pageSize: 50, skip: 0, take: 50 });
  });
});
