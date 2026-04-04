import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useQuery } from '@tanstack/react-query';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Property { id: string; name: string; }
interface Hostel   { id: string; name: string; }
interface Unit     { id: string; property_id: string; unit_number: string; status: string; type?: string; base_rent?: number; }
interface Room     { id: string; hostel_id: string; room_number: string; }
interface Bed      { id: string; hostel_id: string; room_id: string; bed_number: string; status: string; price?: number; }
interface Lease    {
  id: string;
  tenant_name: string;
  property_name?: string;
  hostel_name?: string;
  unit_number?: string;
  bed_number?: string;
  room_number?: string;
  rent_amount: number;
  end_date?: string;
}

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };

// ── PDF builder ───────────────────────────────────────────────────────────────

interface ReportHTMLParams {
  generatedDate: string;
  scopeNames: string;
  sym: string;
  expiryDays: number;
  vacantUnitsCount: number;
  vacantBedsCount: number;
  expiringLeasesCount: number;
  unitRows: string;
  bedRows: string;
  leaseRows: string;
}

function buildReportHTML(p: ReportHTMLParams): string {
  const noData = `<tr><td colspan="99" style="text-align:center;color:#999;padding:1.5rem 0;font-style:italic;font-size:0.8rem">No records found</td></tr>`;
  return `<!DOCTYPE html><html><head><title>Portfolio Report — ${p.generatedDate}</title>
<meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;padding:2.5rem;color:#111;background:#fff;font-size:14px;line-height:1.5}
  h1{font-size:1.75rem;font-weight:900;letter-spacing:-0.03em;margin-bottom:0.25rem}
  h2{font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#555;margin:2rem 0 0.625rem;padding-bottom:0.4rem;border-bottom:1.5px solid #111}
  .meta{font-size:0.75rem;color:#888;margin-bottom:0.15rem}
  .scope{font-size:0.75rem;color:#666;font-style:italic;margin-bottom:0.1rem}
  .divider{border:none;border-top:2.5px solid #111;margin:1.25rem 0 1rem}
  .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0.875rem;margin:1rem 0 1.5rem}
  .summary-card{background:#f5f5f5;border-radius:0.625rem;padding:1rem 1.25rem;text-align:center}
  .summary-label{font-size:0.6rem;text-transform:uppercase;letter-spacing:0.12em;color:#888;font-weight:700;margin-bottom:0.25rem}
  .summary-value{font-size:2rem;font-weight:900;color:#111;line-height:1}
  table{width:100%;border-collapse:collapse;margin-top:0.25rem;font-size:0.8125rem}
  th{text-align:left;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:#666;font-weight:700;padding:0.5rem 0.5rem 0.5rem;border-bottom:1px solid #ddd}
  td{padding:0.55rem 0.5rem;border-bottom:1px solid #f0f0f0;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  .footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid #e5e5e5;text-align:center;font-size:0.65rem;color:#bbb;letter-spacing:0.05em}
  @media print{
    body{padding:1.5rem}
    h2{break-before:avoid}
    table{break-inside:auto}
    tr{break-inside:avoid;page-break-inside:avoid}
  }
</style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <h1>PORTFOLIO REPORT</h1>
    <div class="meta">Generated on ${p.generatedDate}</div>
    <div class="scope">Scope: ${p.scopeNames}</div>
    <div class="scope">Lease expiry window: Next ${p.expiryDays} days</div>
  </div>
</div>
<hr class="divider">
<div class="summary-grid">
  <div class="summary-card">
    <div class="summary-label">Vacant Units</div>
    <div class="summary-value">${p.vacantUnitsCount}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Vacant Beds</div>
    <div class="summary-value">${p.vacantBedsCount}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Expiring Leases</div>
    <div class="summary-value">${p.expiringLeasesCount}</div>
  </div>
</div>

<h2>Vacant Units (${p.vacantUnitsCount})</h2>
<table>
  <thead><tr>
    <th>Property</th><th>Unit</th><th>Type</th>
    <th style="text-align:right">Monthly Rent</th>
  </tr></thead>
  <tbody>${p.unitRows || noData}</tbody>
</table>

<h2>Vacant Beds (${p.vacantBedsCount})</h2>
<table>
  <thead><tr>
    <th>Hostel</th><th>Room</th><th>Bed</th>
    <th style="text-align:right">Price / mo</th>
  </tr></thead>
  <tbody>${p.bedRows || noData}</tbody>
</table>

<h2>Expiring Leases — Next ${p.expiryDays} Days (${p.expiringLeasesCount})</h2>
<table>
  <thead><tr>
    <th>Tenant</th><th>Property / Hostel</th><th>Unit / Bed</th>
    <th style="text-align:right">Rent</th>
    <th style="text-align:center">Expires</th>
    <th style="text-align:center">Days Left</th>
  </tr></thead>
  <tbody>${p.leaseRows || noData}</tbody>
</table>

<div class="footer">Generated by Lobby &nbsp;·&nbsp; ${p.generatedDate}</div>
</body></html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId } = useOwner();

  const [selectedPropIds,   setSelectedPropIds]   = useState<Set<string>>(new Set());
  const [selectedHostelIds, setSelectedHostelIds] = useState<Set<string>>(new Set());
  const [expiryDays,        setExpiryDays]        = useState<30 | 60 | 90>(30);
  const [generating,        setGenerating]        = useState(false);

  const propInitialized   = useRef(false);
  const hostelInitialized = useRef(false);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', ownerId],
    queryFn: async () => { const s = await getDoc(doc(db, 'owners', ownerId!)); return s.data(); },
    enabled: !!ownerId,
  });
  const sym = SYMBOLS[ownerProfile?.currency] || '₹';

  const { data: properties = [] } = useQuery({
    queryKey: ['properties', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'properties'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Property[];
    },
    enabled: !!ownerId,
  });

  const { data: hostels = [] } = useQuery({
    queryKey: ['hostels', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Hostel[];
    },
    enabled: !!ownerId,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'units'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Unit[];
    },
    enabled: !!ownerId,
  });

  const { data: activeLeases = [] } = useQuery({
    queryKey: ['leases-active-report', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, 'leases'),
        where('owner_id', '==', ownerId),
        where('status', '==', 'Active'),
      ));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Lease[];
    },
    enabled: !!ownerId,
  });

  const hostelIds = useMemo(() => hostels.map(h => h.id), [hostels]);

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms-report', hostelIds.join(',')],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'rooms'), where('hostel_id', 'in', hostelIds)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Room[];
    },
    enabled: hostelIds.length > 0,
  });

  const { data: beds = [] } = useQuery({
    queryKey: ['beds-report', hostelIds.join(',')],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'beds'), where('hostel_id', 'in', hostelIds)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Bed[];
    },
    enabled: hostelIds.length > 0,
  });

  // ── Initialize selections once data loads ────────────────────────────────

  useEffect(() => {
    if (properties.length > 0 && !propInitialized.current) {
      propInitialized.current = true;
      setSelectedPropIds(new Set(properties.map(p => p.id)));
    }
  }, [properties]);

  useEffect(() => {
    if (hostels.length > 0 && !hostelInitialized.current) {
      hostelInitialized.current = true;
      setSelectedHostelIds(new Set(hostels.map(h => h.id)));
    }
  }, [hostels]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const selectedPropertyNames = useMemo(
    () => new Set(properties.filter(p => selectedPropIds.has(p.id)).map(p => p.name)),
    [properties, selectedPropIds],
  );

  const selectedHostelNames = useMemo(
    () => new Set(hostels.filter(h => selectedHostelIds.has(h.id)).map(h => h.name)),
    [hostels, selectedHostelIds],
  );

  const vacantUnits = useMemo(
    () => units.filter(u => u.status === 'Vacant' && selectedPropIds.has(u.property_id)),
    [units, selectedPropIds],
  );

  const vacantBeds = useMemo(
    () => beds.filter(b => b.status === 'Vacant' && selectedHostelIds.has(b.hostel_id)),
    [beds, selectedHostelIds],
  );

  const roomMap     = useMemo(() => new Map(rooms.map(r => [r.id, r])),         [rooms]);
  const propertyMap = useMemo(() => new Map(properties.map(p => [p.id, p])),    [properties]);
  const hostelMap   = useMemo(() => new Map(hostels.map(h => [h.id, h])),       [hostels]);

  const expiringLeases = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + expiryDays);
    return activeLeases.filter(l => {
      if (!l.end_date) return false;
      const end = new Date(l.end_date + 'T00:00:00');
      if (end < today || end > cutoff) return false;
      if (l.property_name) return selectedPropertyNames.has(l.property_name);
      if (l.hostel_name)   return selectedHostelNames.has(l.hostel_name);
      return false;
    });
  }, [activeLeases, expiryDays, selectedPropertyNames, selectedHostelNames]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleProp = (id: string) => setSelectedPropIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const toggleHostel = (id: string) => setSelectedHostelIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const selectAll   = () => { setSelectedPropIds(new Set(properties.map(p => p.id))); setSelectedHostelIds(new Set(hostels.map(h => h.id))); };
  const deselectAll = () => { setSelectedPropIds(new Set()); setSelectedHostelIds(new Set()); };

  const generatePDF = () => {
    setGenerating(true);
    const w = window.open('', '_blank', 'width=900,height=760');
    if (!w) { setGenerating(false); return; }

    const generatedDate = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    const todayMs = new Date(); todayMs.setHours(0, 0, 0, 0);

    const scopeNames = [
      ...properties.filter(p => selectedPropIds.has(p.id)).map(p => p.name),
      ...hostels.filter(h => selectedHostelIds.has(h.id)).map(h => h.name),
    ].join(', ') || 'None';

    const unitRows = vacantUnits.map(u => {
      const propName = propertyMap.get(u.property_id)?.name || '—';
      return `<tr>
        <td>${propName}</td>
        <td style="font-weight:700">${u.unit_number}</td>
        <td>${u.type || '—'}</td>
        <td style="text-align:right;font-weight:700">${u.base_rent ? sym + u.base_rent.toLocaleString() : '—'}</td>
      </tr>`;
    }).join('');

    const bedRows = vacantBeds.map(b => {
      const hostelName = hostelMap.get(b.hostel_id)?.name || '—';
      const room = roomMap.get(b.room_id);
      return `<tr>
        <td>${hostelName}</td>
        <td>${room ? 'Room ' + room.room_number : '—'}</td>
        <td style="font-weight:700">Bed ${b.bed_number}</td>
        <td style="text-align:right;font-weight:700">${b.price ? sym + b.price.toLocaleString() : '—'}</td>
      </tr>`;
    }).join('');

    const leaseRows = expiringLeases.map(l => {
      const endDate  = l.end_date ? new Date(l.end_date + 'T00:00:00') : null;
      const daysLeft = endDate ? Math.ceil((endDate.getTime() - todayMs.getTime()) / 86400000) : null;
      const urgency  = daysLeft === null ? '#888' : daysLeft <= 7 ? '#dc2626' : daysLeft <= 30 ? '#d97706' : '#16a34a';
      const location = l.property_name || l.hostel_name || '—';
      const unit     = l.bed_number ? `Room ${l.room_number} · Bed ${l.bed_number}` : l.unit_number ? `Unit ${l.unit_number}` : '—';
      return `<tr>
        <td style="font-weight:700">${l.tenant_name}</td>
        <td>${location}</td>
        <td>${unit}</td>
        <td style="text-align:right">${sym}${Number(l.rent_amount).toLocaleString()}</td>
        <td style="text-align:center">${endDate ? endDate.toLocaleDateString() : '—'}</td>
        <td style="text-align:center;font-weight:800;color:${urgency}">${daysLeft ?? '—'}</td>
      </tr>`;
    }).join('');

    w.document.write(buildReportHTML({
      generatedDate, scopeNames, sym, expiryDays,
      vacantUnitsCount: vacantUnits.length,
      vacantBedsCount: vacantBeds.length,
      expiringLeasesCount: expiringLeases.length,
      unitRows, bedRows, leaseRows,
    }));
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); setGenerating(false); }, 400);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const noneSelected = selectedPropIds.size === 0 && selectedHostelIds.size === 0;

  const checkboxPillStyle = (selected: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    padding: '0.5rem 1rem',
    borderRadius: '0.875rem',
    background: selected ? 'var(--surface-container-highest)' : 'var(--surface-container-high)',
    border: selected ? '1.5px solid var(--primary)' : '1.5px solid transparent',
    transition: 'all 0.2s ease',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: selected ? 'var(--on-surface)' : 'var(--on-surface-variant)',
    userSelect: 'none',
  });

  return (
    <div className="view-container" style={{ maxWidth: '860px', margin: '0 auto' }}>

      {/* Header */}
      <header className="view-header">
        <div>
          <div className="view-eyebrow" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: '0.5rem' }}>arrow_back</span>
            Back
          </div>
          <h1 className="view-title">Portfolio Report</h1>
          <p className="text-on-surface-variant mt-2">Vacant stock and upcoming lease expirations.</p>
        </div>
      </header>

      {/* Configuration Card */}
      <div className="modern-card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>

        {/* Expiry Window */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, opacity: 0.4, marginBottom: '0.875rem' }}>
            Lease Expiry Window
          </div>
          <div style={{ display: 'flex', gap: '0.625rem' }}>
            {([30, 60, 90] as const).map(d => (
              <button
                key={d}
                onClick={() => setExpiryDays(d)}
                style={{
                  padding: '0.6rem 1.375rem',
                  borderRadius: '0.875rem',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: expiryDays === d ? 'var(--primary)' : 'var(--surface-container-high)',
                  color: expiryDays === d ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                }}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>

        {/* Properties */}
        {properties.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, opacity: 0.4, marginBottom: '0.875rem' }}>
              Properties
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {properties.map(p => (
                <label key={p.id} style={checkboxPillStyle(selectedPropIds.has(p.id))}>
                  <input
                    type="checkbox"
                    checked={selectedPropIds.has(p.id)}
                    onChange={() => toggleProp(p.id)}
                    style={{ accentColor: 'var(--primary)', width: '14px', height: '14px', flexShrink: 0 }}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Hostels */}
        {hostels.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, opacity: 0.4, marginBottom: '0.875rem' }}>
              Hostels
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {hostels.map(h => (
                <label key={h.id} style={checkboxPillStyle(selectedHostelIds.has(h.id))}>
                  <input
                    type="checkbox"
                    checked={selectedHostelIds.has(h.id)}
                    onChange={() => toggleHostel(h.id)}
                    style={{ accentColor: 'var(--primary)', width: '14px', height: '14px', flexShrink: 0 }}
                  />
                  {h.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Select / Deselect All */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={selectAll}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary)', padding: 0, textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            Select All
          </button>
          <span style={{ opacity: 0.3, fontSize: '1rem' }}>·</span>
          <button
            onClick={deselectAll}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--on-surface-variant)', padding: 0, textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="properties-metrics-bar" style={{ marginBottom: '2.5rem' }}>
        {[
          { label: 'Vacant Units',            value: vacantUnits.length     },
          { label: 'Vacant Beds',             value: vacantBeds.length      },
          { label: `Expiring (${expiryDays}d)`, value: expiringLeases.length },
        ].map(m => (
          <div key={m.label} className="prop-metric">
            <div className="prop-metric-label">{m.label}</div>
            <div className="prop-metric-value">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Download Button */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={generatePDF}
          disabled={generating || noneSelected}
          className="primary-button"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 2.5rem', fontSize: '1rem', minWidth: '260px', justifyContent: 'center', opacity: noneSelected ? 0.45 : 1 }}
        >
          <span className="material-symbols-outlined">download</span>
          {generating ? 'Preparing...' : 'Download PDF Report'}
        </button>
      </div>

    </div>
  );
};

export default Reports;
