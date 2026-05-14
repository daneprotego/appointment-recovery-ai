import { createCreateHandler, createListHandler } from '@/lib/api/resource-handlers';

const resource = { tableName: 'customers' as const };

export const GET = createListHandler(resource);
export const POST = createCreateHandler(resource);
