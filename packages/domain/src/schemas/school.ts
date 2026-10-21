import { z } from 'zod';

export const SchoolStatusEnum = z.enum([
  'requested',
  'validated',
  'reserved',
  'configuration_needed',
  'administrator_pending',
  'verified',
  'active',
  'suspended',
  'archived',
]);

export type SchoolStatus = z.infer<typeof SchoolStatusEnum>;

export const SchoolSchema = z.object({
  id: z.string().min(1),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'School code must be uppercase alphanumeric'),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(2).max(100),
  status: SchoolStatusEnum,
  timezone: z.string(),
  currency: z.string(),
  logoR2Key: z.string().nullable().optional(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export type School = z.infer<typeof SchoolSchema>;

export const CreateSchoolInputSchema = z.object({
  name: z.string().min(2).max(100),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'School code must be uppercase alphanumeric'),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  timezone: z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid timezone'),
  currency: z.literal('INR'),
  address: z.string().trim().max(500).optional(),
});

export type CreateSchoolInput = z.infer<typeof CreateSchoolInputSchema>;
