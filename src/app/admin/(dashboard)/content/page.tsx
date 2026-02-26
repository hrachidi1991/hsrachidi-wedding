'use client';

import { useEffect, useState, useCallback } from 'react';
import { upload } from '@vercel/blob/client';
import type { SiteContent } from '@/lib/settings';

export default function ContentEditor() {
  const [settings, setSettings] = useState<SiteContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState('hero');

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((data) => {
      if (data && !data.error) setSettings(data);
    });
  }, []);

  const update = useCallback((key: keyof SiteContent, value: any) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : null);
  }, []);

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || `Save failed (${res.status})`);
      }
    } catch {
      setSaveError('Connection error');
    }
    setSaving(false);
  };

  const uploadFile = async (file: File, key: keyof SiteContent) => {
    try {
      const uniqueName = `${Date.now()}-${file.name}`;
      const blob = await upload(uniqueName, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });
      update(key, blob.url);
    } catch (e: any) {
      setSaveError(e.message || 'Upload failed');
    }
  };

  if (!settings) return <div className="p-8 text-gray-400">Loading...</div>;

  const tabs = [
    { id: 'hero', label: 'Hero / Names' },
    { id: 'envelope', label: 'Envelope' },
    { id: 'quran', label: 'Quran Aya' },
    { id: 'invitation', label: 'Formal Invitation' },
    { id: 'countdown', label: 'Countdown' },
    { id: 'location', label: 'Location' },
    { id: 'gift', label: 'Gift Registry' },
    { id: 'rsvp', label: 'RSVP' },
    { id: 'music', label: 'Music' },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Content & Settings</h1>
        <div className="flex items-center gap-3">
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <button
            onClick={saveSettings}
            disabled={saving}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50`}
          >
            {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-sm rounded-md transition ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-card">
        {/* HERO */}
        {activeTab === 'hero' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-2">Hero Section</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Groom Name (EN)" value={settings.groomNameEn} onChange={(v) => update('groomNameEn', v)} />
              <Field label="Groom Name (AR)" value={settings.groomNameAr} onChange={(v) => update('groomNameAr', v)} dir="rtl" />
              <Field label="Bride Name (EN)" value={settings.brideNameEn} onChange={(v) => update('brideNameEn', v)} />
              <Field label="Bride Name (AR)" value={settings.brideNameAr} onChange={(v) => update('brideNameAr', v)} dir="rtl" />
            </div>
            <Field label="Wedding Date Display" value={settings.weddingDate} onChange={(v) => update('weddingDate', v)} />
            <div className="flex items-center gap-3">
              <button
                onClick={() => update('showHeroNames', !settings.showHeroNames)}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.showHeroNames ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.showHeroNames ? 'translate-x-5' : ''}`} />
              </button>
              <span className="text-sm text-gray-700">Show Hero Section</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${settings.showHeroNames ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {settings.showHeroNames ? 'Active' : 'Hidden'}
              </span>
            </div>
            <FileUpload label="Hero Background Image" current={settings.heroImage} onUpload={(f) => uploadFile(f, 'heroImage')} onRemove={() => update('heroImage', '')} />
          </div>
        )}

        {/* ENVELOPE */}
        {activeTab === 'envelope' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-2">Envelope Section</h2>
            <FileUpload label="Envelope Image" current={settings.envelopeImage} onUpload={(f) => uploadFile(f, 'envelopeImage')} onRemove={() => update('envelopeImage', '')} />
            <FileUpload label="Wax Seal Image" current={settings.sealImage} onUpload={(f) => uploadFile(f, 'sealImage')} onRemove={() => update('sealImage', '')} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.sfxEnabled}
                onChange={(e) => update('sfxEnabled', e.target.checked)}
                className="rounded"
              />
              Enable seal open SFX
            </label>
          </div>
        )}

        {/* QURAN AYA */}
        {activeTab === 'quran' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-2">Quran Aya Section</h2>
            <p className="text-sm text-gray-500">This section displays Bismillah, Ar-Rum 30:21 verse, and the &quot;Created You in Pairs&quot; verse (78:8). Upload a background image below.</p>
            <FileUpload label="Quran Aya Background" current={settings.quranBg} onUpload={(f) => uploadFile(f, 'quranBg')} onRemove={() => update('quranBg', '')} />
          </div>
        )}

        {/* FORMAL INVITATION */}
        {activeTab === 'invitation' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold mb-2">Formal Invitation</h2>

            {/* Family 1 */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Family 1 (Left side)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Title / Prefix (EN)" value={settings.invPrefix1En} onChange={(v) => update('invPrefix1En', v)} />
                <Field label="Title / Prefix (AR)" value={settings.invPrefix1Ar} onChange={(v) => update('invPrefix1Ar', v)} dir="rtl" />
                <Field label="Father Name (EN)" value={settings.invFather1En} onChange={(v) => update('invFather1En', v)} />
                <Field label="Father Name (AR)" value={settings.invFather1Ar} onChange={(v) => update('invFather1Ar', v)} dir="rtl" />
                <Field label="Connector (EN)" value={settings.invConnector1En} onChange={(v) => update('invConnector1En', v)} />
                <Field label="Connector (AR)" value={settings.invConnector1Ar} onChange={(v) => update('invConnector1Ar', v)} dir="rtl" />
                <Field label="Mother Name (EN)" value={settings.invMother1En} onChange={(v) => update('invMother1En', v)} />
                <Field label="Mother Name (AR)" value={settings.invMother1Ar} onChange={(v) => update('invMother1Ar', v)} dir="rtl" />
              </div>
            </div>

            {/* Family 2 */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Family 2 (Right side)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Title / Prefix (EN)" value={settings.invPrefix2En} onChange={(v) => update('invPrefix2En', v)} />
                <Field label="Title / Prefix (AR)" value={settings.invPrefix2Ar} onChange={(v) => update('invPrefix2Ar', v)} dir="rtl" />
                <Field label="Father Name (EN)" value={settings.invFather2En} onChange={(v) => update('invFather2En', v)} />
                <Field label="Father Name (AR)" value={settings.invFather2Ar} onChange={(v) => update('invFather2Ar', v)} dir="rtl" />
                <Field label="Connector (EN)" value={settings.invConnector2En} onChange={(v) => update('invConnector2En', v)} />
                <Field label="Connector (AR)" value={settings.invConnector2Ar} onChange={(v) => update('invConnector2Ar', v)} dir="rtl" />
                <Field label="Mother Name (EN)" value={settings.invMother2En} onChange={(v) => update('invMother2En', v)} />
                <Field label="Mother Name (AR)" value={settings.invMother2Ar} onChange={(v) => update('invMother2Ar', v)} dir="rtl" />
              </div>
            </div>

            {/* Invitation body, couple, date */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Invitation Text</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextArea label="Body Text (EN)" value={settings.invBodyEn} onChange={(v) => update('invBodyEn', v)} rows={2} />
                <TextArea label="Body Text (AR)" value={settings.invBodyAr} onChange={(v) => update('invBodyAr', v)} rows={2} dir="rtl" />
                <Field label="Couple Names (EN)" value={settings.invCoupleEn} onChange={(v) => update('invCoupleEn', v)} />
                <Field label="Couple Names (AR)" value={settings.invCoupleAr} onChange={(v) => update('invCoupleAr', v)} dir="rtl" />
                <Field label="Date Line (EN)" value={settings.invDateEn} onChange={(v) => update('invDateEn', v)} />
                <Field label="Date Line (AR)" value={settings.invDateAr} onChange={(v) => update('invDateAr', v)} dir="rtl" />
              </div>
            </div>

            <FileUpload label="Invitation Background" current={settings.invitationBg} onUpload={(f) => uploadFile(f, 'invitationBg')} onRemove={() => update('invitationBg', '')} />
          </div>
        )}

        {/* COUNTDOWN */}
        {activeTab === 'countdown' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-2">Countdown Section</h2>
            <Field label="Countdown Target (ISO datetime)" value={settings.countdownDate} onChange={(v) => update('countdownDate', v)} type="datetime-local" />
            <FileUpload label="Countdown Background" current={settings.countdownBg} onUpload={(f) => uploadFile(f, 'countdownBg')} onRemove={() => update('countdownBg', '')} />
          </div>
        )}

        {/* LOCATION */}
        {activeTab === 'location' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-2">Location Section</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Event Date" value={settings.eventDate} onChange={(v) => update('eventDate', v)} />
              <Field label="Event Time" value={settings.eventTime} onChange={(v) => update('eventTime', v)} />
              <Field label="Venue Name (EN)" value={settings.venueNameEn} onChange={(v) => update('venueNameEn', v)} />
              <Field label="Venue Name (AR)" value={settings.venueNameAr} onChange={(v) => update('venueNameAr', v)} dir="rtl" />
              <Field label="Address (EN)" value={settings.venueAddressEn} onChange={(v) => update('venueAddressEn', v)} />
              <Field label="Address (AR)" value={settings.venueAddressAr} onChange={(v) => update('venueAddressAr', v)} dir="rtl" />
            </div>
            <Field label="Google Maps URL" value={settings.googleMapsUrl} onChange={(v) => update('googleMapsUrl', v)} />
            <FileUpload label="Location Background" current={settings.locationBg} onUpload={(f) => uploadFile(f, 'locationBg')} onRemove={() => update('locationBg', '')} />
          </div>
        )}

        {/* GIFT */}
        {activeTab === 'gift' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-2">Gift Registry</h2>
            <TextArea label="Gift Text (EN)" value={settings.giftTextEn} onChange={(v) => update('giftTextEn', v)} rows={3} />
            <TextArea label="Gift Text (AR)" value={settings.giftTextAr} onChange={(v) => update('giftTextAr', v)} rows={3} dir="rtl" />
            <Field label="Provider Name" value={settings.giftProviderName} onChange={(v) => update('giftProviderName', v)} />
            <Field label="Account ID" value={settings.giftAccountId} onChange={(v) => update('giftAccountId', v)} />
            <Field label="Phone Number" value={settings.giftPhone} onChange={(v) => update('giftPhone', v)} />
            <FileUpload label="Gift Section Background" current={settings.giftBg} onUpload={(f) => uploadFile(f, 'giftBg')} onRemove={() => update('giftBg', '')} />
          </div>
        )}

        {/* RSVP */}
        {activeTab === 'rsvp' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-2">RSVP Section</h2>
            <Field label="Deadline (EN)" value={settings.rsvpDeadlineEn} onChange={(v) => update('rsvpDeadlineEn', v)} />
            <Field label="Deadline (AR)" value={settings.rsvpDeadlineAr} onChange={(v) => update('rsvpDeadlineAr', v)} dir="rtl" />
            <Field label="WhatsApp Link (e.g. https://wa.me/96181538385)" value={settings.whatsappUrl} onChange={(v) => update('whatsappUrl', v)} />
            <FileUpload label="RSVP Background" current={settings.rsvpBg} onUpload={(f) => uploadFile(f, 'rsvpBg')} onRemove={() => update('rsvpBg', '')} />
          </div>
        )}

        {/* MUSIC */}
        {activeTab === 'music' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold mb-2">Background Music</h2>
            <div className="space-y-2">
              <FileUpload label="English Music File (MP3)" current={settings.musicFile} onUpload={(f) => uploadFile(f, 'musicFile')} onRemove={() => update('musicFile', '')} accept="audio/*" />
              {settings.musicFile && (
                <audio controls src={settings.musicFile} className="w-full mt-2" />
              )}
            </div>
            <div className="space-y-2">
              <FileUpload label="Arabic Music File (MP3)" current={settings.musicFileAr} onUpload={(f) => uploadFile(f, 'musicFileAr')} onRemove={() => update('musicFileAr', '')} accept="audio/*" />
              {settings.musicFileAr && (
                <audio controls src={settings.musicFileAr} className="w-full mt-2" />
              )}
            </div>
            <p className="text-xs text-gray-400">The English track plays by default. When guests switch to Arabic, the Arabic track will play instead.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper Components ──────────────────────────
function Field({ label, value, onChange, type = 'text', dir }: { label: string; value: string; onChange: (v: string) => void; type?: string; dir?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={dir}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 4, dir }: { label: string; value: string; onChange: (v: string) => void; rows?: number; dir?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        dir={dir}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );
}

function FileUpload({ label, current, onUpload, onRemove, accept = 'image/*' }: { label: string; current: string; onUpload: (f: File) => void; onRemove?: () => void; accept?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept={accept}
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {current && (
          <>
            <span className="text-xs text-gray-400 truncate max-w-[200px]">{current}</span>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap"
              >
                Remove
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
