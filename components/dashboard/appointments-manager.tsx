'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useOptimistic, useState, useTransition } from 'react';

import { deleteAppointmentAction, saveAppointmentAction } from '@/lib/dashboard/actions';
import { formatCurrency, formatDateTime, toDatetimeLocalValue } from '@/lib/dashboard/format';
import type { DashboardAppointment, DashboardCustomer } from '@/lib/dashboard/types';
import { EmptyState, LoadingRows, PaginationControls, SearchFilterBar, StatusBadge } from '@/components/dashboard/ui';
import { useToast } from '@/components/dashboard/toast';

const statuses = ['scheduled', 'confirmed', 'cancelled', 'no_show', 'completed', 'rescheduled'];
const risks = ['low', 'medium', 'high', 'recovered'];
const pageSize = 6;

type Editing = DashboardAppointment | null;

export function AppointmentsManager({ appointments, customers }: Readonly<{ appointments: DashboardAppointment[]; customers: DashboardCustomer[] }>) {
  const [records, removeOptimistic] = useOptimistic(appointments, (state, id: string) => state.filter((record) => record.id !== id));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { notify } = useToast();
  const router = useRouter();

  const filtered = useMemo(() => records.filter((record) => {
    const text = `${record.customerName} ${record.serviceName} ${record.customerPhone}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (filter === 'all' || record.status === filter);
  }), [records, search, filter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  function closeForm() { setEditing(null); setIsCreating(false); }
  function deleteRecord(id: string) {
    startTransition(async () => {
      removeOptimistic(id);
      const formData = new FormData();
      formData.set('id', id);
      try { await deleteAppointmentAction(formData); notify('Appointment deleted.'); router.refresh(); } catch (error) { notify(error instanceof Error ? error.message : 'Unable to delete appointment.', 'error'); }
    });
  }

  async function submit(formData: FormData) {
    try { await saveAppointmentAction(formData); notify(`Appointment ${formData.get('id') ? 'updated' : 'created'}.`); closeForm(); router.refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : 'Unable to save appointment.', 'error'); }
  }

  return (
    <div className="space-y-5">
      <SearchFilterBar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} filter={filter} onFilter={(value) => { setFilter(value); setPage(1); }} filterOptions={statuses} actionLabel="Create appointment" onAction={() => setIsCreating(true)} />
      {filtered.length === 0 ? <EmptyState title="No appointments found" description="Create appointments or adjust your search and filters to manage the recovery queue." action={<button onClick={() => setIsCreating(true)} className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Create appointment</button>} /> : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-6 py-4">Time</th><th className="px-6 py-4">Customer</th><th className="px-6 py-4">Service</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Risk</th><th className="px-6 py-4 text-right">Value</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
              {isPending ? <LoadingRows columns={7} /> : <tbody className="divide-y divide-slate-100">{paged.map((appointment) => <tr key={appointment.id} className="hover:bg-slate-50"><td className="px-6 py-5 font-medium">{formatDateTime(appointment.startsAt)}</td><td className="px-6 py-5"><p className="font-semibold">{appointment.customerName}</p><p className="text-xs text-slate-500">{appointment.customerPhone}</p></td><td className="px-6 py-5 text-slate-700">{appointment.serviceName}</td><td className="px-6 py-5"><StatusBadge value={appointment.status} /></td><td className="px-6 py-5"><StatusBadge value={appointment.riskLevel} /></td><td className="px-6 py-5 text-right font-semibold">{formatCurrency(appointment.valueCents)}</td><td className="px-6 py-5 text-right"><button onClick={() => setEditing(appointment)} className="font-semibold text-blue-600">Edit</button><button onClick={() => deleteRecord(appointment.id)} className="ml-4 font-semibold text-rose-600">Delete</button></td></tr>)}</tbody>}
            </table>
          </div>
          <PaginationControls page={page} pageCount={pageCount} onPage={setPage} />
        </div>
      )}
      {(isCreating || editing) && <AppointmentForm appointment={editing} customers={customers} onClose={closeForm} action={submit} />}
    </div>
  );
}

function AppointmentForm({ appointment, customers, onClose, action }: Readonly<{ appointment: Editing; customers: DashboardCustomer[]; onClose: () => void; action: (formData: FormData) => Promise<void> }>) {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/40 p-4 backdrop-blur"><form action={action} className="mx-auto mt-10 grid max-w-2xl gap-4 rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{appointment ? 'Edit appointment' : 'Create appointment'}</h3><button type="button" onClick={onClose} className="text-slate-500">Close</button></div><input type="hidden" name="id" value={appointment?.id ?? ''} />
      <label className="grid gap-2 text-sm font-semibold">Customer<select name="customerId" defaultValue={appointment?.customerId ?? customers[0]?.id ?? ''} required className="rounded-2xl border border-slate-200 px-4 py-3 font-normal"><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.fullName}</option>)}</select></label>
      <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Service<input name="serviceName" defaultValue={appointment?.serviceName ?? ''} required className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Value<input name="value" type="number" min="0" step="1" defaultValue={appointment ? appointment.valueCents / 100 : 150} className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label></div>
      <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Starts<input name="startsAt" type="datetime-local" defaultValue={appointment ? toDatetimeLocalValue(appointment.startsAt) : ''} required className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Ends<input name="endsAt" type="datetime-local" defaultValue={appointment ? toDatetimeLocalValue(appointment.endsAt) : ''} className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label></div>
      <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Status<select name="status" defaultValue={appointment?.status ?? 'scheduled'} className="rounded-2xl border border-slate-200 px-4 py-3 font-normal">{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">Risk<select name="riskLevel" defaultValue={appointment?.riskLevel ?? 'low'} className="rounded-2xl border border-slate-200 px-4 py-3 font-normal">{risks.map((risk) => <option key={risk} value={risk}>{risk}</option>)}</select></label></div>
      <label className="grid gap-2 text-sm font-semibold">Cancellation reason<input name="cancellationReason" defaultValue={appointment?.cancellationReason ?? ''} className="rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold">Recovery notes<textarea name="recoveryNotes" defaultValue={appointment?.recoveryNotes ?? ''} className="min-h-24 rounded-2xl border border-slate-200 px-4 py-3 font-normal" /></label>
      <button className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Save appointment</button></form></div>
  );
}
