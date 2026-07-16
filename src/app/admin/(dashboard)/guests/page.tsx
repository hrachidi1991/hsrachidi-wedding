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
    className="ad-icon-btn ad-icon-btn--wa"
    title={`Send RSVP link via WhatsApp to ${phone}`}
    aria-label={`Send RSVP link via WhatsApp to ${phone}`}
  >
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
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

  if (loading) {
    return (
      <div>
        <div className="ad-skel" style={{ height: 34, width: 230, marginBottom: 24 }} />
        <div className="ad-skel" style={{ height: 46, width: 280, marginBottom: 24 }} />
        <div className="ad-card">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ad-skel" style={{ height: 16, width: '100%', marginBottom: 14 }} />
          ))}
        </div>
      </div>
    );
  }

  const tabLabels: Record<'groups' | 'guests' | 'import', string> = {
    groups: 'Groups',
    guests: 'Guests',
    import: 'Import',
  };

  return (
    <div>
      <header className="ad-header">
        <div>
          <div className="ad-eyebrow" style={{ marginBottom: '0.4rem' }}>Guest list</div>
          <h1 className="ad-title">Guests &amp; Groups</h1>
          <p className="ad-page-desc">Create invitation groups, add guests and share personalised RSVP links.</p>
        </div>
      </header>

      <div className="ad-seg mb-5" role="tablist" aria-label="Guests and groups views">
        {(['groups', 'guests', 'import'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className="ad-seg-btn"
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* ═══ GROUPS TAB ═══ */}
      {activeTab === 'groups' && (
        <div>
          <div className="ad-card mb-5">
            <h3 className="ad-eyebrow" style={{ marginBottom: '0.9rem' }}>Add New Group</h3>
            <div className="ad-form-row">
              <div className="ad-field" style={{ flex: '2 1 200px' }}>
                <label className="ad-label">Group Code</label>
                <input type="text" value={newGroupCode} onChange={(e) => setNewGroupCode(e.target.value)} placeholder="e.g., RACHIDI-FAM" className="ad-input" />
              </div>
              <div className="ad-field" style={{ flex: '0 1 120px' }}>
                <label className="ad-label">Max Guests</label>
                <input type="number" value={newGroupMax} onChange={(e) => setNewGroupMax(parseInt(e.target.value) || 1)} min={1} max={20} className="ad-input ad-nums" />
              </div>
              <div className="ad-field" style={{ flex: '0 1 140px' }}>
                <label className="ad-label">Side</label>
                <select value={newGroupSide} onChange={(e) => setNewGroupSide(e.target.value)} className="ad-select">
                  <option value="groom">Groom</option>
                  <option value="bride">Bride</option>
                </select>
              </div>
              <button onClick={addGroup} className="ad-btn ad-btn--primary">
                Create Group
              </button>
            </div>
          </div>

          <div className="ad-card ad-card--flush">
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Group Code</th>
                    <th>Side</th>
                    <th>Max</th>
                    <th>Guests</th>
                    <th>RSVP Link</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.id}>
                      <td className="ad-cell-strong">{g.groupCode}</td>
                      <td className="ad-cap">{g.side}</td>
                      <td>{g.maxGuests}</td>
                      <td>{g.guests?.length || 0}</td>
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => copyLink(g.groupCode)}
                            className="ad-link-btn"
                          >
                            {copiedGroupCode === g.groupCode ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--ad-ok)' }}>
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span style={{ color: 'var(--ad-ok)' }}>Copied!</span>
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
                          {g.guests?.filter((guest) => guest.phone).map((guest) => (
                            <WhatsAppIcon
                              key={guest.id}
                              phone={guest.phone!}
                              rsvpLink={`${baseUrl}/?g=${g.groupCode}`}
                            />
                          ))}
                        </div>
                      </td>
                      <td>
                        <button onClick={() => deleteGroup(g.id)} className="ad-icon-btn ad-icon-btn--danger" aria-label={`Delete group ${g.groupCode}`} title="Delete group">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {groups.length === 0 && <p className="ad-empty">No groups yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ GUESTS TAB ═══ */}
      {activeTab === 'guests' && (
        <div>
          {/* Add guest form */}
          <div className="ad-card mb-5">
            <h3 className="ad-eyebrow" style={{ marginBottom: '0.9rem' }}>Add New Guest</h3>
            <div className="ad-form-row">
              <div className="ad-field" style={{ flex: '2 1 200px' }}>
                <label className="ad-label">Full Name</label>
                <input type="text" value={newGuest.name} onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })} placeholder="Full Name" className="ad-input" />
              </div>
              <div className="ad-field" style={{ flex: '1 1 150px' }}>
                <label className="ad-label">Phone</label>
                <input type="text" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} placeholder="Phone" className="ad-input" />
              </div>
              <div className="ad-field" style={{ flex: '0 1 130px' }}>
                <label className="ad-label">Side</label>
                <select value={newGuest.side} onChange={(e) => setNewGuest({ ...newGuest, side: e.target.value })} className="ad-select">
                  <option value="groom">Groom</option>
                  <option value="bride">Bride</option>
                </select>
              </div>
              <div className="ad-field" style={{ flex: '1 1 160px' }}>
                <label className="ad-label">Group</label>
                <select value={newGuest.groupCode} onChange={(e) => setNewGuest({ ...newGuest, groupCode: e.target.value })} className="ad-select">
                  <option value="">Select Group...</option>
                  {groups.map((g) => <option key={g.id} value={g.groupCode}>{g.groupCode}</option>)}
                </select>
              </div>
              <button onClick={addGuest} className="ad-btn ad-btn--primary">
                Add Guest
              </button>
            </div>
          </div>

          {/* Guests list */}
          <div className="ad-card ad-card--flush">
            {/* Search bar */}
            <div style={{ padding: '1rem 1.1rem' }}>
              <div className="ad-search">
                <span className="ad-search__icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  placeholder="Search by name, phone, or group..."
                  className="ad-input ad-input--search"
                  aria-label="Search guests"
                />
                {guestSearch && (
                  <button onClick={() => setGuestSearch('')} className="ad-search__clear" aria-label="Clear search">
                    &times;
                  </button>
                )}
              </div>
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
              <div className="ad-table-wrap">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Side</th>
                      <th>Group ID</th>
                      <th>Link</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((g) => (
                      <tr key={g.id}>
                        <td className="ad-cell-strong">{g.name}</td>
                        <td>
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
                        <td className="ad-cap">{g.side}</td>
                        <td>{g.groupCode}</td>
                        <td>
                          <button
                            onClick={() => copyLink(g.groupCode)}
                            className="ad-link-btn"
                          >
                            {copiedGroupCode === g.groupCode ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--ad-ok)' }}>
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span style={{ color: 'var(--ad-ok)' }}>Copied!</span>
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
                        <td>
                          <button onClick={() => deleteGuest(g.id)} className="ad-icon-btn ad-icon-btn--danger" aria-label={`Delete guest ${g.name}`} title="Delete guest">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {guests.length === 0 && <p className="ad-empty">No guests yet.</p>}
                {guests.length > 0 && filtered.length === 0 && (
                  <p className="ad-empty">No guests match &ldquo;{guestSearch}&rdquo;</p>
                )}
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ═══ IMPORT TAB ═══ */}
      {activeTab === 'import' && (
        <div className="space-y-5">
          {/* Excel Upload Wizard */}
          <div className="ad-card">
            <h3 className="ad-eyebrow" style={{ marginBottom: '0.6rem' }}>Import from Excel File</h3>
            <p className="ad-help" style={{ marginBottom: '1rem' }}>
              Upload an <strong>.xlsx</strong> or <strong>.xls</strong> file with columns:
              <code style={{ marginLeft: '0.35rem' }}>Name, Phone Number, S, GT, Group #</code>
              <span style={{ display: 'block', marginTop: '0.35rem', color: 'var(--ad-muted)' }}>
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
                className="ad-btn ad-btn--outline"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Choose Excel File
              </button>
            )}

            {/* FILE-SELECTED: Show file name + Next button */}
            {importStep === 'file-selected' && (
              <div className="ad-filechip">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="flex-1 truncate font-medium" style={{ color: 'var(--ad-ink)' }}>{importFileName}</span>
                <button onClick={handleNext} className="ad-btn ad-btn--accent ad-btn--sm">
                  Next
                </button>
                <button onClick={resetImportWizard} className="ad-icon-btn" aria-label="Cancel import">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            )}

            {/* SHEET-SELECT: Pick which sheet to load */}
            {importStep === 'sheet-select' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ad-body)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="flex-shrink-0" style={{ color: 'var(--ad-accent)' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="truncate font-medium">{importFileName}</span>
                  <span style={{ color: 'var(--ad-muted)' }}>({sheetNames.length} sheets)</span>
                </div>
                <div className="ad-form-row">
                  <div className="ad-field" style={{ flex: '1 1 220px' }}>
                    <label className="ad-label">Select Sheet</label>
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="ad-select"
                    >
                      <option value="__ALL__">All Sheets</option>
                      {sheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={handleLoadSheet} className="ad-btn ad-btn--accent">
                    Load
                  </button>
                  <button onClick={resetImportWizard} className="ad-btn ad-btn--outline">
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
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ad-body)' }}>
                    <span className="font-medium truncate" style={{ color: 'var(--ad-ink)' }}>{importFileName}</span>
                    {sheetNames.length > 1 && (
                      <span style={{ color: 'var(--ad-muted)' }}>/ {selectedSheet === '__ALL__' ? 'All Sheets' : selectedSheet}</span>
                    )}
                    <span style={{ color: 'var(--ad-muted)' }}>
                      &mdash; {previewRows.length} row{previewRows.length !== 1 ? 's' : ''}
                    </span>
                    {errorCount > 0 && (
                      <span className="font-medium" style={{ color: 'var(--ad-bad)' }}>
                        ({errorCount} with errors)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {sheetNames.length > 1 && (
                      <button onClick={() => setImportStep('sheet-select')} className="ad-btn ad-btn--outline ad-btn--sm">
                        Change Sheet
                      </button>
                    )}
                    <button
                      onClick={handleSaveSelected}
                      disabled={selectedRowIndices.size === 0}
                      className="ad-btn ad-btn--ok ad-btn--sm"
                    >
                      Save Selected ({selectedRowIndices.size})
                    </button>
                    <button onClick={resetImportWizard} className="ad-btn ad-btn--outline ad-btn--sm">
                      Cancel
                    </button>
                  </div>
                </div>

                {errorCount > 0 && (
                  <div className="ad-notice ad-notice--bad">
                    <strong>{errorCount} row{errorCount !== 1 ? 's have' : ' has'} errors</strong> and cannot be imported. Fix them in your spreadsheet or deselect them before saving.
                  </div>
                )}

                {previewRows.length === 0 ? (
                  <p className="ad-empty">This sheet has no data rows.</p>
                ) : (
                  <div style={{ border: '1px solid var(--ad-border)', borderRadius: 'var(--ad-r-ctrl)', overflow: 'auto', maxHeight: 400 }}>
                    <table className="ad-table" style={{ fontSize: '0.78rem' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--ad-raised)' }}>
                        <tr>
                          <th style={{ width: 40 }}>
                            <input
                              type="checkbox"
                              checked={previewRows.length > 0 && selectedRowIndices.size === previewRows.length}
                              onChange={toggleAllRows}
                              disabled={previewRows.length === 0}
                              className="ad-checkbox"
                              aria-label="Select all rows"
                            />
                          </th>
                          <th style={{ width: 40 }}>#</th>
                          {previewHeaders.map((h) => (
                            <th key={h} className="whitespace-nowrap">{h}</th>
                          ))}
                          <th style={{ width: 40 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => {
                          const hasError = !!rowErrors[i];
                          const selected = selectedRowIndices.has(i);
                          return (
                          <tr
                            key={i}
                            style={{
                              cursor: 'pointer',
                              background: hasError
                                ? 'var(--ad-bad-soft)'
                                : selected ? 'var(--ad-surface)' : 'var(--ad-raised)',
                              color: hasError
                                ? 'var(--ad-bad)'
                                : selected ? 'var(--ad-body)' : 'var(--ad-muted)',
                            }}
                            onClick={() => toggleRowSelection(i)}
                            title={hasError ? rowErrors[i].join(' | ') : undefined}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleRowSelection(i)}
                                onClick={(e) => e.stopPropagation()}
                                className="ad-checkbox"
                                aria-label={`Select row ${i + 1}`}
                              />
                            </td>
                            <td style={{ color: hasError ? 'var(--ad-bad)' : 'var(--ad-muted)' }}>{i + 1}</td>
                            {previewHeaders.map((h) => (
                              <td key={h} className="whitespace-nowrap" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {row[h] || ''}
                              </td>
                            ))}
                            <td>
                              {hasError && (
                                <span className="relative group" style={{ display: 'inline-flex' }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--ad-bad)' }}>
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                  </svg>
                                  <span className="absolute right-0 bottom-full mb-1 hidden group-hover:block text-white text-xs rounded px-2 py-1 whitespace-nowrap z-20 shadow-lg" style={{ background: '#9a3f3c' }}>
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
                  <div className="ad-progress">
                    <div className="ad-progress__fill" style={{ width: `${importProgress}%` }} />
                  </div>
                  <span className="text-sm ad-nums" style={{ color: 'var(--ad-muted)', width: 40, textAlign: 'right' }}>{importProgress}%</span>
                </div>
                <p className="text-sm flex items-center gap-2" style={{ color: 'var(--ad-muted)' }}>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" style={{ color: 'var(--ad-accent)' }}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving {selectedRowIndices.size} rows from {importFileName}...
                </p>
              </div>
            )}
          </div>

          {/* CSV Paste */}
          <div className="ad-card">
            <h3 className="ad-eyebrow" style={{ marginBottom: '0.6rem' }}>Or Paste CSV Data</h3>
            <p className="ad-help" style={{ marginBottom: '0.85rem' }}>
              Same format: <code>Name,Phone Number,S,GT,Group #</code>
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              placeholder={`Name,Phone Number,S,GT,Group #\nHussein Rachidi,03833508,G,FAM,1\nSuzan Rachidi,,B,FAM,1\nAhmad Rachidi,71538385,G,FRD,2`}
              className="ad-textarea ad-mono"
              style={{ marginBottom: '0.85rem' }}
            />
            <div>
              <button onClick={handleImport} className="ad-btn ad-btn--primary">
                Import CSV
              </button>
            </div>
          </div>

          {/* Import result */}
          {importResult && (
            <div className={`ad-notice ${importResult.startsWith('Error') ? 'ad-notice--bad' : 'ad-notice--ok'}`}>
              {importResult.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ═══ CONFIRM MODAL ═══ */}
      {confirmModal && (
        <div className="ad-modal-scrim" role="dialog" aria-modal="true" aria-label={confirmModal.title}>
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={() => setConfirmModal(null)} aria-hidden="true" />
          {/* Modal card */}
          <div className="ad-modal">
            {/* Header */}
            <div className="ad-modal__head">
              <span className="ad-modal__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <h3 className="ad-section-title" style={{ fontSize: '1.2rem' }}>{confirmModal.title}</h3>
            </div>
            {/* Body */}
            <div style={{ padding: '1.25rem 1.4rem' }}>
              <p className="text-sm" style={{ color: 'var(--ad-body)', marginBottom: '1rem' }}>{confirmModal.message}</p>
              <div style={{ background: 'var(--ad-raised)', borderRadius: 'var(--ad-r-ctrl)', border: '1px solid var(--ad-border)' }}>
                {confirmModal.details.map(({ code, count }, idx) => (
                  <div key={code} className="flex items-center justify-between" style={{ padding: '0.6rem 0.9rem', borderTop: idx === 0 ? 'none' : '1px solid var(--ad-border)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--ad-ink)' }}>{code}</span>
                    <span className="ad-count">
                      {count} guest{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Footer */}
            <div className="ad-modal__foot">
              <button onClick={() => setConfirmModal(null)} className="ad-btn ad-btn--outline">
                No, Cancel
              </button>
              <button onClick={confirmModal.onConfirm} className="ad-btn ad-btn--accent">
                Yes, Add to Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
