import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../firebaseClient';
import { useOwner } from '../context/OwnerContext';
import { PageSkeleton } from './layout/PageSkeleton';
import { useDialog } from '../hooks/useDialog';
import { useListKeyNav } from '../hooks/useListKeyNav';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: any;
}

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const { ownerId, userRole } = useOwner();
  const isOwner = userRole === 'owner';
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [searchQuery, setSearchQuery] = useState('');

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['tenants', ownerId],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'tenants'), where('owner_id', '==', ownerId)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
    enabled: !!ownerId,
  });

  const { selectedId: kbSelectedId } = useListKeyNav(customers, (id) => navigate(`/customers/${id}`));

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone || '').includes(searchQuery)
    );
  }, [customers, searchQuery]);

  const handleDelete = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    const ok = await showConfirm(`Are you sure you want to delete the record for ${customer.full_name}? This will not end active leases.`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'tenants', customer.id));
      queryClient.invalidateQueries({ queryKey: ['tenants', ownerId] });
      showAlert('Stakeholder record purged.');
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const fmtDate = (d: any) => d?.toDate ? d.toDate().toLocaleDateString() : '—';

  if (isLoading) return <div className="view-container"><PageSkeleton cols={[1, 3, 3, 2, 2]} rows={7} /></div>;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}

      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <p className="view-eyebrow">Client Registry</p>
          <h1 className="view-title text-4xl md:text-6xl">Relationship Base</h1>
        </div>
        {!isOwner && userRole === 'viewer' ? null : (
          <button onClick={() => navigate('/customers/new')} className="primary-button">
            <span className="material-symbols-outlined mr-2" style={{ verticalAlign: 'middle' }}>person_add</span>
            Identify Tenant
          </button>
        )}
      </header>

      {/* Metrics */}
      {customers.length > 0 && (
        <div className="properties-metrics-bar mb-12">
          <div className="prop-metric">
            <span className="prop-metric-label">Total Entities</span>
            <span className="prop-metric-value">{customers.length}</span>
          </div>
          <div className="prop-metric">
            <span className="prop-metric-label">Registry Integrity</span>
            <span className="prop-metric-value" style={{ color: 'var(--color-success)' }}>100%</span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="view-toolbar mb-8" style={{ background: 'var(--surface-container-low)', padding: '1rem', borderRadius: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.25rem', opacity: 0.3 }}>search</span>
          <input
            type="text"
            placeholder="Search by legal name, email, or contact..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: 'var(--surface-container-high)', border: 'none', borderRadius: '1rem', padding: '0.75rem 1.25rem 0.75rem 3rem', color: 'var(--on-surface)', fontSize: '0.875rem', fontWeight: 600 }}
          />
        </div>
        <div className="view-eyebrow" style={{ margin: 0, opacity: 0.4, fontSize: '0.6rem' }}>
          {filteredCustomers.length} Records Located
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="modern-card" style={{ textAlign: 'center', padding: '6rem 2rem' }}>
          <div style={{ opacity: 0.1, marginBottom: '2rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '4rem' }}>person_search</span>
          </div>
          <h2 className="text-xl font-bold mb-2">No Entities Identified</h2>
          <p className="text-on-surface-variant max-w-md mx-auto mb-8">Adjust your filtering parameters to locate specific stakeholder records.</p>
          <button className="primary-button" style={{ background: 'var(--surface-container-highest)' }} onClick={() => setSearchQuery('')}>Clear Filter</button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="modern-table-wrap desktop-only" style={{ borderRadius: '1.5rem' }}>
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Legal Entity Designation</th>
                  <th>Digital Correspondence</th>
                  <th>Tele-Channel</th>
                  <th>Registration</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} onClick={() => navigate(`/customers/${customer.id}`)} style={{ cursor: 'pointer', outline: kbSelectedId === customer.id ? '2px solid var(--primary)' : undefined, outlineOffset: '-2px' }}>
                    <td>
                      <div className="flex items-center gap-4">
                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--surface-container-highest)', color: 'var(--on-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                          {initials(customer.full_name)}
                        </div>
                        <span style={{ fontWeight: 700 }}>{customer.full_name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--on-surface-variant)' }}>{customer.email || '—'}</td>
                    <td style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--on-surface-variant)' }}>{customer.phone || '—'}</td>
                    <td style={{ fontSize: '0.8125rem', fontWeight: 600, opacity: 0.5 }}>{fmtDate(customer.created_at)}</td>
                    <td><span className="badge-modern badge-success">Verified</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-2 justify-end items-center">
                        {isOwner && (
                          <button className="btn-icon danger" onClick={(e) => handleDelete(e, customer)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>delete</span>
                          </button>
                        )}
                        <span className="material-symbols-outlined opacity-20" style={{ marginLeft: '0.5rem' }}>arrow_forward_ios</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="mobile-only flex flex-col gap-4">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="modern-card" style={{ padding: '1.5rem' }} onClick={() => navigate(`/customers/${customer.id}`)}>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4 items-center">
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--surface-container-highest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.125rem' }}>
                      {initials(customer.full_name)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{customer.full_name}</h3>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>Registered Entity</div>
                    </div>
                  </div>
                  <span className="badge-modern badge-success">Verified</span>
                </div>
                <div className="flex flex-col gap-2 text-sm" style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined opacity-40" style={{ fontSize: '1.125rem' }}>call</span>{customer.phone || 'No contact channel'}</div>
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined opacity-40" style={{ fontSize: '1.125rem' }}>mail</span>{customer.email || 'No digital address'}</div>
                </div>
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.3 }}>Since {fmtDate(customer.created_at)}</span>
                  <span className="material-symbols-outlined opacity-20">arrow_forward_ios</span>
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
