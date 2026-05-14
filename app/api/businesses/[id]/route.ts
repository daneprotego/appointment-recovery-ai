import { createDeleteByIdHandler, createGetByIdHandler, createUpdateByIdHandler } from '@/lib/api/resource-handlers';

const resource = {
  tableName: 'businesses' as const,
  businessScopeColumn: 'id' as const,
  updateRoles: ['owner', 'admin'] as const,
  deleteRoles: ['owner'] as const,
};

export const GET = createGetByIdHandler(resource);
export const PATCH = createUpdateByIdHandler(resource);
export const DELETE = createDeleteByIdHandler(resource);
