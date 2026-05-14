import { createCreateHandler, createListHandler } from '@/lib/api/resource-handlers';

const resource = { tableName: 'businesses' as const, businessScoped: false };

export const GET = createListHandler(resource);
export const POST = createCreateHandler(resource);
