export function EmptyState({ title, description, action }: Readonly<{ title: string; description: string; action?: React.ReactNode }>) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">＋</div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingRows({ columns = 6 }: Readonly<{ columns?: number }>) {
  return (
    <tbody className="divide-y divide-slate-100">
      {Array.from({ length: 5 }).map((_, row) => (
        <tr key={row}>
          {Array.from({ length: columns }).map((__, column) => (
            <td key={column} className="px-6 py-5"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function StatusBadge({ value }: Readonly<{ value: string }>) {
  const normalized = value.toLowerCase();
  const color = normalized.includes('recover') || normalized.includes('book') || normalized.includes('confirm')
    ? 'bg-emerald-50 text-emerald-700'
    : normalized.includes('cancel') || normalized.includes('lost') || normalized.includes('blocked') || normalized.includes('urgent')
      ? 'bg-rose-50 text-rose-700'
      : normalized.includes('high') || normalized.includes('contact') || normalized.includes('notified')
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${color}`}>{value.replaceAll('_', ' ')}</span>;
}

export function PaginationControls({ page, pageCount, onPage }: Readonly<{ page: number; pageCount: number; onPage: (page: number) => void }>) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-600 sm:flex-row">
      <span>Page {page} of {Math.max(pageCount, 1)}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} className="rounded-full border border-slate-200 px-4 py-2 font-semibold disabled:opacity-40">Previous</button>
        <button type="button" onClick={() => onPage(Math.min(pageCount, page + 1))} disabled={page >= pageCount} className="rounded-full border border-slate-200 px-4 py-2 font-semibold disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

export function SearchFilterBar({ search, onSearch, filter, onFilter, filterOptions, actionLabel, onAction }: Readonly<{ search: string; onSearch: (value: string) => void; filter: string; onFilter: (value: string) => void; filterOptions: string[]; actionLabel: string; onAction: () => void }>) {
  return (
    <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_220px_auto]">
      <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search records..." className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" />
      <select value={filter} onChange={(event) => onFilter(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm capitalize outline-none focus:border-blue-500">
        <option value="all">All statuses</option>
        {filterOptions.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
      </select>
      <button type="button" onClick={onAction} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">{actionLabel}</button>
    </div>
  );
}
