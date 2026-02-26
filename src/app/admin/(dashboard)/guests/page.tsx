'use client';

import { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface Guest {
  id: string;
  name: string;
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

function formatPhoneForWhatsApp(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, '');
  // Handle 00 prefix → +
  if (p.startsWith('00')) p = '+' + p.slice(2);
  // Handle leading 0 (Lebanon local) → +961
  if (p.startsWith('0') && !p.startsWith('+')) p = '+961' + p.slice(1);
  // If no + prefix and looks like a local number (7-8 digits), prepend +961
  if (!p.startsWith('+') && p.length <= 8) p = '+961' + p;
  // If no + prefix but already has country code length, just add +
  if (!p.startsWith('+')) p = '+' + p;
  return p.replace('+', '');
}

function getWhatsAppUrl(phone: string, rsvpLink: string): string {
  const formatted = formatPhoneForWhatsApp(phone);
  const text = encodeURIComponent(rsvpLink);
  return `https://wa.me/${formatted}?text=${text}`;
}

const WhatsAppIcon = ({ phone, rsvpLink }: { phone: string; rsvpLink: string }) => (
  <a
    href={getWhatsAppUrl(phone, rsvpLink)}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center text-green-500 hover:text-green-600 transition-colors"
    title={`Send RSVP link via WhatsApp to ${phone}`}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  </a>
);

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
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', side: 'groom', relation: 'Friend', groupCode: '' });
  
  // CSV/Excel import
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!newGuest.name || !newGuest.groupCode) return;
    const res = await fetch('/api/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGuest),
    });
    if (res.ok) {
      setNewGuest({ name: '', phone: '', side: 'groom', relation: 'Friend', groupCode: '' });
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

  // Shared import logic — processes rows from CSV or Excel
  const processImportRows = async (headers: string[], rows: Record<string, string>[]) => {
    const hasNewFormat = headers.includes('s') && headers.includes('gt') && headers.includes('group #');

    if (hasNewFormat) {
      const guestRows = rows.map((obj: any) => {
        const s = (obj['s'] || '').toUpperCase();
        const gt = (obj['gt'] || '').toUpperCase();
        const groupNum = (obj['group #'] || '').trim();
        const groupCode = `${s}${gt}${groupNum}`;
        const side = s === 'B' ? 'bride' : 'groom';
        return {
          name: obj['name'] || '',
          phone: obj['phone number'] || obj['phone'] || '',
          side,
          relation: 'Friend',
          groupCode,
        };
      }).filter((g: any) => g.name && g.groupCode);

      const groupCounts: Record<string, number> = {};
      guestRows.forEach((g: any) => { groupCounts[g.groupCode] = (groupCounts[g.groupCode] || 0) + 1; });

      const parsed = guestRows.map((g: any) => ({
        ...g,
        maxGuests: groupCounts[g.groupCode],
      }));

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: parsed }),
      });
      const data = await res.json();
      return `Created ${data.created} guests and ${data.groupsCreated} new groups.`;
    } else {
      const parsed = rows.map((obj: any) => ({
        name: obj.name || obj.firstname || obj['first name'] || '',
        phone: obj.phone || obj['phone number'] || '',
        side: obj.side || 'groom',
        relation: obj.relation || 'Friend',
        groupCode: obj.groupcode || obj['group code'] || obj.group || '',
        maxGuests: parseInt(obj.maxguests || obj['max guests'] || '2') || 2,
      }));
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: parsed }),
      });
      const data = await res.json();
      return `Created ${data.created} guests and ${data.groupsCreated} new groups.`;
    }
  };

  const handleImport = async () => {
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) { setImportResult('Need header + at least 1 row'); return; }
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.trim());
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return obj;
      });
      const result = await processImportRows(headers, rows);
      setImportResult(result);
      reload();
    } catch (e: any) {
      setImportResult(`Error: ${e.message}`);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult('');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      // Get raw rows as arrays to read headers
      const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (rawRows.length < 2) { setImportResult('Excel file needs header + at least 1 row'); return; }

      const headers = rawRows[0].map((h: any) => String(h).trim().toLowerCase());
      const rows = rawRows.slice(1)
        .filter((row: any[]) => row.some((cell: any) => String(cell).trim() !== ''))
        .map((row: any[]) => {
          const obj: Record<string, string> = {};
          headers.forEach((h: string, i: number) => { obj[h] = String(row[i] ?? '').trim(); });
          return obj;
        });

      const result = await processImportRows(headers, rows);
      setImportResult(result);
      reload();
    } catch (err: any) {
      setImportResult(`Error reading Excel file: ${err.message}`);
    }
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyLink = (groupCode: string) => {
    navigator.clipboard.writeText(`${baseUrl}/?g=${groupCode}`);
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
            {tab === 'import' ? 'Import' : tab}
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyLink(g.groupCode)}
                            className="text-blue-600 hover:text-blue-800 text-xs underline"
                          >
                            Copy Link
                          </button>
                          {g.guests?.filter((guest) => guest.phone).map((guest) => (
                            <WhatsAppIcon
                              key={guest.id}
                              phone={guest.phone!}
                              rsvpLink={`${baseUrl}/?g=${g.groupCode}`}
                            />
                          ))}
                        </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              <input type="text" value={newGuest.name} onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })} placeholder="Full Name" className="border rounded px-3 py-2 text-sm" />
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
                      <td className="py-2 font-medium text-gray-800">{g.name}</td>
                      <td className="py-2 text-gray-600">
                        <span className="flex items-center gap-2">
                          {g.phone || '-'}
                          {g.phone && (
                            <WhatsAppIcon
                              phone={g.phone}
                              rsvpLink={`${baseUrl}/?g=${g.groupCode}`}
                            />
                          )}
                        </span>
                      </td>
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

      {/* ═══ IMPORT TAB ═══ */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Excel Upload */}
          <div className="admin-card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Import from Excel File</h3>
            <p className="text-xs text-gray-500 mb-3">
              Upload an <strong>.xlsx</strong> or <strong>.xls</strong> file with columns:
              <code className="bg-gray-100 px-1 rounded ml-1">Name, Phone Number, S, GT, Group #</code>
              <span className="block mt-1 text-gray-400">
                S = G (groom) or B (bride) &middot; GroupCode = S+GT+Group# (e.g. GFAM1) &middot; maxGuests auto-calculated per group
              </span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 inline-flex items-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Excel File
            </button>
          </div>

          {/* CSV Paste */}
          <div className="admin-card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Or Paste CSV Data</h3>
            <p className="text-xs text-gray-500 mb-3">
              Same format: <code className="bg-gray-100 px-1 rounded">Name,Phone Number,S,GT,Group #</code>
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              placeholder={`Name,Phone Number,S,GT,Group #\nHussein Rachidi,03833508,G,FAM,1\nSuzan Rachidi,,B,FAM,1\nAhmad Rachidi,71538385,G,FRD,2`}
              className="w-full border rounded-md px-3 py-2 text-sm font-mono mb-3"
            />
            <button onClick={handleImport} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
              Import CSV
            </button>
          </div>

          {/* Import result */}
          {importResult && (
            <div className={`admin-card ${importResult.startsWith('Error') ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <p className={`text-sm ${importResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {importResult}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
