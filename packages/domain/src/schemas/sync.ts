import { z } from 'zod';

export const SyncCommandKindEnum = z.enum([
  'ATTENDANCE_RECORD',
  'MARK_ENTRY',
  'HOMEWORK_DRAFT',
  'NOTICE_DRAFT',
  'FILE_ATTACH',
]);

export const SyncCommandSchema = z.object({
  command_id: z.string().uuid(),
  kind: SyncCommandKindEnum,
  entity_id: z.string().optional(),
  base_version: z.number().int().nonnegative().optional(),
  payload: z.record(z.any()),
  payload_hash: z.string().min(16),
});

export type SyncCommand = z.infer<typeof SyncCommandSchema>;

export const SyncPushRequestSchema = z.object({
  commands: z.array(SyncCommandSchema).min(1).max(50),
});

export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncCommandResultSchema = z.object({
  command_id: z.string().uuid(),
  status: z.enum(['accepted', 'rejected', 'conflict']),
  entity_id: z.string().optional(),
  version: z.number().int().positive().optional(),
  error: z.string().optional(),
  conflict_details: z
    .object({
      server_version: z.number().int(),
      message: z.string(),
    })
    .optional(),
});

export type SyncCommandResult = z.infer<typeof SyncCommandResultSchema>;

export const SyncPushResponseSchema = z.object({
  status: z.enum(['success', 'partial', 'failed']),
  results: z.array(SyncCommandResultSchema),
  timestamp: z.number().int(),
});

export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;

export const DeviceRegisterRequestSchema = z.object({
  installation_id: z.string().min(8),
  platform: z.enum(['android', 'ios', 'web']),
  app_version: z.string().min(1),
  fcm_token: z.string().min(10),
  preferences: z.record(z.any()).optional(),
});

export type DeviceRegisterRequest = z.infer<typeof DeviceRegisterRequestSchema>;
