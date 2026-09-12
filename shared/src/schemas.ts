import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
export type LoginValues = z.infer<typeof loginSchema>;

/** The respondent-capture screen's own fields — separate from whatever the
 * survey's own metadata questions ask, per docs/guides/AGENT_MOBILE_GUIDE.md
 * ("phone number first, then whatever the tenant configured"). */
export const respondentDraftSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(6, "Enter a phone number.")
    .regex(/^\+?[0-9 ]+$/, "Digits only."),
  full_name: z.string().trim().min(1, "Enter a name.").optional().or(z.literal("")),
  geography_node: z.string().uuid().optional(),
});
export type RespondentDraftValues = z.infer<typeof respondentDraftSchema>;

export const consentCaptureSchema = z.object({
  notice_id: z.string().uuid(),
  language: z.string().min(2),
  method: z.enum(["verbal_confirmed", "signature", "photo"]),
  granted_at: z.string().datetime().optional(),
});
export type ConsentCaptureValues = z.infer<typeof consentCaptureSchema>;
