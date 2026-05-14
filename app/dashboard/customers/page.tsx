const customers = [
  { name: "Avery Chen", phone: "+1 (555) 014-8821", lastVisit: "May 12", preference: "SMS", lifetimeValue: "$1,240", waitlist: "No" },
  { name: "Marcus Reed", phone: "+1 (555) 018-4430", lastVisit: "May 8", preference: "SMS", lifetimeValue: "$880", waitlist: "Yes" },
  { name: "Priya Shah", phone: "+1 (555) 011-9284", lastVisit: "Apr 29", preference: "Email + SMS", lifetimeValue: "$2,450", waitlist: "No" },
  { name: "Jordan Kim", phone: "+1 (555) 017-3329", lastVisit: "Apr 18", preference: "SMS", lifetimeValue: "$760", waitlist: "Yes" },
  { name: "Sofia Garcia", phone: "+1 (555) 013-1099", lastVisit: "May 3", preference: "SMS", lifetimeValue: "$1,080", waitlist: "Yes" },
];

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Customers</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Customer recovery profiles</h2>
          <p className="mt-2 text-slate-600">Track contact preferences, value, and waitlist availability for faster slot recovery.</p>
        </div>
        <button className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Add customer</button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Last visit</th>
                <th className="px-6 py-4">Preference</th>
                <th className="px-6 py-4">Waitlist</th>
                <th className="px-6 py-4 text-right">Lifetime value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((customer) => (
                <tr key={customer.phone} className="hover:bg-slate-50">
                  <td className="px-6 py-5 font-semibold">{customer.name}</td>
                  <td className="px-6 py-5 text-slate-600">{customer.phone}</td>
                  <td className="px-6 py-5 text-slate-600">{customer.lastVisit}</td>
                  <td className="px-6 py-5">{customer.preference}</td>
                  <td className="px-6 py-5"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{customer.waitlist}</span></td>
                  <td className="px-6 py-5 text-right font-semibold">{customer.lifetimeValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
