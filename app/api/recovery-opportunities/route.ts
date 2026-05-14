import { createListHandler } from '@/lib/api/resource-handlers';

const resource = { tableName: 'recovery_opportunities' as const };

export const GET = createListHandler(resource);
