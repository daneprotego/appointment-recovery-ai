import type { UserRole } from '@/lib/types/database';

export const userRoles = ['owner', 'admin', 'staff'] as const satisfies readonly UserRole[];

const roleRank: Record<UserRole, number> = {
  staff: 1,
  admin: 2,
  owner: 3,
};

export function isUserRole(value: string | null | undefined): value is UserRole {
  return userRoles.includes(value as UserRole);
}

export function hasRole(required: UserRole | readonly UserRole[], actual: UserRole) {
  const allowedRoles = Array.isArray(required) ? required : [required];

  return allowedRoles.includes(actual);
}

export function hasMinimumRole(minimumRole: UserRole, actual: UserRole) {
  return roleRank[actual] >= roleRank[minimumRole];
}
