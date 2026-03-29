import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import '../styles/Properties.css';
import '../styles/Leases.css';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: any;
}

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const { showAlert, showConfirm, DialogMount } = useDialog();
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'tenants'), where('owner_id', '==', ownerId)));
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Customer))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!ownerId,
  });

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return customers.filter(c => 
      c.full_name.toLowerCase().includes(q) || 
      (c.email && c.email.toLowerCase().includes(q)) || 
      (c.phone && c.phone.includes(q))
    );
  }, [customers, searchQuery]);

  const handleDelete = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    const activeSnap = await getDocs(
      query(collection(db, 'leases'), where('tenant_id', '==', customer.id), where('status', '==', 'Active'))
    );
    if (!activeSnap.empty) {
      await showAlert(`Cannot terminate entity — ${customer.full_name} has ${activeSnap.size} active agreement(s).\nTerminate all active contracts first.`);
      return;
    }
    const ok = await showConfirm(`Are you sure you want to remove ${customer.full_name} from the registry?`, { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'tenants', customer.id));
      queryClient.invalidateQueries({ queryKey: ['customers', ownerId] });
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  const fmtDate = (ts: any) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  if (isLoading) return <LoadingScreen message="Retrieving Stakeholder Data" />;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}
      
      <header className="view-header">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <p className="view-eyebrow">Relationship Base</p>
            <h1 className="view-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', margin: 0 }}>Stakeholder Registry</h1>
          </div>
          {!isStaff && (
            <button onClick={() => navigate('/customers/new')} className="primary-button">
              <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle', fontSize: '1.25rem' }}>person_add</span>
              Onboard Entity
            </button>
          )}
        </div>
      </header>

      {/* Metrics Bar */}
      {customers.length > 0 && (
        <div className="properties-metrics-bar custom-scrollbar">
          <div className="prop-metric">
            <span className="prop-metric-label">Registered Entities</span>
            <span className="prop-metric-value">{customers.length}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Active Relationships</span>
            <span className="prop-metric-value" style={{ color: 'var(--color-success)' }}>{filteredCustomers.length}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Identification Rate</span>
            <span className="prop-metric-value" style={{ fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 'auto' }}>Verified</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="properties-toolbar">
        <div className="prop-search-wrapper">
          <span className="material-symbols-outlined search-icon">search</span>
          <input 
            type="text" 
            placeholder="Filter entities by name, digital address, or contact..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="prop-search-input"
          />
        </div>
        <div className="prop-filter-count">
          {filteredCustomers.length} / {customers.length} Entities Identified
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="empty-state modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div className="empty-state-icon" style={{ opacity: 0.2, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>group_off</span>
          </div>
          <h2 className="mb-4">Empty Registry</h2>
          <p className="text-on-surface-variant mb-10 max-w-md mx-auto">Initialize your relationship management base by onboarding your first legal entity or tenant.</p>
          {!isStaff && (
            <button onClick={() => navigate('/customers/new')} className="primary-button">Start Onboarding</button>
          )}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="empty-state modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div className="empty-state-icon" style={{ opacity: 0.2, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>person_search</span>
          </div>
          <h2 className="mb-4">No Entities Identified</h2>
          <p className="text-on-surface-variant">Adjust your filtering parameters to locate specific stakeholder records.</p>
          <button className="primary-button glass-panel mt-8" onClick={() => setSearchQuery('')} style={{ background: 'rgba(255,255,255,0.05)' }}>Clear Filter</button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="leases-table-container desktop-only">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Legal Entity Designation</th>
                  <th>Correspondence Address</th>
                  <th>Primary Tele-Channel</th>
                  <th>Registration</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} onClick={() => navigate(`/customers/${customer.id}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div className="flex items-center gap-4">
                        <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--primary-container)', color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.875rem' }}>
                          {initials(customer.full_name)}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{customer.full_name}</span>
                      </div>
                    </td>
                    <td className="text-on-surface-variant" style={{ fontSize: '0.875rem', fontWeight: 500 }}>{customer.email || '—'}</td>
                    <td className="text-on-surface-variant" style={{ fontSize: '0.875rem', fontWeight: 500 }}>{customer.phone || '—'}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>{fmtDate(customer.created_at)}</td>
                    <td><span className="badge-modern badge-success" style={{ fontSize: '0.55rem' }}>Verified</span></td>
                    <td>
                      {!isStaff && (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn-icon danger" style={{ color: 'var(--error)' }} onClick={(e) => handleDelete(e, customer)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="mobile-only flex flex-col gap-5">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="modern-card glass-panel" style={{ padding: '1.5rem', cursor: 'pointer' }} onClick={() => navigate(`/customers/${customer.id}`)}>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4 items-center">
                    <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--primary-container)', color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.125rem' }}>
                      {initials(customer.full_name)}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>{customer.full_name}</h3>
                      <span className="badge-modern badge-success" style={{ fontSize: '0.5rem', padding: '0.1rem 0.4rem', marginTop: '0.25rem' }}>Registered Entity</span>
                    </div>
                  </div>
                  {!isStaff && (
                    <div className="flex gap-2">
                      <button className="btn-icon danger" style={{ color: 'var(--error)' }} onClick={(e) => handleDelete(e, customer)}><span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span></button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3 text-sm" style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined opacity-40" style={{ fontSize: '1.125rem' }}>call</span>{customer.phone || 'No contact channel'}</div>
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined opacity-40" style={{ fontSize: '1.125rem' }}>mail</span>{customer.email || 'No digital address'}</div>
                  <div className="mt-2 pt-4 border-t border-white/5 opacity-50 flex items-center gap-3 text-xs uppercase tracking-widest font-black">
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>verified</span>
                    Identified {fmtDate(customer.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Customers;
