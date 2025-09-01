const allRoles = {
  USER: [] as const,
  ADMIN: ['getUsers', 'manageUsers'] as const,
} as const;

export const roles = Object.keys(allRoles) as Array<keyof typeof allRoles>;
export const roleRights = new Map(Object.entries(allRoles));

export type Role = keyof typeof allRoles;
export type Permission = (typeof allRoles)[keyof typeof allRoles][number];
