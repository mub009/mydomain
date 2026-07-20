import { z } from "zod";

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(150).optional(),
  comment: z.string().max(2000).optional(),
});

export const replyReviewSchema = z.object({
  ownerReply: z.string().min(1).max(1000),
});
