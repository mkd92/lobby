import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { useQuery } from '@tanstack/react-query';
import type { Invoice, Receipt } from '../utils/accounting';
import '../styles/Payments.css';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Hostel   { id: string; name: string; }
interface Room     { id: string; hostel_id: string; room_number: string; }
interface Bed      { id: string; hostel_id: string; room_id: string; bed_number: string; status: string; price?: number; }
interface Lease    {
  id: string;
  tenant_name: string;
  hostel_name?: string;
  bed_number?: string;
  room_number?: string;
  rent_amount: number;
  end_date?: string;
}
interface Payment  {
  id: string;
  tenant_name: string;
  hostel_id?: string | null;
  hostel_name?: string | null;
  property_name?: string | null;
  unit_number?: string | null;
  room_number?: string | null;
  bed_number?: string | null;
  rent_amount: number;
  amount: number;
  payment_date?: string | null;
  payment_method?: string | null;
  month_for: string;
  status: 'Pending' | 'Partial' | 'Paid';
  created_at?: any;
}

interface LedgerEntry {
  id: string;
  payment_id: string;
  tenant_name: string;
  asset: string;
  month_for: string;
  amount: number;
  payment_date: string;
  recorded_at_ms: number;
  payment_method: string;
  is_sub_transaction: boolean;
}

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };

// ── PDF builder ───────────────────────────────────────────────────────────────

interface ReportHTMLParams {
  generatedDate: string;
  scopeNames: string;
  sym: string;
  expiryDays: number;
  vacantBedsCount: number;
  expiringLeasesCount: number;
  outstandingCount: number;
  bedRows: string;
  leaseRows: string;
  paymentRows: string;
}

function buildReportHTML(p: ReportHTMLParams): string {
  const noData = `<tr><td colspan="99" style="text-align:center;color:#999;padding:1.5rem 0;font-style:italic;font-size:0.8rem">No records found</td></tr>`;
  return `<!DOCTYPE html><html><head><title>Portfolio Report — ${p.generatedDate}</title>
<meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',system-ui,-apple-system,sans-serif;padding:3.5rem;color:#111;background:#fff;font-size:13px;line-height:1.6}
  h1{font-size:2.25rem;font-weight:900;letter-spacing:-0.04em;margin-bottom:0.25rem;color:#000}
  h2{font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;color:#666;margin:2.5rem 0 0.75rem;padding-bottom:0.5rem;border-bottom:1.5px solid #eee}
  .meta{font-size:0.75rem;color:#888;margin-bottom:0.25rem;font-weight:600}
  .scope{font-size:0.75rem;color:#555;font-weight:500;margin-bottom:0.15rem}
  .divider{border:none;border-top:3px solid #000;margin:1.5rem 0 2rem}
  .summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;margin:1.5rem 0 2.5rem}
  .summary-card{background:#f8fafc;border-radius:1rem;padding:1.5rem;text-align:left;border:1px solid #e2e8f0}
  .summary-label{font-size:0.6rem;text-transform:uppercase;letter-spacing:0.15em;color:#64748b;font-weight:800;margin-bottom:0.5rem}
  .summary-value{font-size:2.5rem;font-weight:900;color:#0f172a;line-height:1;letter-spacing:-0.02em}
  table{width:100%;border-collapse:collapse;margin-top:0.5rem}
  th{text-align:left;font-size:0.6rem;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;font-weight:800;padding:0.75rem 0.5rem;border-bottom:2px solid #f1f5f9}
  td{padding:0.875rem 0.5rem;border-bottom:1px solid #f1f5f9;vertical-align:middle;color:#334155}
  tr:last-child td{border-bottom:none}
  .status-badge{display:inline-block;padding:0.25rem 0.6rem;border-radius:6px;font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em}
  .footer{margin-top:4rem;padding-top:1.5rem;border-top:1px solid #f1f5f9;text-align:center;font-size:0.7rem;color:#94a3b8;font-weight:600;letter-spacing:0.05em}
  @media print{
    body{padding:2rem}
    .summary-card{border:1px solid #eee;background:#fff!important}
  }
</style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start">
  <div>
    <h1>Portfolio Intelligence</h1>
    <div class="meta">Issued on ${p.generatedDate}</div>
    <div class="scope">Registry: ${p.scopeNames}</div>
    <div class="scope">Maturity Window: ${p.expiryDays} days</div>
  </div>
</div>
<hr class="divider">
<div class="summary-grid">
  <div class="summary-card">
    <div class="summary-label">Vacant Units</div>
    <div class="summary-value">${p.vacantBedsCount}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Upcoming Expirations</div>
    <div class="summary-value">${p.expiringLeasesCount}</div>
  </div>
  <div class="summary-card" style="background:#fffafa;border-color:#fee2e2">
    <div class="summary-label" style="color:#ef4444">Outstanding Arrears</div>
    <div class="summary-value" style="color:#ef4444">${p.outstandingCount}</div>
  </div>
</div>

<h2>Unit Availability (${p.vacantBedsCount})</h2>
<table>
  <thead><tr>
    <th>Facility</th><th>Internal ID</th><th>Vacant Positions</th>
    <th style="text-align:center">Total</th>
  </tr></thead>
  <tbody>${p.bedRows || noData}</tbody>
</table>

<h2>Contractual Maturity — Next ${p.expiryDays} Days (${p.expiringLeasesCount})</h2>
<table>
  <thead><tr>
    <th>Tenant</th><th>Facility</th><th>Inventory</th>
    <th style="text-align:right">Monthly Yield</th>
    <th style="text-align:center">Maturity</th>
    <th style="text-align:center">Days Left</th>
  </tr></thead>
  <tbody>${p.leaseRows || noData}</tbody>
</table>

<h2>Account Receivables — Outstanding (${p.outstandingCount})</h2>
<table>
  <thead><tr>
    <th>Tenant</th><th>Facility</th><th>Inventory</th>
    <th>Period</th>
    <th style="text-align:center">Status</th>
    <th style="text-align:right">Due</th>
    <th style="text-align:right">Settled</th>
    <th style="text-align:right">Balance</th>
  </tr></thead>
  <tbody>${p.paymentRows || noData}</tbody>
</table>

<div class="footer">Confidential Intelligence Report &nbsp;·&nbsp; ${p.generatedDate} &nbsp;·&nbsp; Powered by Lobby</div>
</body></html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const Reports: React.FC = () => {
  const { ownerId } = useOwner();

  const [activeTab, setActiveTab] = useState<'portfolio' | 'ledger'>('portfolio');

  const [selectedHostelIds, setSelectedHostelIds] = useState<Set<string>>(new Set());
  const [expiryDays,        setExpiryDays]        = useState<30 | 60 | 90>(30);
  const [generating,        setGenerating]        = useState(false);

  // Ledger Filters
  const [ledgerMonthFilter, setLedgerMonthFilter] = useState<string>('All');
  const [ledgerSort,        setLedgerSort]        = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'name_asc'>('date_desc');

  const hostelInitialized = useRef(false);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: ownerProfile } = useQuery({
    queryKey: ['owner-profile', ownerId],
    queryFn: async () => { const s = await getDoc(doc(db, 'owners', ownerId!)); return s.data(); },
    enabled: !!ownerId,
  });
  const sym = SYMBOLS[ownerProfile?.currency] || '₹';

  const { data: hostels = [] } = useQuery({
    queryKey: ['hostels', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Hostel[];
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
      if (hostelIds.length === 0) return [];
      const snap = await getDocs(query(collection(db, 'rooms'), where('hostel_id', 'in', hostelIds)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Room[];
    },
    enabled: hostelIds.length > 0,
  });

  const { data: beds = [] } = useQuery({
    queryKey: ['beds-report', hostelIds.join(',')],
    queryFn: async () => {
      if (hostelIds.length === 0) return [];
      const snap = await getDocs(query(collection(db, 'beds'), where('hostel_id', 'in', hostelIds)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Bed[];
    },
    enabled: hostelIds.length > 0,
  });

  const { data: outstandingPayments = [] } = useQuery({
    queryKey: ['payments-outstanding', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, 'payments'),
        where('owner_id', '==', ownerId),
      ));
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Payment)
        .filter(p => p.status === 'Pending' || p.status === 'Partial');
    },
    enabled: !!ownerId,
  });

  // Full Ledger Query
  const { data: ledgerEntries = [], isLoading: ledgerLoading, error: ledgerError } = useQuery({
    queryKey: ['full-ledger', ownerId],
    enabled: !!ownerId && activeTab === 'ledger',
    queryFn: async () => {
      try {
        const [receiptsSnap, invoicesSnap, paymentsSnap, hostelsSnap] = await Promise.all([
          getDocs(query(collection(db, 'receipts'), where('owner_id', '==', ownerId))),
          getDocs(query(collection(db, 'invoices'), where('owner_id', '==', ownerId))),
          getDocs(query(collection(db, 'payments'), where('owner_id', '==', ownerId))),
          getDocs(query(collection(db, 'hostels'), where('owner_id', '==', ownerId))),
        ]);

        const hostelsData = hostelsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
        const hostelMap = new Map(hostelsData.map(h => [h.id, h.name]));
        
        const resolveHostel = (data: any) => {
          let hId = data.hostel_id;
          if (!hId) {
            if (hostelsData.length === 1) hId = hostelsData[0].id;
            else if (data.hostel_name) {
              const storedName = data.hostel_name.toLowerCase();
              const match = hostelsData.find(h => 
                h.name.toLowerCase().includes(storedName) || 
                storedName.includes(h.name.toLowerCase())
              );
              if (match) hId = match.id;
            }
          }
          const hName = hId ? hostelMap.get(hId) : data.hostel_name;
          return { hId, hName };
        };

        const allEntries: LedgerEntry[] = [];

        const hasModernData = !receiptsSnap.empty || !invoicesSnap.empty;

        if (!hasModernData) {
          const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
          for (const p of payments) {
            if (p.amount <= 0) continue;
            const { hName } = resolveHostel(p);
            const assetStr = p.bed_number ? `Rm ${p.room_number} · Bed ${p.bed_number}` : p.unit_number ? `Unit ${p.unit_number}` : '—';
            const fullAsset = `${hName || '—'} · ${assetStr}`;
            try {
              const txSnap = await getDocs(collection(db, 'payments', p.id, 'transactions'));
              if (txSnap.empty) {
                allEntries.push({
                  id: `rect_${p.id}`, payment_id: p.id, tenant_name: p.tenant_name, asset: fullAsset, month_for: p.month_for, amount: p.amount, payment_date: p.payment_date || '', recorded_at_ms: p.payment_date ? new Date(p.payment_date).getTime() : 0, payment_method: p.payment_method || 'Receipt (Paid)', is_sub_transaction: false,
                });
              } else {
                txSnap.docs.forEach(d => {
                  const tx = d.data();
                  const recordedAtMs = tx.recorded_at?.toMillis ? tx.recorded_at.toMillis() : (tx.payment_date ? new Date(tx.payment_date).getTime() : 0);
                  allEntries.push({
                    id: d.id, payment_id: p.id, tenant_name: p.tenant_name, asset: fullAsset, month_for: p.month_for, amount: tx.amount, payment_date: tx.payment_date || p.payment_date || '', recorded_at_ms: recordedAtMs, payment_method: tx.payment_method || 'Receipt (Partial)', is_sub_transaction: true,
                  });
                });
              }
            } catch (txErr) {
              allEntries.push({
                id: `fallback_${p.id}`, payment_id: p.id, tenant_name: p.tenant_name, asset: fullAsset, month_for: p.month_for, amount: p.amount, payment_date: p.payment_date || '', recorded_at_ms: p.payment_date ? new Date(p.payment_date).getTime() : 0, payment_method: p.payment_method || 'Receipt (Paid)', is_sub_transaction: false,
              });
            }
          }
        } else {
          const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as (Invoice & { bed_number?: string; room_number?: string; unit_number?: string; property_name?: string; hostel_name?: string; hostel_id?: string })[];
          const receipts = receiptsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Receipt[];
          receipts.forEach(r => {
            const inv = invoices.find(i => i.id === r.invoice_id);
            const { hName } = resolveHostel(inv || r);
            const assetStr = inv?.bed_number ? `Rm ${inv.room_number} · Bed ${inv.bed_number}` : inv?.unit_number ? `Unit ${inv.unit_number}` : '—';
            const fullAsset = `${hName || '—'} · ${assetStr}`;
            const recordedAtMs = r.created_at?.toMillis ? r.created_at.toMillis() : (r.payment_date ? new Date(r.payment_date).getTime() : 0);
            allEntries.push({
              id: r.id, payment_id: r.invoice_id || '', tenant_name: r.tenant_name, asset: fullAsset, month_for: inv?.month_for || '—', amount: r.amount, payment_date: r.payment_date || '', recorded_at_ms: recordedAtMs, payment_method: r.payment_method || 'Receipt (Paid)', is_sub_transaction: false,
            });
          });
        }
        allEntries.sort((a, b) => b.recorded_at_ms - a.recorded_at_ms);
        return allEntries;
      } catch (err) {
        console.error('Ledger fetch error:', err);
        throw err;
      }
    }
  });

  // ── Initialize selections once data loads ────────────────────────────────

  useEffect(() => {
    if (hostels.length > 0 && !hostelInitialized.current) {
      hostelInitialized.current = true;
      setSelectedHostelIds(new Set(hostels.map(h => h.id)));
    }
  }, [hostels]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const selectedHostelNames = useMemo(
    () => new Set(hostels.filter(h => selectedHostelIds.has(h.id)).map(h => h.name)),
    [hostels, selectedHostelIds],
  );

  const vacantBeds = useMemo(
    () => beds.filter(b => b.status === 'Vacant' && selectedHostelIds.has(b.hostel_id)),
    [beds, selectedHostelIds],
  );

  const roomMap   = useMemo(() => new Map(rooms.map(r => [r.id, r])),   [rooms]);
  const hostelMap = useMemo(() => new Map(hostels.map(h => [h.id, h])), [hostels]);

  const expiringLeases = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + expiryDays);
    return activeLeases.filter(l => {
      if (!l.end_date) return false;
      const end = new Date(l.end_date + 'T00:00:00');
      if (end < today || end > cutoff) return false;
      if (l.hostel_name) return selectedHostelNames.has(l.hostel_name);
      return false;
    });
  }, [activeLeases, expiryDays, selectedHostelNames]);

  const filteredOutstanding = outstandingPayments;
  
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    ledgerEntries.forEach(e => { 
      if (e.month_for && e.month_for !== '—') {
        const cleanMonth = e.month_for.replace(' + Deposit', '');
        months.add(cleanMonth); 
      }
    });
    return Array.from(months).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateB.getTime() - dateA.getTime();
    });
  }, [ledgerEntries]);

  const processedLedger = useMemo(() => {
    let list = ledgerEntries;
    if (ledgerMonthFilter !== 'All') {
      list = list.filter(e => e.month_for.replace(' + Deposit', '') === ledgerMonthFilter);
    }
    return [...list].sort((a, b) => {
      switch (ledgerSort) {
        case 'date_asc':    return a.recorded_at_ms - b.recorded_at_ms;
        case 'amount_desc': return b.amount - a.amount;
        case 'amount_asc':  return a.amount - b.amount;
        case 'name_asc':    return a.tenant_name.localeCompare(b.tenant_name);
        default:            return b.recorded_at_ms - a.recorded_at_ms;
      }
    });
  }, [ledgerEntries, ledgerMonthFilter, ledgerSort]);

  const ledgerStats = useMemo(() => {
    const totalCollected = processedLedger.reduce((acc, curr) => acc + curr.amount, 0);
    return { totalCollected };
  }, [processedLedger]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleHostel = (id: string) => setSelectedHostelIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const selectAll   = () => setSelectedHostelIds(new Set(hostels.map(h => h.id)));
  const deselectAll = () => setSelectedHostelIds(new Set());

  const downloadLedgerCSV = () => {
    if (processedLedger.length === 0) return;
    const header = ['Date', 'Time', 'Tenant', 'Asset', 'Period', 'Method', 'Amount'];
    const rows = processedLedger.map(e => {
      const d = new Date(e.recorded_at_ms || new Date(e.payment_date).getTime() || 0);
      return [ d.toLocaleDateString(), d.toLocaleTimeString(), `"${e.tenant_name}"`, `"${e.asset}"`, e.month_for, e.payment_method, e.amount ].join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Full_Ledger_${ledgerMonthFilter === 'All' ? 'Full' : ledgerMonthFilter.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generatePDF = async () => {
    setGenerating(true);
    const w = window.open('', '_blank', 'width=900,height=760');
    if (!w) { setGenerating(false); return; }

    let liveRoomMap = roomMap;
    if (hostelIds.length > 0) {
      try {
        const snap = await getDocs(query(collection(db, 'rooms'), where('hostel_id', 'in', hostelIds)));
        liveRoomMap = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Room]));
      } catch { }
    }

    const generatedDate = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    const todayMs = new Date(); todayMs.setHours(0, 0, 0, 0);
    const scopeNames = hostels.filter(h => selectedHostelIds.has(h.id)).map(h => h.name).join(', ') || 'None';

    const bedsByRoom = new Map<string, { hostelName: string; roomNumber: string; beds: Bed[] }>();
    vacantBeds.forEach(b => {
      const hostelName = hostelMap.get(b.hostel_id)?.name || '—';
      const room = liveRoomMap.get(b.room_id);
      const key = b.room_id || `${b.hostel_id}-unknown`;
      if (!bedsByRoom.has(key)) {
        bedsByRoom.set(key, { hostelName, roomNumber: room?.room_number ?? '—', beds: [] });
      }
      bedsByRoom.get(key)!.beds.push(b);
    });
    const bedRows = [...bedsByRoom.values()].map(({ hostelName, roomNumber, beds }) => {
      const bedList = beds.map(b => `Bed ${b.bed_number}`).join(', ');
      return `<tr><td>${hostelName}</td><td>Room ${roomNumber}</td><td>${bedList}</td><td style="text-align:center;font-weight:800;color:#10b981">${beds.length}</td></tr>`;
    }).join('');

    const leaseRows = expiringLeases.map(l => {
      const endDate  = l.end_date ? new Date(l.end_date + 'T00:00:00') : null;
      const daysLeft = endDate ? Math.ceil((endDate.getTime() - todayMs.getTime()) / 86400000) : null;
      const urgency  = daysLeft === null ? '#888' : daysLeft <= 7 ? '#ef4444' : daysLeft <= 30 ? '#f59e0b' : '#10b981';
      const unit     = l.bed_number ? `Room ${l.room_number} · Bed ${l.bed_number}` : '—';
      return `<tr><td style="font-weight:700">${l.tenant_name}</td><td>${l.hostel_name || '—'}</td><td>${unit}</td><td style="text-align:right">${sym}${Number(l.rent_amount).toLocaleString()}</td><td style="text-align:center">${endDate ? endDate.toLocaleDateString() : '—'}</td><td style="text-align:center;font-weight:800;color:${urgency}">${daysLeft ?? '—'}</td></tr>`;
    }).join('');

    const paymentRows = filteredOutstanding.map(p => {
      const unit     = p.bed_number ? `Room ${p.room_number} · Bed ${p.bed_number}` : '—';
      const balance  = p.rent_amount - p.amount;
      const isPending = p.status === 'Pending';
      const statusColor = isPending ? '#f59e0b' : '#3b82f6';
      const statusBg    = isPending ? '#fffbeb' : '#eff6ff';
      return `<tr><td style="font-weight:700">${p.tenant_name}</td><td>${p.hostel_name || '—'}</td><td>${unit}</td><td>${p.month_for}</td><td style="text-align:center"><span class="status-badge" style="background:${statusBg};color:${statusColor}">${p.status}</span></td><td style="text-align:right">${sym}${Number(p.rent_amount).toLocaleString()}</td><td style="text-align:right">${sym}${Number(p.amount).toLocaleString()}</td><td style="text-align:right;font-weight:800;color:#ef4444">${sym}${balance.toLocaleString()}</td></tr>`;
    }).join('');

    w.document.write(buildReportHTML({
      generatedDate, scopeNames, sym, expiryDays,
      vacantBedsCount: vacantBeds.length, expiringLeasesCount: expiringLeases.length,
      outstandingCount: filteredOutstanding.length, bedRows, leaseRows, paymentRows,
    }));
    w.document.close(); w.focus();
    setTimeout(() => { w.print(); setGenerating(false); }, 400);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const noneSelected = selectedHostelIds.size === 0;

  const checkboxPillStyle = (selected: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.6rem 1.25rem', borderRadius: '1rem',
    background: selected ? 'var(--surface-container-highest)' : 'var(--surface-container-high)',
    border: selected ? '1px solid var(--primary)' : '1px solid var(--outline-variant)',
    transition: 'all 0.2s ease', fontSize: '0.875rem', fontWeight: 600,
    color: selected ? 'var(--on-surface)' : 'var(--on-surface-variant)', userSelect: 'none',
  });

  return (
    <div className="view-container page-fade-in" style={{ maxWidth: '1000px' }}>

      {/* Header */}
      <header className="view-header">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <p className="view-eyebrow">Insights & Exports</p>
            <h1 className="view-title text-4xl md:text-6xl">Intelligence Center</h1>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="filter-tabs-modern mb-12">
        <button className={`tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`} onClick={() => setActiveTab('portfolio')}>Portfolio Audit{activeTab === 'portfolio' && <div className="tab-indicator" />}</button>
        <button className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')}>Realized Ledger{activeTab === 'ledger' && <div className="tab-indicator" />}</button>
      </div>

      {activeTab === 'portfolio' && (
        <div className="page-fade-in">
          <div className="modern-card mb-12">
            <div className="view-eyebrow mb-8">Audit Configuration</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <label className="view-eyebrow text-[0.6rem] mb-4 block opacity-40">Contract Maturity Window</label>
                <div className="flex gap-2">
                  {([30, 60, 90] as const).map(d => (
                    <button key={d} onClick={() => setExpiryDays(d)} className="primary-button" style={{ flex: 1, padding: '0.75rem', fontSize: '0.8125rem', background: expiryDays === d ? 'var(--primary)' : 'var(--surface-container-high)', color: expiryDays === d ? 'var(--on-primary)' : 'var(--on-surface)', border: expiryDays === d ? 'none' : '1px solid var(--outline-variant)' }}>{d} Days</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="view-eyebrow text-[0.6rem] mb-4 block opacity-40">Facility Registry Scope</label>
                <div className="flex flex-wrap gap-2">
                  {hostels.map(h => (
                    <label key={h.id} style={checkboxPillStyle(selectedHostelIds.has(h.id))}>
                      <input type="checkbox" checked={selectedHostelIds.has(h.id)} onChange={() => toggleHostel(h.id)} style={{ display: 'none' }} />
                      {h.name}
                    </label>
                  ))}
                </div>
                <div className="flex gap-4 mt-4">
                  <button onClick={selectAll} className="text-xs font-bold text-primary opacity-60 hover:opacity-100 uppercase tracking-widest">Select All</button>
                  <button onClick={deselectAll} className="text-xs font-bold text-on-surface-variant opacity-60 hover:opacity-100 uppercase tracking-widest">Clear</button>
                </div>
              </div>
            </div>
          </div>

          <div className="properties-metrics-bar mb-12">
            <div className="prop-metric"><span className="prop-metric-label">Vacant Units</span><span className="prop-metric-value">{vacantBeds.length}</span></div>
            <div className="prop-metric"><span className="prop-metric-label">Maturing Leases</span><span className="prop-metric-value">{expiringLeases.length}</span></div>
            <div className="prop-metric"><span className="prop-metric-label">Accounts Payable</span><span className="prop-metric-value" style={{ color: 'var(--error)' }}>{filteredOutstanding.length}</span></div>
          </div>

          <div className="flex justify-center">
            <button onClick={generatePDF} disabled={generating || noneSelected} className="primary-button py-4 px-12 text-lg">
              <span className="material-symbols-outlined mr-3">print</span>
              {generating ? 'Compiling Intelligence...' : 'Export PDF Portfolio Audit'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="page-fade-in">
          <div className="properties-metrics-bar mb-12">
            <div className="prop-metric"><span className="prop-metric-label">Total Realized Receipts</span><span className="prop-metric-value" style={{ color: 'var(--color-success)' }}>{sym}{ledgerStats.totalCollected.toLocaleString()}</span></div>
            <div className="prop-metric"><span className="prop-metric-label">Transaction Events</span><span className="prop-metric-value">{processedLedger.length}</span></div>
          </div>

          <div className="view-toolbar mb-8" style={{ background: 'var(--surface-container-low)', padding: '1rem', borderRadius: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', opacity: 0.5 }}>calendar_month</span>
              <select value={ledgerMonthFilter} onChange={e => setLedgerMonthFilter(e.target.value)} style={{ width: '100%', background: 'var(--surface-container-high)', border: 'none', borderRadius: '1rem', padding: '0.625rem 1rem 0.625rem 2.25rem', color: 'var(--on-surface)', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', appearance: 'none' }}>
                <option value="All">All Billing Periods</option>
                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ position: 'relative', minWidth: '180px' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', opacity: 0.5 }}>sort</span>
              <select value={ledgerSort} onChange={e => setLedgerSort(e.target.value as any)} style={{ width: '100%', background: 'var(--surface-container-high)', border: 'none', borderRadius: '1rem', padding: '0.625rem 1rem 0.625rem 2.25rem', color: 'var(--on-surface)', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', appearance: 'none' }}>
                <option value="date_desc">Newest First</option><option value="date_asc">Oldest First</option><option value="amount_desc">Highest Amount</option><option value="amount_asc">Lowest Amount</option><option value="name_asc">Tenant A-Z</option>
              </select>
            </div>
          </div>

          <div className="modern-table-wrap mb-12" style={{ borderRadius: '1.5rem' }}>
            <table className="modern-table">
              <thead><tr><th>Date & Time</th><th>Entity</th><th>Asset & Period</th><th>Entry Type</th><th style={{ textAlign: 'right' }}>Value</th></tr></thead>
              <tbody>
                {ledgerLoading ? (<tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Compiling transaction history...</td></tr>) : ledgerError ? (<tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--error)' }}>Audit failure: {(ledgerError as Error).message}</td></tr>) : processedLedger.length === 0 ? (<tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>No realized transactions identified for this selection.</td></tr>) : (
                  processedLedger.map(e => {
                    const dateObj = new Date(e.recorded_at_ms || new Date(e.payment_date).getTime() || 0);
                    return (<tr key={e.id}><td><div className="flex flex-col"><span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{dateObj.toLocaleDateString()}</span><span style={{ fontSize: '0.75rem', opacity: 0.4 }}>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></td><td><span style={{ fontWeight: 700 }}>{e.tenant_name}</span></td><td><div className="flex flex-col"><span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{e.asset}</span><span style={{ fontSize: '0.75rem', opacity: 0.4, fontWeight: 700 }}>{e.month_for}</span></div></td><td><span className="badge-modern badge-success" style={{ fontSize: '0.55rem' }}>{e.payment_method}</span></td><td style={{ textAlign: 'right' }}><span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1rem' }}>{sym}{e.amount.toLocaleString()}</span></td></tr>);
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center">
            <button onClick={downloadLedgerCSV} disabled={ledgerLoading || processedLedger.length === 0} className="primary-button py-4 px-12">
              <span className="material-symbols-outlined mr-3">download</span>
              Export Full CSV Ledger
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
