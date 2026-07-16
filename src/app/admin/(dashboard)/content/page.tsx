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

  if (!settings) {
    return (
      <div>
        <div className="ad-skel" style={{ height: 34, width: 260, marginBottom: 20 }} />
        <div className="ad-skel" style={{ height: 40, width: '100%', maxWidth: 640, marginBottom: 24 }} />
        <div className="ad-card">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="ad-skel" style={{ height: 42, width: '100%', marginBottom: 16 }} />
          ))}
        </div>
      </div>
    );
  }

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
      <header className="ad-header">
        <div>
          <div className="ad-eyebrow" style={{ marginBottom: '0.4rem' }}>Website</div>
          <h1 className="ad-title">Content &amp; Settings</h1>
          <p className="ad-page-desc">Edit every section of your public invitation, in English and Arabic.</p>
        </div>
        <div className="ad-header__actions">
          {saveError && <span className="ad-notice ad-notice--bad" style={{ padding: '0.45rem 0.7rem' }}>{saveError}</span>}
          <button
            onClick={saveSettings}
            disabled={saving}
            className={`ad-btn ${saved ? 'ad-btn--saved' : 'ad-btn--accent'}`}
          >
            {saved ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </>
            ) : saving ? 'Saving...' : 'Save All'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="ad-tabs mb-5" role="tablist" aria-label="Content sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="ad-tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ad-card">
        {/* HERO */}
        {activeTab === 'hero' && (
          <div className="space-y-4">
            <h2 className="ad-section-title" style={{ marginBottom: '0.25rem' }}>Hero Section</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Groom Name (EN)" value={settings.groomNameEn} onChange={(v) => update('groomNameEn', v)} />
              <Field label="Groom Name (AR)" value={settings.groomNameAr} onChange={(v) => update('groomNameAr', v)} dir="rtl" />
              <Field label="Bride Name (EN)" value={settings.brideNameEn} onChange={(v) => update('brideNameEn', v)} />
              <Field label="Bride Name (AR)" value={settings.brideNameAr} onChange={(v) => update('brideNameAr', v)} dir="rtl" />
            </div>
            <Field label="Wedding Date Display" value={settings.weddingDate} onChange={(v) => update('weddingDate', v)} />
            <div className="ad-toggle-row">
              <button
                type="button"
                onClick={() => update('showHeroNames', !settings.showHeroNames)}
                className="ad-switch"
                data-on={settings.showHeroNames ? 'true' : 'false'}
                role="switch"
                aria-checked={settings.showHeroNames}
                aria-label="Show Hero Section"
              >
                <span className="ad-switch__dot" />
              </button>
              <span className="ad-toggle-row__label">Show Hero Section</span>
              <span className={`ad-pill ${settings.showHeroNames ? 'ad-pill--ok' : 'ad-pill--neutral'}`}>
                {settings.showHeroNames ? 'Active' : 'Hidden'}
              </span>
            </div>
            <FileUpload label="Hero Background Image" current={settings.heroImage} onUpload={(f) => uploadFile(f, 'heroImage')} onRemove={() => update('heroImage', '')} />
          </div>
        )}

        {/* ENVELOPE */}
        {activeTab === 'envelope' && (
          <div className="space-y-4">
            <h2 className="ad-section-title" style={{ marginBottom: '0.25rem' }}>Envelope Section</h2>
            <FileUpload label="Envelope Image" current={settings.envelopeImage} onUpload={(f) => uploadFile(f, 'envelopeImage')} onRemove={() => update('envelopeImage', '')} />
            <FileUpload label="Wax Seal Image" current={settings.sealImage} onUpload={(f) => uploadFile(f, 'sealImage')} onRemove={() => update('sealImage', '')} />
            <label className="ad-check-row">
              <input
                type="checkbox"
                checked={settings.sfxEnabled}
                onChange={(e) => update('sfxEnabled', e.target.checked)}
                className="ad-checkbox"
              />
              Enable seal open SFX
            </label>
          </div>
        )}

        {/* QURAN AYA */}
        {activeTab === 'quran' && (
          <div className="space-y-4">
            <h2 className="ad-section-title" style={{ marginBottom: '0.25rem' }}>Quran Aya Section</h2>
            <p className="ad-help">This section displays Bismillah, Ar-Rum 30:21 verse, and the &quot;Created You in Pairs&quot; verse (78:8). Upload a background image below.</p>
            <FileUpload label="Quran Aya Background" current={settings.quranBg} onUpload={(f) => uploadFile(f, 'quranBg')} onRemove={() => update('quranBg', '')} />
          </div>
        )}

        {/* FORMAL INVITATION */}
        {activeTab === 'invitation' && (
          <div className="space-y-6">
            <h2 className="ad-section-title" style={{ marginBottom: '0.25rem' }}>Formal Invitation</h2>

            {/* Family 1 */}
            <div className="ad-subpanel space-y-3">
              <h3 className="ad-subpanel__title">Family 1 (Left side)</h3>
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
            <div className="ad-subpanel space-y-3">
              <h3 className="ad-subpanel__title">Family 2 (Right side)</h3>
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
            <div className="ad-subpanel space-y-3">
              <h3 className="ad-subpanel__title">Invitation Text</h3>
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
            <h2 className="ad-section-title" style={{ marginBottom: '0.25rem' }}>Countdown Section</h2>
            <Field label="Countdown Target (ISO datetime)" value={settings.countdownDate} onChange={(v) => update('countdownDate', v)} type="datetime-local" />
            <FileUpload label="Countdown Background" current={settings.countdownBg} onUpload={(f) => uploadFile(f, 'countdownBg')} onRemove={() => update('countdownBg', '')} />
          </div>
        )}

        {/* LOCATION */}
        {activeTab === 'location' && (
          <div className="space-y-4">
            <h2 className="ad-section-title" style={{ marginBottom: '0.25rem' }}>Location Section</h2>
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
            <h2 className="ad-section-title" style={{ marginBottom: '0.25rem' }}>Gift Registry</h2>
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
            <h2 className="ad-section-title" style={{ marginBottom: '0.25rem' }}>RSVP Section</h2>
            <Field label="Deadline (EN)" value={settings.rsvpDeadlineEn} onChange={(v) => update('rsvpDeadlineEn', v)} />
            <Field label="Deadline (AR)" value={settings.rsvpDeadlineAr} onChange={(v) => update('rsvpDeadlineAr', v)} dir="rtl" />
            <Field label="WhatsApp Link (e.g. https://wa.me/96181538385)" value={settings.whatsappUrl} onChange={(v) => update('whatsappUrl', v)} />
            <FileUpload label="RSVP Background" current={settings.rsvpBg} onUpload={(f) => uploadFile(f, 'rsvpBg')} onRemove={() => update('rsvpBg', '')} />
          </div>
        )}

        {/* MUSIC */}
        {activeTab === 'music' && (
          <div className="space-y-6">
            <h2 className="ad-section-title" style={{ marginBottom: '0.25rem' }}>Background Music</h2>
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
            <p className="ad-help">The English track plays by default. When guests switch to Arabic, the Arabic track will play instead.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper Components ──────────────────────────
function Field({ label, value, onChange, type = 'text', dir }: { label: string; value: string; onChange: (v: string) => void; type?: string; dir?: string }) {
  return (
    <div className="ad-field">
      <label className="ad-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={dir}
        className="ad-input"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 4, dir }: { label: string; value: string; onChange: (v: string) => void; rows?: number; dir?: string }) {
  return (
    <div className="ad-field">
      <label className="ad-label">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        dir={dir}
        className="ad-textarea"
      />
    </div>
  );
}

function FileUpload({ label, current, onUpload, onRemove, accept = 'image/*' }: { label: string; current: string; onUpload: (f: File) => void; onRemove?: () => void; accept?: string }) {
  return (
    <div className="ad-field">
      <label className="ad-label">{label}</label>
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="file"
          accept={accept}
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          className="ad-file"
        />
        {current && (
          <>
            <span className="ad-filemeta">{current}</span>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="ad-link-btn"
                style={{ color: 'var(--ad-bad)' }}
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
