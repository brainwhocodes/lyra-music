import { z } from 'zod';

export const scanDirectoryJobPayloadSchema = z.object({
  scanId: z.string().min(1),
  userId: z.string().min(1),
  rootPath: z.string().min(1),
  allowedRoots: z.array(z.string().min(1)).min(1),
  options: z.object({
    maxDepth: z.number().int().positive().optional(),
    maxFiles: z.number().int().positive().optional(),
    ignoreDirectories: z.array(z.string()).default([]),
    ignoreExtensions: z.array(z.string()).default([]),
  }).default({}),
});

export const jobPayloadByTypeSchema = {
  'scan.directory': scanDirectoryJobPayloadSchema,
} as const;

export type JobType = keyof typeof jobPayloadByTypeSchema;
export type ScanDirectoryJobPayload = z.infer<typeof scanDirectoryJobPayloadSchema>;

export type JobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface EnqueueJobInput<T extends JobType> {
  type: T;
  payload: z.infer<(typeof jobPayloadByTypeSchema)[T]>;
  maxAttempts?: number;
  runAfterEpochSeconds?: number;
}

export function parsePayloadByType<T extends JobType>(type: T, payload: unknown): z.infer<(typeof jobPayloadByTypeSchema)[T]> {
  return jobPayloadByTypeSchema[type].parse(payload);
}
