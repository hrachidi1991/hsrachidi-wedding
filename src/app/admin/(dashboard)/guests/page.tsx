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

function formatPhoneForWhatsApp(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0') && !p.startsWith('+')) p = '+961' + p.slice(1);
  if (!p.startsWith('+') && p.length <= 8) p = '+961' + p;
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
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', side: 'groom', groupCode: '' });
  const [guestSearch, setGuestSearch] = useState('');
  const [copiedGroupCode, setCopiedGroupCode] = useState<string | null>(null);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    details: { code: string; count: number }[];
    onConfirm: () => void;
  } | null>(null);

  // CSV/Excel import
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState('');
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel import wizard
  const [importStep, setImportStep] = useState<'idle' | 'file-selected' | 'sheet-select' | 'preview' | 'saving'>('idle');
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string[]>>({});

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

  const saveGuest = async (existingGroup: Group | undefined) => {
    const res = await fetch('/api/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newGuest, relation: 'Friend' }),
    });
    if (res.ok) {
      if (existingGroup) {
        await fetch('/api/groups', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existingGroup.id, maxGuests: (existingGroup.guests?.length || 0) + 1 }),
        });
      }
      setNewGuest({ name: '', phone: '', side: 'groom', groupCode: '' });
      reload();
    }
  };

  const addGuest = async () => {
    if (!newGuest.name || !newGuest.groupCode) return;

    const existingGroup = groups.find(g => g.groupCode === newGuest.groupCode);
    if (existingGroup) {
      const guestCount = existingGroup.guests?.length || 0;
      setConfirmModal({
        title: 'Group Already Exists',
        message: `Do you want to add "${newGuest.name}" to this existing group?`,
        details: [{ code: existingGroup.groupCode, count: guestCount }],
        onConfirm: () => {
          setConfirmModal(null);
          saveGuest(existingGroup);
        },
      });
      return;
    }

    saveGuest(undefined);
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

  const copyLink = (groupCode: string) => {
    navigator.clipboard.writeText(`${baseUrl}/?g=${groupCode}`);
    setCopiedGroupCode(groupCode);
    setTimeout(() => setCopiedGroupCode(null), 2000);
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

  // Validate rows — checks mandatory fields only (name + group code fields)
  const validateRows = (headers: string[], rows: Record<string, string>[]): Record<number, string[]> => {
    const errors: Record<number, string[]> = {};
    const isNewFormat = headers.includes('s') && headers.includes('gt') && headers.includes('group #');

    rows.forEach((row, i) => {
      const rowErrs: string[] = [];

      const name = (row['name'] || row['firstname'] || row['first name'] || '').trim();
      if (!name) {
        rowErrs.push('Name is missing');
      }

      if (isNewFormat) {
        const s = (row['s'] || '').trim();
        const gt = (row['gt'] || '').trim();
        const groupNum = (row['group #'] || '').trim();
        if (!s) rowErrs.push('S (side) is missing');
        if (!gt) rowErrs.push('GT (guest type) is missing');
        if (!groupNum) rowErrs.push('Group # is missing');
      } else {
        const groupCode = (row['groupcode'] || row['group code'] || row['group'] || '').trim();
        if (!groupCode) rowErrs.push('Group code is missing');
      }

      if (rowErrs.length > 0) {
        errors[i] = rowErrs;
      }
    });

    return errors;
  };

  // Parse a single sheet into headers + rows
  const parseSheet = (wb: XLSX.WorkBook, sheetName: string): { headers: string[]; rows: Record<string, string>[] } => {
    const sheet = wb.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rawRows.length < 2) return { headers: [], rows: [] };
    const headers = rawRows[0].map((h: any) => String(h).trim().toLowerCase());
    const rows = rawRows.slice(1)
      .filter((row: any[]) => row.some((cell: any) => String(cell).trim() !== ''))
      .map((row: any[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, idx: number) => { obj[h] = String(row[idx] ?? '').trim(); });
        return obj;
      });
    return { headers, rows };
  };

  const loadPreview = (headers: string[], rows: Record<string, string>[]) => {
    const errors = validateRows(headers, rows);
    setRowErrors(errors);
    setPreviewHeaders(headers);
    setPreviewRows(rows);
    setSelectedRowIndices(new Set(rows.map((_, i) => i)));
  };

  // Step 1: User picks a file
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult('');
    setImportProgress(0);
    setImportFileName(file.name);
    setImportStep('file-selected');
  };

  // Step 2: User clicks "Next" — parse the workbook
  const handleNext = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      setWorkbookRef(wb);
      setSheetNames(wb.SheetNames);
      if (wb.SheetNames.length === 1) {
        setSelectedSheet(wb.SheetNames[0]);
        const { headers, rows } = parseSheet(wb, wb.SheetNames[0]);
        loadPreview(headers, rows);
        setImportStep('preview');
      } else {
        setSelectedSheet(wb.SheetNames[0]);
        setImportStep('sheet-select');
      }
    } catch (err: any) {
      setImportResult(`Error reading file: ${err.message}`);
      resetImportWizard();
    }
  };

  // Step 3: User picks a sheet (or all) and clicks "Load"
  const handleLoadSheet = () => {
    if (!workbookRef) return;

    if (selectedSheet === '__ALL__') {
      // Merge all sheets
      let allHeaders: string[] = [];
      let allRows: Record<string, string>[] = [];
      for (const name of sheetNames) {
        const { headers, rows } = parseSheet(workbookRef, name);
        if (allHeaders.length === 0 && headers.length > 0) {
          allHeaders = headers;
        }
        // Only add rows from sheets that share the same header structure
        if (headers.length > 0) {
          allRows = allRows.concat(rows);
        }
      }
      loadPreview(allHeaders, allRows);
    } else {
      const { headers, rows } = parseSheet(workbookRef, selectedSheet);
      loadPreview(headers, rows);
    }
    setImportStep('preview');
  };

  // Compute group codes from parsed rows (matches processImportRows logic)
  const getGroupCodesFromRows = (headers: string[], rows: Record<string, string>[]): string[] => {
    const isNewFormat = headers.includes('s') && headers.includes('gt') && headers.includes('group #');
    const codes = new Set<string>();
    rows.forEach(row => {
      if (isNewFormat) {
        const s = (row['s'] || '').toUpperCase();
        const gt = (row['gt'] || '').toUpperCase();
        const groupNum = (row['group #'] || '').trim();
        if (s && gt && groupNum) codes.add(`${s}${gt}${groupNum}`);
      } else {
        const gc = (row['groupcode'] || row['group code'] || row['group'] || '').trim();
        if (gc) codes.add(gc);
      }
    });
    return Array.from(codes);
  };

  const handleSaveSelected = async () => {
    if (selectedRowIndices.size === 0) return;

    // Re-validate selected rows before saving
    const selectedIndices = Array.from(selectedRowIndices).sort((a, b) => a - b);
    const selectedRows = selectedIndices.map(i => previewRows[i]);
    const errors = validateRows(previewHeaders, selectedRows);

    if (Object.keys(errors).length > 0) {
      const errorLines = Object.entries(errors).map(([localIdx, msgs]) => {
        const originalRow = selectedIndices[Number(localIdx)] + 1;
        return `Row ${originalRow}: ${msgs.join(', ')}`;
      });
      setImportResult(`Error: Cannot save — fix these rows first:\n${errorLines.join('\n')}`);
      const fullErrors = validateRows(previewHeaders, previewRows);
      setRowErrors(fullErrors);
      return;
    }

    // Check for existing groups
    const importGroupCodes = getGroupCodesFromRows(previewHeaders, selectedRows);
    const existingCodes = importGroupCodes.filter(code =>
      groups.some(g => g.groupCode.toUpperCase() === code.toUpperCase())
    );

    if (existingCodes.length > 0) {
      const detailItems = existingCodes.map(code => {
        const group = groups.find(g => g.groupCode.toUpperCase() === code.toUpperCase())!;
        return { code, count: group.guests?.length || 0 };
      });
      setConfirmModal({
        title: 'Groups Already Exist',
        message: 'Do you want to add the new guests to these existing groups?',
        details: detailItems,
        onConfirm: () => {
          setConfirmModal(null);
          proceedWithImport(selectedRows);
        },
      });
      return;
    }

    proceedWithImport(selectedRows);
  };

  const proceedWithImport = async (selectedRows: Record<string, string>[]) => {
    setImportStep('saving');
    setImportResult('');
    setImportProgress(10);
    try {
      setImportProgress(50);
      const result = await processImportRows(previewHeaders, selectedRows);
      setImportProgress(100);
      setImportResult(result);
      resetImportWizard();
      reload();
    } catch (err: any) {
      setImportResult(`Error: ${err.message}`);
      setImportStep('preview');
      setImportProgress(0);
    }
  };

  const resetImportWizard = () => {
    setImportStep('idle');
    setWorkbookRef(null);
    setImportFileName('');
    setSheetNames([]);
    setSelectedSheet('');
    setPreviewHeaders([]);
    setPreviewRows([]);
    setSelectedRowIndices(new Set());
    setRowErrors({});
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleRowSelection = (index: number) => {
    setSelectedRowIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAllRows = () => {
    if (selectedRowIndices.size === previewRows.length) {
      setSelectedRowIndices(new Set());
    } else {
      setSelectedRowIndices(new Set(previewRows.map((_, i) => i)));
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
            <div className="flex gap-2 flex-wrap items-end">
              <input type="text" value={newGuest.name} onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })} placeholder="Full Name" className="border rounded px-3 py-2 text-sm w-48" />
              <input type="text" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} placeholder="Phone" className="border rounded px-3 py-2 text-sm w-40" />
              <select value={newGuest.side} onChange={(e) => setNewGuest({ ...newGuest, side: e.target.value })} className="border rounded px-3 py-2 text-sm">
                <option value="groom">Groom</option>
                <option value="bride">Bride</option>
              </select>
              <select value={newGuest.groupCode} onChange={(e) => setNewGuest({ ...newGuest, groupCode: e.target.value })} className="border rounded px-3 py-2 text-sm">
                <option value="">Select Group...</option>
                {groups.map((g) => <option key={g.id} value={g.groupCode}>{g.groupCode}</option>)}
              </select>
              <button onClick={addGuest} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 whitespace-nowrap">
                Add
              </button>
            </div>
          </div>

          {/* Guests list */}
          <div className="admin-card">
            {/* Search bar */}
            <div className="mb-3 relative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                placeholder="Search by name, phone, or group..."
                className="border rounded px-3 py-2 pl-9 text-sm w-full"
              />
              {guestSearch && (
                <button onClick={() => setGuestSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  &times;
                </button>
              )}
            </div>
            {(() => {
              const q = guestSearch.toLowerCase().trim();
              const filtered = q
                ? guests.filter(g =>
                    g.name.toLowerCase().includes(q) ||
                    (g.phone || '').toLowerCase().includes(q) ||
                    g.groupCode.toLowerCase().includes(q)
                  )
                : guests;
              return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Phone</th>
                      <th className="pb-2 font-medium">Side</th>
                      <th className="pb-2 font-medium">Group ID</th>
                      <th className="pb-2 font-medium">Link</th>
                      <th className="pb-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((g) => (
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
                        <td className="py-2 text-gray-600">{g.groupCode}</td>
                        <td className="py-2">
                          <button
                            onClick={() => copyLink(g.groupCode)}
                            className="text-blue-600 hover:text-blue-800 text-xs inline-flex items-center gap-1"
                          >
                            {copiedGroupCode === g.groupCode ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span className="text-green-600">Copied!</span>
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                Copy Link
                              </>
                            )}
                          </button>
                        </td>
                        <td className="py-2">
                          <button onClick={() => deleteGuest(g.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {guests.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">No guests yet.</p>}
                {guests.length > 0 && filtered.length === 0 && (
                  <p className="text-gray-400 text-sm py-4 text-center">No guests match &ldquo;{guestSearch}&rdquo;</p>
                )}
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══ IMPORT TAB ═══ */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Excel Upload Wizard */}
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
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* IDLE: File picker */}
            {importStep === 'idle' && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 border border-gray-300 inline-flex items-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Choose Excel File
              </button>
            )}

            {/* FILE-SELECTED: Show file name + Next button */}
            {importStep === 'file-selected' && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 flex-shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-sm text-blue-800 flex-1 truncate font-medium">{importFileName}</span>
                <button
                  onClick={handleNext}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 font-medium whitespace-nowrap"
                >
                  Next
                </button>
                <button
                  onClick={resetImportWizard}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none"
                >
                  &times;
                </button>
              </div>
            )}

            {/* SHEET-SELECT: Pick which sheet to load */}
            {importStep === 'sheet-select' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 flex-shrink-0">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="truncate font-medium">{importFileName}</span>
                  <span className="text-gray-400">({sheetNames.length} sheets)</span>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Select Sheet</label>
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="border rounded px-3 py-2 text-sm min-w-[200px]"
                    >
                      <option value="__ALL__">All Sheets</option>
                      {sheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleLoadSheet}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 font-medium"
                  >
                    Load
                  </button>
                  <button
                    onClick={resetImportWizard}
                    className="px-4 py-2 text-gray-500 text-sm rounded-md hover:bg-gray-100 border border-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* PREVIEW: Data table with row selection */}
            {importStep === 'preview' && (() => {
              const errorCount = Object.keys(rowErrors).length;
              return (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium truncate">{importFileName}</span>
                    {sheetNames.length > 1 && (
                      <span className="text-gray-400">/ {selectedSheet === '__ALL__' ? 'All Sheets' : selectedSheet}</span>
                    )}
                    <span className="text-gray-400">
                      &mdash; {previewRows.length} row{previewRows.length !== 1 ? 's' : ''}
                    </span>
                    {errorCount > 0 && (
                      <span className="text-red-600 font-medium">
                        ({errorCount} with errors)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {sheetNames.length > 1 && (
                      <button
                        onClick={() => setImportStep('sheet-select')}
                        className="px-3 py-1.5 text-gray-500 text-xs rounded-md hover:bg-gray-100 border border-gray-300"
                      >
                        Change Sheet
                      </button>
                    )}
                    <button
                      onClick={handleSaveSelected}
                      disabled={selectedRowIndices.size === 0}
                      className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Save Selected ({selectedRowIndices.size})
                    </button>
                    <button
                      onClick={resetImportWizard}
                      className="px-3 py-1.5 text-gray-500 text-xs rounded-md hover:bg-gray-100 border border-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {errorCount > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
                    <strong>{errorCount} row{errorCount !== 1 ? 's have' : ' has'} errors</strong> and cannot be imported. Fix them in your spreadsheet or deselect them before saving.
                  </div>
                )}

                {previewRows.length === 0 ? (
                  <p className="text-gray-400 text-sm py-4 text-center">This sheet has no data rows.</p>
                ) : (
                  <div className="border rounded-lg overflow-auto max-h-[400px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="text-left text-gray-500 border-b">
                          <th className="px-3 py-2 font-medium w-10">
                            <input
                              type="checkbox"
                              checked={previewRows.length > 0 && selectedRowIndices.size === previewRows.length}
                              onChange={toggleAllRows}
                              disabled={previewRows.length === 0}
                              className="rounded"
                            />
                          </th>
                          <th className="px-3 py-2 font-medium text-gray-400 w-10">#</th>
                          {previewHeaders.map((h) => (
                            <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                          ))}
                          <th className="px-3 py-2 font-medium text-gray-400 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => {
                          const hasError = !!rowErrors[i];
                          return (
                          <tr
                            key={i}
                            className={`border-b transition-colors ${
                              hasError
                                ? selectedRowIndices.has(i)
                                  ? 'bg-red-50 border-red-100 cursor-pointer'
                                  : 'bg-red-50/50 border-red-100 text-gray-400 cursor-pointer'
                                : selectedRowIndices.has(i)
                                  ? 'bg-white hover:bg-gray-50 cursor-pointer border-gray-50'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-50 cursor-pointer border-gray-50'
                            }`}
                            onClick={() => toggleRowSelection(i)}
                            title={hasError ? rowErrors[i].join(' | ') : undefined}
                          >
                            <td className="px-3 py-1.5">
                              <input
                                type="checkbox"
                                checked={selectedRowIndices.has(i)}
                                onChange={() => toggleRowSelection(i)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded"
                              />
                            </td>
                            <td className={`px-3 py-1.5 ${hasError ? 'text-red-400' : 'text-gray-400'}`}>{i + 1}</td>
                            {previewHeaders.map((h) => (
                              <td key={h} className={`px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate ${hasError ? 'text-red-600' : ''}`}>
                                {row[h] || ''}
                              </td>
                            ))}
                            <td className="px-3 py-1.5">
                              {hasError && (
                                <span className="relative group">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                  </svg>
                                  <span className="absolute right-0 bottom-full mb-1 hidden group-hover:block bg-red-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20 shadow-lg">
                                    {rowErrors[i].join(' | ')}
                                  </span>
                                </span>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              );
            })()}

            {/* SAVING: Progress bar */}
            {importStep === 'saving' && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-green-500 h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-10 text-right">{importProgress}%</span>
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-green-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving {selectedRowIndices.size} rows from {importFileName}...
                </p>
              </div>
            )}
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
              <div className={`text-sm ${importResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {importResult.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* ═══ CONFIRM MODAL ═══ */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmModal(null)} />
          {/* Modal card */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-3">
              <div className="bg-amber-100 rounded-full p-2">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800">{confirmModal.title}</h3>
            </div>
            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600 mb-4">{confirmModal.message}</p>
              <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
                {confirmModal.details.map(({ code, count }) => (
                  <div key={code} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-medium text-gray-800">{code}</span>
                    <span className="text-xs text-gray-500 bg-gray-200 rounded-full px-2.5 py-0.5">
                      {count} guest{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Footer */}
            <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-200 border border-gray-300 font-medium transition-colors"
              >
                No, Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Yes, Add to Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
