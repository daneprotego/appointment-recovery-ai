import { createDeleteByIdHandler, createGetByIdHandler, createUpdateByIdHandler } from '@/lib/api/resource-handlers';

const resource = { tableName: 'recovery_opportunities' as const };

export const GET = createGetByIdHandler(resource);
export const PATCH = createUpdateByIdHandler(resource);
export const DELETE = createDeleteByIdHandler(resource);
