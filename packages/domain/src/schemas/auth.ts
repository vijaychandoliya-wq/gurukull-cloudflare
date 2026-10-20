import { z } from 'zod';

export const UserTypeEnum = z.enum([
  'superadmin',
  'admin',
  'teacher',
  'parent',
  'student',
  'staff',
]);

export type UserType = z.infer<typeof UserTypeEnum>;

export const TeacherLoginInputSchema = z.object({
  email: z.string().email().optional(),
  mobile: z.string().min(10).max(15).optional(),
  password: z.string().min(4),
  schoolCode: z.string().min(2).optional(),
}).refine((data) => data.email || data.mobile, {
  message: 'Either email or mobile number must be provided for teacher login',
});

export type TeacherLoginInput = z.infer<typeof TeacherLoginInputSchema>;

export const ParentLoginInputSchema = z.object({
  mobile: z.string().min(10).max(15),
  password: z.string().min(4),
  schoolCode: z.string().min(2).optional(),
});

export type ParentLoginInput = z.infer<typeof ParentLoginInputSchema>;

export const TokenPayloadSchema = z.object({
  sub: z.string(), // user_id
  schoolId: z.string(),
  schoolCode: z.string(),
  userType: UserTypeEnum,
  fullName: z.string(),
  iat: z.number(),
  exp: z.number(),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;
