'use client';

import { useEffect, useState } from 'react';

interface GroupWithRsvp {
  id: string;
  groupCode: string;
  maxGuests: number;
  side: string;
  token: string;
  guests: { firstName: string; familyName: string; phone: string | null }[];
  rsvpResponse: {
    attending: boolean;
    numberAttending: number;
    guestNames: string[];
    language: string;
    updatedAt: string;
  } | null;
}

export default function RsvpTracking() {
  const [groups, setGroups] = useState<GroupWithRsvp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'attending' | 'not_attending' | 'no_response'>('all');
  const [sideFilter, setSideFilter] = useState<'all' | 'bride' | 'groom'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  const filtered = groups.filter((g) => {
    // Status filter
    if (filter === 'attending' && (!g.rsvpResponse || !g.rsvpResponse.attending)) return false;
    if (filter === 'not_attending' && (!g.rsvpResponse || g.rsvpResponse.attending)) return false;
    if (filter === 'no_response' && g.rsvpResponse) return false;

    // Side filter
    if (sideFilter !== 'all' && g.side !== sideFilter) return false;

    // Search
    if (search) {
      const s = search.toLowerCase();
      const match =
        g.groupCode.toLowerCase().includes(s) ||
        g.guests?.some((guest) => `${guest.firstName} ${guest.familyName}`.toLowerCase().includes(s) || guest.phone?.includes(s)) ||
        (g.rsvpResponse?.guestNames as string[])?.some((n) => n.toLowerCase().includes(s));
      if (!match) return false;
    }

    return true;
  });

  const exportCsv = () => {
    window.open('/api/export', '_blank');
  };

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  const totalAttending = filtered
    .filter((g) => g.rsvpResponse?.attending)
    .reduce((s, g) => s + (g.rsvpResponse?.numberAttending || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">RSVP Tracking</h1>
        <button onClick={exportCsv} className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">
          📥 Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{groups.length}</p>
          <p className="text-xs text-blue-500">Total Groups</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{totalAttending}</p>
          <p className="text-xs text-green-500">Total Attending</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{groups.filter((g) => g.rsvpResponse && !g.rsvpResponse.attending).length}</p>
          <p className="text-xs text-red-500">Not Attending</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-600">{groups.filter((g) => !g.rsvpResponse).length}</p>
          <p className="text-xs text-gray-400">No Response</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, group..."
          className="border rounded-md px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="border rounded-md px-3 py-2 text-sm">
          <option value="all">All Statuses</option>
          <option value="attending">Attending</option>
          <option value="not_attending">Not Attending</option>
          <option value="no_response">No Response</option>
        </select>
        <select value={sideFilter} onChange={(e) => setSideFilter(e.target.value as any)} className="border rounded-md px-3 py-2 text-sm">
          <option value="all">Both Sides</option>
          <option value="bride">Bride</option>
          <option value="groom">Groom</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Group Code</th>
                <th className="pb-2 font-medium">Side</th>
                <th className="pb-2 font-medium">Max</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium"># Att.</th>
                <th className="pb-2 font-medium">Guest Names (RSVP)</th>
                <th className="pb-2 font-medium">Registered Guests</th>
                <th className="pb-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 font-medium text-gray-800">{g.groupCode}</td>
                  <td className="py-2 capitalize text-gray-600">{g.side}</td>
                  <td className="py-2 text-gray-600">{g.maxGuests}</td>
                  <td className="py-2">
                    {g.rsvpResponse ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        g.rsvpResponse.attending ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {g.rsvpResponse.attending ? 'Attending' : 'Not Attending'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        No Response
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-gray-600">{g.rsvpResponse?.numberAttending || '-'}</td>
                  <td className="py-2 text-gray-600 text-xs">
                    {(g.rsvpResponse?.guestNames as string[])?.filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="py-2 text-gray-500 text-xs">
                    {g.guests?.map((guest) => `${guest.firstName} ${guest.familyName}`).join(', ') || '-'}
                  </td>
                  <td className="py-2 text-gray-400 text-xs">
                    {g.rsvpResponse?.updatedAt
                      ? new Date(g.rsvpResponse.updatedAt).toLocaleDateString()
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-gray-400 text-sm py-6 text-center">No results found.</p>
          )}
        </div>
        <div className="mt-4 text-xs text-gray-400">
          Showing {filtered.length} of {groups.length} groups
        </div>
      </div>
    </div>
  );
}
