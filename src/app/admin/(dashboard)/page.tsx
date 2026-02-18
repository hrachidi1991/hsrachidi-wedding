'use client';

import { useEffect, useState } from 'react';

interface GroupData {
  id: string;
  groupCode: string;
  maxGuests: number;
  side: string;
  token: string;
  guests: any[];
  rsvpResponse: {
    attending: boolean;
    numberAttending: number;
    guestNames: string[];
    updatedAt: string;
  } | null;
}

export default function AdminDashboard() {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setGroups(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalGroups = groups.length;
  const totalMaxGuests = groups.reduce((s, g) => s + g.maxGuests, 0);
  const responded = groups.filter((g) => g.rsvpResponse);
  const attending = responded.filter((g) => g.rsvpResponse?.attending);
  const notAttending = responded.filter((g) => !g.rsvpResponse?.attending);
  const noResponse = groups.filter((g) => !g.rsvpResponse);
  const totalAttending = attending.reduce((s, g) => s + (g.rsvpResponse?.numberAttending || 0), 0);
  const brideGroups = groups.filter((g) => g.side === 'bride');
  const groomGroups = groups.filter((g) => g.side === 'groom');

  if (loading) {
    return <div className="p-8 text-gray-400">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Groups" value={totalGroups} color="blue" />
        <StatCard label="Max Capacity" value={totalMaxGuests} color="purple" />
        <StatCard label="Confirmed Attending" value={totalAttending} color="green" />
        <StatCard label="Response Rate" value={`${totalGroups > 0 ? Math.round((responded.length / totalGroups) * 100) : 0}%`} color="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Attending" value={attending.length} sub="groups" color="green" />
        <StatCard label="Not Attending" value={notAttending.length} sub="groups" color="red" />
        <StatCard label="No Response" value={noResponse.length} sub="groups" color="gray" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="Bride Side" value={brideGroups.length} sub="groups" color="pink" />
        <StatCard label="Groom Side" value={groomGroups.length} sub="groups" color="blue" />
      </div>

      {/* Recent RSVPs */}
      <div className="admin-card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent RSVPs</h2>
        {responded.length === 0 ? (
          <p className="text-gray-400 text-sm">No responses yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Group</th>
                  <th className="pb-2 font-medium">Side</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium"># Attending</th>
                  <th className="pb-2 font-medium">Names</th>
                </tr>
              </thead>
              <tbody>
                {responded.sort((a, b) =>
                  new Date(b.rsvpResponse!.updatedAt).getTime() - new Date(a.rsvpResponse!.updatedAt).getTime()
                ).slice(0, 10).map((g) => (
                  <tr key={g.id} className="border-b border-gray-50">
                    <td className="py-2 font-medium text-gray-800">{g.groupCode}</td>
                    <td className="py-2 capitalize text-gray-600">{g.side}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        g.rsvpResponse?.attending ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {g.rsvpResponse?.attending ? 'Attending' : 'Not Attending'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{g.rsvpResponse?.numberAttending || 0}</td>
                    <td className="py-2 text-gray-600">{(g.rsvpResponse?.guestNames as string[])?.join(', ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    gray: 'bg-gray-50 text-gray-600 border-gray-100',
    pink: 'bg-pink-50 text-pink-700 border-pink-100',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.gray}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">
        {value}
        {sub && <span className="text-xs font-normal ml-1 opacity-60">{sub}</span>}
      </p>
    </div>
  );
}
