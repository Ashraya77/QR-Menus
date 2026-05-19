import { z } from "zod";

/**
 * Register Schema
 */
export const registerSchema = z
  .object({
    name: z.string().min(1, "Name is required").trim(),

    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email")
      .trim()
      .toLowerCase(),

    phoneNumber: z
      .string()
      .min(1, "Phone number is required")
      .trim(),

    dob: z.string().min(1, "Date of birth is required"),

    age: z.coerce
      .number()
      .min(1, "Invalid age"),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),

    confirmPassword: z
      .string()
      .min(1, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Login Schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email")
    .trim()
    .toLowerCase(),

  password: z
    .string()
    .min(1, "Password is required"),
});

/**
 * User Schema
 */
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  systemRole: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]),
});

/**
 * Tenant Schema
 */
export const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  qrUrl: z.string().url(),
  role: z.enum([
    "OWNER",
    "ADMIN",
    "MANAGER",
    "STAFF",
  ]),
  status: z.enum([
    "ACTIVE",
    "INACTIVE",
    "SUSPENDED",
  ]),
});

/**
 * Login Response Schema
 */
export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),

  user: userSchema,

  tenants: z.array(tenantSchema),
});

/**
 * Types
 */
export type RegisterFormValues = z.infer<typeof registerSchema>;

export type LoginFormValues = z.infer<typeof loginSchema>;

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export type User = z.infer<typeof userSchema>;

export type Tenant = z.infer<typeof tenantSchema>;