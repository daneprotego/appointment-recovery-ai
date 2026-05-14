'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useOptimistic, useState, useTransition } from 'react';

import { deleteCustomerAction, saveCustomerAction } from '@/lib/dashboard/actions';
import { formatCurrency } from '@/lib/dashboard/format';
import type { DashboardCustomer } from '@/lib/dashboard/types';
import { EmptyState, LoadingRows, PaginationControls, SearchFilterBar, StatusBadge } from '@/components/dashboard/ui';
import { useToast } from '@/components/dashboard/toast';

const statuses = ['active', 'inactive', 'blocked'];
const pageSize = 8;

type Editing = DashboardCustomer | null;

export function CustomersManager({ customers }: Readonly<{ customers: DashboardCustomer[] }>) {
  const [records, removeOptimistic] = useOptimistic(customers, (state, id: string) => state.filter((record) => record.id !== id));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { notify } = useToast();
  const router = useRouter();
  const filtered = useMemo(() => records.filter((record) => `${record.fullName} ${record.phone} ${record.email}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || record.status === filter)), [records, search, filter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const closeForm = () => { setEditing(null); setIsCreating(false); };

  function deleteRecord(id: string) { startTransition(async () => { removeOptimistic(id); const formData = new FormData(); formData.set('id', id); try { await deleteCustomerAction(formData); notify('Customer deleted.'); router.refresh(); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to delete customer. Check linked appointments first.', 'error'); } }); }
  async function submit(formData: FormData) { try { await saveCustomerAction(formData); notify(`Customer ${formData.get('id') ? 'updated' : 'created'}.`); closeForm(); router.refresh(); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to save customer.', 'error'); } }

  return <div className="space-y-5"><SearchFilterBar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} filter={filter} onFilter={(value) => { setFilter(value); setPage(1); }} filterOptions={statuses} actionLabel="Add customer" onAction={() => setIsCreating(true)} />{filtered.length === 0 ? <EmptyState title="No customers found" description="Seeded onboarding data appears here. Add a customer to start scheduling and waitlist recovery." action={<button onClick={() => setIsCreating(true)} className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Add customer</button>} /> : <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Opt-ins</th><th className="px-6 py-4 text-right">No-shows</th><th className="px-6 py-4 text-right">Value</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>{isPending ? <LoadingRows columns={7} /> : <tbody className="divide-y divide-slate-100">{paged.map((customer) => <tr key={customer.id} className="hover:bg-slate-50"><td className="px-6 py-5"><p className="font-semibold">{customer.fullName}</p><p className="text-xs text-slate-500">{customer.notes}</p></td><td className="px-6 py-5 text-slate-600"><p>{customer.phone || 'No phone'}</p><p>{customer.email || 'No email'}</p></td><td className="px-6 py-5"><StatusBadge value={customer.status} /></td><td className="px-6 py-5 text-slate-600">SMS {customer.smsOptIn ? 'on' : 'off'} · Email {customer.emailOptIn ? 'on' : 'off'}</td><td className="px-6 py-5 text-right">{customer.noShowCount}</td><td className="px-6 py-5 text-right font-semibold">{formatCurrency(customer.lifetimeValueCents)}</td><td className="px-6 py-5 text-right"><button onClick={() => setEditing(customer)} className="font-semibold text-blue-600">Edit</button><button onClick={() => deleteRecord(customer.id)} className="ml-4 font-semibold text-rose-600">Delete</button></td></tr>)}</tbody>}</table></div><PaginationControls page={page} pageCount={pageCount} onPage={setPage} /></div>}{(isCreating || editing) && <CustomerForm customer={editing} onClose={closeForm} action={submit} />}</div>;
}

function CustomerForm({ customer, onClose, action }: Readonly<{ customer: Editing; onClose: () => void; action: (formData: FormData) => Promise<void> }>) {
  return <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/40 p-4 backdrop-blur"><form action={action} className="mx-auto mt-10 grid max-w-2xl gap-4 rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{customer ? 'Edit customer' : 'Add customer'}</h3><button type="button" onClick={onClose} className="text-slate-500">Close</button></div><input type="hidden" name="id" value={customer?.id ?? ''} /><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">First name<input name="firstName" defaultValue={customer?.firstName ?? ''} required className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Last name<input name="lastName" defaultValue={customer?.lastName ?? ''} required className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label></div><div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Phone<input name="phone" defaultValue={customer?.phone ?? ''} className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Email<input name="email" type="email" defaultValue={customer?.email ?? ''} className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label></div><div className="grid gap-4 md:grid-cols-3"><label className="grid gap-2 text-sm font-semibold">Status<select name="status" defaultValue={customer?.status ?? 'active'} className="rounded-2xl border border-slate-200 px-4 py-3 font-normal">{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">No-shows<input name="noShowCount" type="number" min="0" defaultValue={customer?.noShowCount ?? 0} className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Lifetime value<input name="lifetimeValue" type="number" min="0" defaultValue={customer ? customer.lifetimeValueCents / 100 : 0} className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label></div><div className="flex flex-wrap gap-4 text-sm"><label><input name="smsOptIn" type="checkbox" defaultChecked={customer?.smsOptIn ?? true} className="mr-2" />SMS opt-in</label><label><input name="emailOptIn" type="checkbox" defaultChecked={customer?.emailOptIn ?? true} className="mr-2" />Email opt-in</label></div><label className="grid gap-2 text-sm font-semibold">Notes<textarea name="notes" defaultValue={customer?.notes ?? ''} className="min-h-24 rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label><button className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Save customer</button></form></div>;
}
