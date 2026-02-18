'use client';

import { useEffect, useState } from 'react';

interface Guest {
  id: string;
  firstName: string;
  familyName: string;
  phone: string | null;
  side: string;
  relation: string;
  groupCode: string;
}

interface Group {
  id: string;
  groupCode: string;
  maxGuests: number;
  token: string;
  side: string;
  guests: Guest[];
}

const RELATIONS = ['Wife', 'Husband', 'Fiancé', 'Sister', 'Brother', 'Friend', 'Boyfriend', 'Girlfriend', 'Mother', 'Father', 'Cousin', 'Uncle', 'Aunt', 'Colleague'];

export default function GuestsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'groups' | 'guests' | 'import'>('groups');
  
  // New group form
  const [newGroupCode, setNewGroupCode] = useState('');
  const [newGroupMax, setNewGroupMax] = useState(2);
  const [newGroupSide, setNewGroupSide] = useState('groom');
  
  // New guest form
  const [newGuest, setNewGuest] = useState({ firstName: '', familyName: '', phone: '', side: 'groom', relation: 'Friend', groupCode: '' });
  
  // CSV import
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState('');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const reload = async () => {
    const [groupRes, guestRes] = await Promise.all([
      fetch('/api/groups').then((r) => r.json()),
      fetch('/api/guests').then((r) => r.json()),
    ]);
    if (Array.isArray(groupRes)) setGroups(groupRes);
    if (Array.isArray(guestRes)) setGuests(guestRes);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const addGroup = async () => {
    if (!newGroupCode.trim()) return;
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupCode: newGroupCode, maxGuests: newGroupMax, side: newGroupSide }),
    });
    if (res.ok) {
      setNewGroupCode('');
      setNewGroupMax(2);
      reload();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to create group');
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm('Delete this group and its RSVP? Guests will remain.')) return;
    await fetch('/api/groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    reload();
  };

  const addGuest = async () => {
    if (!newGuest.firstName || !newGuest.familyName || !newGuest.groupCode) return;
    const res = await fetch('/api/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGuest),
    });
    if (res.ok) {
      setNewGuest({ firstName: '', familyName: '', phone: '', side: 'groom', relation: 'Friend', groupCode: '' });
      reload();
    }
  };

  const deleteGuest = async (id: string) => {
    if (!confirm('Delete this guest?')) return;
    await fetch('/api/guests', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    reload();
  };

  const handleImport = async () => {
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) { setImportResult('Need header + at least 1 row'); return; }
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const parsed = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.trim());
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return {
          firstName: obj.firstname || obj['first name'] || obj.first || '',
          familyName: obj.familyname || obj['family name'] || obj.family || obj.lastname || obj['last name'] || '',
          phone: obj.phone || '',
          side: obj.side || 'groom',
          relation: obj.relation || 'Friend',
          groupCode: obj.groupcode || obj['group code'] || obj.group || '',
          maxGuests: parseInt(obj.maxguests || obj['max guests'] || '2') || 2,
        };
      });
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: parsed }),
      });
      const data = await res.json();
      setImportResult(`Created ${data.created} guests and ${data.groupsCreated} new groups.`);
      reload();
    } catch (e: any) {
      setImportResult(`Error: ${e.message}`);
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(`${baseUrl}/?token=${token}`);
  };

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Guests & Groups</h1>

      <div className="flex gap-2 mb-6">
        {(['groups', 'guests', 'import'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm rounded-md transition capitalize ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            {tab === 'import' ? 'CSV Import' : tab}
          </button>
        ))}
      </div>

      {/* ═══ GROUPS TAB ═══ */}
      {activeTab === 'groups' && (
        <div>
          {/* Add group form */}
          <div className="admin-card mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Group</h3>
            <div className="flex gap-2 flex-wrap items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Group Code</label>
                <input type="text" value={newGroupCode} onChange={(e) => setNewGroupCode(e.target.value)} placeholder="e.g., RACHIDI-FAM" className="border rounded px-3 py-2 text-sm w-48" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Guests</label>
                <input type="number" value={newGroupMax} onChange={(e) => setNewGroupMax(parseInt(e.target.value) || 1)} min={1} max={20} className="border rounded px-3 py-2 text-sm w-24" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Side</label>
                <select value={newGroupSide} onChange={(e) => setNewGroupSide(e.target.value)} className="border rounded px-3 py-2 text-sm">
                  <option value="groom">Groom</option>
                  <option value="bride">Bride</option>
                </select>
              </div>
              <button onClick={addGroup} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                Create Group
              </button>
            </div>
          </div>

          {/* Groups list */}
          <div className="admin-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Group Code</th>
                    <th className="pb-2 font-medium">Side</th>
                    <th className="pb-2 font-medium">Max</th>
                    <th className="pb-2 font-medium">Guests</th>
                    <th className="pb-2 font-medium">RSVP Link</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-800">{g.groupCode}</td>
                      <td className="py-2 capitalize text-gray-600">{g.side}</td>
                      <td className="py-2 text-gray-600">{g.maxGuests}</td>
                      <td className="py-2 text-gray-600">{g.guests?.length || 0}</td>
                      <td className="py-2">
                        <button
                          onClick={() => copyLink(g.token)}
                          className="text-blue-600 hover:text-blue-800 text-xs underline"
                        >
                          Copy Link
                        </button>
                      </td>
                      <td className="py-2">
                        <button onClick={() => deleteGroup(g.id)} className="text-red-400 hover:text-red-600 text-xs">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {groups.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">No groups yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ GUESTS TAB ═══ */}
      {activeTab === 'guests' && (
        <div>
          {/* Add guest form */}
          <div className="admin-card mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Guest</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <input type="text" value={newGuest.firstName} onChange={(e) => setNewGuest({ ...newGuest, firstName: e.target.value })} placeholder="First Name" className="border rounded px-3 py-2 text-sm" />
              <input type="text" value={newGuest.familyName} onChange={(e) => setNewGuest({ ...newGuest, familyName: e.target.value })} placeholder="Family Name" className="border rounded px-3 py-2 text-sm" />
              <input type="text" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} placeholder="Phone" className="border rounded px-3 py-2 text-sm" />
              <select value={newGuest.side} onChange={(e) => setNewGuest({ ...newGuest, side: e.target.value })} className="border rounded px-3 py-2 text-sm">
                <option value="groom">Groom</option>
                <option value="bride">Bride</option>
              </select>
              <select value={newGuest.relation} onChange={(e) => setNewGuest({ ...newGuest, relation: e.target.value })} className="border rounded px-3 py-2 text-sm">
                {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="flex gap-2">
                <select value={newGuest.groupCode} onChange={(e) => setNewGuest({ ...newGuest, groupCode: e.target.value })} className="border rounded px-3 py-2 text-sm flex-1">
                  <option value="">Select Group...</option>
                  {groups.map((g) => <option key={g.id} value={g.groupCode}>{g.groupCode}</option>)}
                </select>
                <button onClick={addGuest} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 whitespace-nowrap">
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Guests list */}
          <div className="admin-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Phone</th>
                    <th className="pb-2 font-medium">Side</th>
                    <th className="pb-2 font-medium">Relation</th>
                    <th className="pb-2 font-medium">Group</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-800">{g.firstName} {g.familyName}</td>
                      <td className="py-2 text-gray-600">{g.phone || '-'}</td>
                      <td className="py-2 capitalize text-gray-600">{g.side}</td>
                      <td className="py-2 text-gray-600">{g.relation}</td>
                      <td className="py-2 text-gray-600">{g.groupCode}</td>
                      <td className="py-2">
                        <button onClick={() => deleteGuest(g.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {guests.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">No guests yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CSV IMPORT TAB ═══ */}
      {activeTab === 'import' && (
        <div className="admin-card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Import Guests from CSV</h3>
          <p className="text-xs text-gray-500 mb-3">
            Format: <code className="bg-gray-100 px-1 rounded">firstName,familyName,phone,side,relation,groupCode,maxGuests</code>
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={10}
            placeholder={`firstName,familyName,phone,side,relation,groupCode,maxGuests\nHussein,Rachidi,81538385,groom,Groom,RACHIDI-FAM,4\nSuzan,Rachidi,,bride,Bride,RACHIDI-FAM,4`}
            className="w-full border rounded-md px-3 py-2 text-sm font-mono mb-3"
          />
          <div className="flex items-center gap-3">
            <button onClick={handleImport} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
              Import
            </button>
            {importResult && <p className="text-sm text-green-600">{importResult}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
