import { z } from "zod";

const uuid = z.string().uuid();
const email = z.string().email().transform((s) => s.trim().toLowerCase());
const nonEmpty = z.string().trim().min(1);

export const PERM_SECTIONS = [
  "dashboard", "network", "devices", "threats",
  "vulnerabilities", "logs", "ai_analysis", "reports", "settings",
] as const;

export const PERM_LEVELS = ["none", "view", "full"] as const;
export const ROLES = ["admin", "normal", "guest"] as const;
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const PermissionsMap = z
  .record(z.enum(PERM_SECTIONS), z.enum(PERM_LEVELS))
  .optional();

export const GenerateReportSchema = z.object({
  type: z.string().trim().min(1).max(64).default("custom"),
  jobId: uuid,
}).strict();
export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;

export const SendReportSchema = z.object({
  report_id: uuid,
  recipients: z.array(email).min(1).max(25),
}).strict();
export type SendReportInput = z.infer<typeof SendReportSchema>;

const ChatMessage = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(8000),
}).strict();

export const AnalyzeSchema = z.object({
  messages: z.array(ChatMessage).max(40).optional(),
}).strict();
export type AnalyzeInput = z.infer<typeof AnalyzeSchema>;

export const ScanChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
}).strict();
export type ScanChatInput = z.infer<typeof ScanChatSchema>;

export const CreateUserSchema = z.object({
  email,
  full_name: nonEmpty.max(120),
  role: z.enum(ROLES).default("normal"),
  password: z.string().min(6).max(128).optional(),
  permissions: PermissionsMap,
}).strict();
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  user_id: uuid,
  full_name: nonEmpty.max(120).optional(),
  role: z.enum(ROLES).optional(),
  permissions: PermissionsMap,
}).strict();
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const UserStatusSchema = z.object({
  user_id: uuid,
  is_active: z.boolean(),
}).strict();
export type UserStatusInput = z.infer<typeof UserStatusSchema>;

export const DeleteUserSchema = z.object({
  user_id: uuid,
}).strict();
export type DeleteUserInput = z.infer<typeof DeleteUserSchema>;

export const ThreatNotificationSchema = z.object({
  userId: uuid,
  threatId: uuid.optional(),
  severity: z.enum(SEVERITIES),
  type: nonEmpty.max(120).optional(),
  source: z.string().trim().max(256).optional(),
  description: z.string().trim().max(2000).optional(),
}).strict();
export type ThreatNotificationInput = z.infer<typeof ThreatNotificationSchema>;

export const VulnNotificationSchema = z.object({
  userId: uuid,
  name: nonEmpty.max(200).optional(),
  cve: z.string().trim().max(64).optional(),
  cvss: z.coerce.number().min(0).max(10).optional(),
  affected: z.string().trim().max(256).optional(),
  description: z.string().trim().max(2000).optional(),
  recommendation: z.string().trim().max(2000).optional(),
}).strict();
export type VulnNotificationInput = z.infer<typeof VulnNotificationSchema>;
