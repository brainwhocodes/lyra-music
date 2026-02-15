import { z } from 'zod';

export const startScanSchema = z.object({
  libraryId: z.string().min(1),
  options: z.object({
    maxDepth: z.number().int().positive().optional(),
    maxFiles: z.number().int().positive().optional(),
    ignoreDirectories: z.array(z.string()).default([]),
    ignoreExtensions: z.array(z.string()).default([]),
  }).default({}),
});

export const walkOptionsSchema = z.object({
  ignoreDirectories: z.array(z.string()).default([]),
  ignoreExtensions: z.array(z.string()).default([]),
  maxDepth: z.number().int().positive().optional(),
  maxFiles: z.number().int().positive().optional(),
});

export type WalkOptions = z.infer<typeof walkOptionsSchema>;
