import { NextResponse, type NextRequest } from 'next/server';

import { requireApiAuth } from '@/lib/auth/api';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { TableName, UserRole } from '@/lib/types/database';

interface ResourceOptions {
  tableName: TableName;
  businessScopeColumn?: 'business_id' | 'id' | null;
  createRoles?: readonly UserRole[];
  updateRoles?: readonly UserRole[];
  deleteRoles?: readonly UserRole[];
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withBusinessScope(payload: unknown, businessId: string, businessScopeColumn: 'business_id' | 'id' | null): Record<string, unknown> {
  if (businessScopeColumn !== 'business_id') {
    return isRecord(payload) ? payload : {};
  }

  if (!isRecord(payload)) {
    return { business_id: businessId };
  }

  return {
    ...payload,
    business_id: businessId,
  };
}

export function createListHandler({ tableName, businessScopeColumn = 'business_id' }: ResourceOptions) {
  return async function GET(request: NextRequest) {
    const auth = await requireApiAuth(request);

    if (!auth.ok) {
      return auth.response;
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase.from(tableName).select('*').order('created_at', { ascending: false });

    if (businessScopeColumn) {
      query = query.eq(businessScopeColumn, auth.context.businessId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  };
}

export function createCreateHandler({ tableName, businessScopeColumn = 'business_id', createRoles }: ResourceOptions) {
  return async function POST(request: NextRequest) {
    const auth = await requireApiAuth(request, createRoles);

    if (!auth.ok) {
      return auth.response;
    }

    const payload = await request.json();
    const insertPayload = withBusinessScope(payload, auth.context.businessId, businessScopeColumn);
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.from(tableName).insert(insertPayload).select('*').single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  };
}

export function createGetByIdHandler({ tableName, businessScopeColumn = 'business_id' }: ResourceOptions) {
  return async function GET(request: NextRequest, context: RouteContext) {
    const auth = await requireApiAuth(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();
    let query = supabase.from(tableName).select('*').eq('id', id);

    if (businessScopeColumn) {
      query = query.eq(businessScopeColumn, auth.context.businessId);
    }

    const { data, error } = await query.single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ data });
  };
}

export function createUpdateByIdHandler({ tableName, businessScopeColumn = 'business_id', updateRoles }: ResourceOptions) {
  return async function PATCH(request: NextRequest, context: RouteContext) {
    const auth = await requireApiAuth(request, updateRoles);

    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const payload = await request.json();
    const supabase = getSupabaseAdminClient();
    let query = supabase.from(tableName).update(payload).eq('id', id);

    if (businessScopeColumn) {
      query = query.eq(businessScopeColumn, auth.context.businessId);
    }

    const { data, error } = await query.select('*').single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  };
}

export function createDeleteByIdHandler({ tableName, businessScopeColumn = 'business_id', deleteRoles }: ResourceOptions) {
  return async function DELETE(request: NextRequest, context: RouteContext) {
    const auth = await requireApiAuth(request, deleteRoles);

    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdminClient();
    let query = supabase.from(tableName).delete().eq('id', id);

    if (businessScopeColumn) {
      query = query.eq(businessScopeColumn, auth.context.businessId);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: { id } });
  };
}
