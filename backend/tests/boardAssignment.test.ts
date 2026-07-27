import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { canAssignBoardTo } from "@/modules/reviewqr/qrcodes.service";

const OWNER = "owner-1";
const DEALER = "dealer-1";
const OTHER_DEALER = "dealer-2";

// A dealer registers a shop but does not own the listing — the login belongs
// to the business team. They still hand over the printed board, so they must
// be able to attach it.
const dealerRegistered = { ownerId: OWNER, createdById: DEALER };
const selfRegistered = { ownerId: OWNER, createdById: OWNER };

describe("canAssignBoardTo", () => {
  it("lets an owner attach a board to their own business", () => {
    expect(canAssignBoardTo({ sub: OWNER, role: UserRole.BUSINESS_OWNER }, selfRegistered)).toBe(true);
  });

  it("lets the dealer who registered a shop attach a board to it", () => {
    expect(canAssignBoardTo({ sub: DEALER, role: UserRole.DEALER }, dealerRegistered)).toBe(true);
  });

  it("stops a dealer attaching to a shop someone else registered", () => {
    expect(canAssignBoardTo({ sub: OTHER_DEALER, role: UserRole.DEALER }, dealerRegistered)).toBe(false);
  });

  it("stops an owner attaching to a business that is not theirs", () => {
    expect(canAssignBoardTo({ sub: "someone-else", role: UserRole.BUSINESS_OWNER }, selfRegistered)).toBe(false);
  });

  // A customer with a stolen board code must not be able to attach it, even to
  // a business they somehow created.
  it("never lets a plain customer attach a board", () => {
    expect(canAssignBoardTo({ sub: "cust-1", role: UserRole.CUSTOMER }, { ownerId: OWNER, createdById: "cust-1" })).toBe(
      false,
    );
  });

  it("lets an admin attach anywhere", () => {
    expect(canAssignBoardTo({ sub: "admin-1", role: UserRole.ADMIN }, dealerRegistered)).toBe(true);
  });

  // Legacy listings predate createdById; they must not become assignable by
  // any dealer just because the column is null.
  it("does not treat a missing creator as a match", () => {
    expect(canAssignBoardTo({ sub: DEALER, role: UserRole.DEALER }, { ownerId: OWNER, createdById: null })).toBe(false);
    expect(canAssignBoardTo({ sub: DEALER, role: UserRole.DEALER }, { ownerId: OWNER })).toBe(false);
  });
});
