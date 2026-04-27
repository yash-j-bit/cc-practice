import { z } from "zod";
import { ValidationError } from "../errors/index.js";

export function parse<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => i.message).join("; "),
    );
  }
  return result.data;
}
