import { z } from "zod";

export const SignupSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be 30 characters or less"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password min length is 5 char"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(5, "Password min length is 5 char"),
});

// +++  What SignupInput Means
// SignupInput is a dynamic TypeScript Type automatically generated from your Zod schema using z.infer.

//   Instead of writing out a duplicate TypeScript interface manually like this:

// TypeScript
// interface SignupInput {
//   username: string;
//   email: string;
//   password: string;
// }
// z.infer < typeof SignupSchema > extracts the exact TypeScript type directly from your validation rules.If you change a field in your Zod schema later, the TypeScript type updates everywhere across your project automatically.

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;