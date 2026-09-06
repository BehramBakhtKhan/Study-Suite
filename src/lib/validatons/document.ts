import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  filePath: z.string().min(1, "File path is required"),
  extractedText: z.string().min(1, "Extracted text cannot be empty"),
  summary: z.string().optional(),
});