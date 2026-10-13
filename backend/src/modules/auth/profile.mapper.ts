import { Profile } from '@prisma/client';

export const toProfile = (p: Profile) => ({
  id: p.id,
  email: p.email,
  fullName: p.fullName,
  phoneNumber: p.phone,
  role: p.role,
  avatarUrl: p.avatarUrl ?? undefined,
  createdAt: p.createdAt,
});
