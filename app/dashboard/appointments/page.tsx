const appointments = [
  { time: "9:00 AM", customer: "Avery Chen", service: "Dental cleaning", status: "Confirmed", risk: "Low", value: "$180" },
  { time: "10:30 AM", customer: "Marcus Reed", service: "Physical therapy", status: "Reminder sent", risk: "Medium", value: "$140" },
  { time: "1:00 PM", customer: "Priya Shah", service: "Consultation", status: "Needs reply", risk: "High", value: "$320" },
  { time: "3:30 PM", customer: "Jordan Kim", service: "Follow-up visit", status: "Reschedule offered", risk: "High", value: "$220" },
  { time: "4:45 PM", customer: "Sofia Garcia", service: "Wellness check", status: "Waitlist matched", risk: "Recovered", value: "$160" },
];

export default function AppointmentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Appointments</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Today&apos;s appointment recovery queue</h2>
          <p className="mt-2 text-slate-600">Demo data shows how reminders, reply triage, and waitlist recovery will appear.</p>
        </div>
        <button className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white">Add appointment</button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Service</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Risk</th>
                <th className="px-6 py-4 text-right">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((appointment) => (
                <tr key={`${appointment.time}-${appointment.customer}`} className="hover:bg-slate-50">
                  <td className="px-6 py-5 font-semibold">{appointment.time}</td>
                  <td className="px-6 py-5">{appointment.customer}</td>
                  <td className="px-6 py-5 text-slate-600">{appointment.service}</td>
                  <td className="px-6 py-5"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{appointment.status}</span></td>
                  <td className="px-6 py-5 text-slate-600">{appointment.risk}</td>
                  <td className="px-6 py-5 text-right font-semibold">{appointment.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
