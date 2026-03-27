import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import '../styles/Properties.css';
import '../styles/Units.css';
import '../styles/Leases.css';

interface Customer {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
}

const Customers: React.FC = () => {
  const { showAlert, showConfirm, DialogMount } = useDialog();
  const { isStaff } = useOwner();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit modal
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone: '' });
  const [saving, setSaving]     = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCustomers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // ── Search & Filter ─────────────────────────────────────────────────
  const filteredCustomers = customers.filter(c => {
    const query = searchQuery.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(query) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      (c.phone && c.phone.includes(query))
    );
  });

  // ── Edit ────────────────────────────────────────────────────────────
  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditForm({ full_name: c.full_name, email: c.email || '', phone: c.phone || '' });
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ full_name: editForm.full_name, email: editForm.email, phone: editForm.phone })
        .eq('id', editingCustomer.id);
      if (error) throw error;
      setEditingCustomer(null);
      fetchCustomers();
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────
  const handleDelete = async (customer: Customer) => {
    const { data: activeLeases } = await supabase
      .from('leases')
      .select('id')
      .eq('tenant_id', customer.id)
      .eq('status', 'Active');

    if (activeLeases && activeLeases.length > 0) {
      await showAlert(`Cannot delete — ${customer.full_name} has ${activeLeases.length} active lease(s).\nTerminate or expire their leases first.`);
      return;
    }

    const ok = await showConfirm(`Delete ${customer.full_name}? This cannot be undone.`, { danger: true });
    if (!ok) return;

    const { error } = await supabase.from('tenants').delete().eq('id', customer.id);
    if (error) return showAlert(error.message);
    fetchCustomers();
  };

  if (loading) return <div className="p-12">Loading customers...</div>;

  return (
    <div className="properties-container" style={{ padding: '1rem' }}>
      {DialogMount}
      <div className="page-header-wrapper mb-10">
        <header className="page-header">
          <div>
            <h1 className="display-small mb-1">Customers</h1>
            <p className="text-on-surface-variant">Manage your tenants and clients.</p>
          </div>
          {!isStaff && (
            <Link to="/customers/new" className="primary-button desktop-only">
              + Add Customer
            </Link>
          )}
        </header>

        <div className="search-bar-row">
          <div className="search-field">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="Search people..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {!isStaff && (
            <Link to="/customers/new" className="primary-button mobile-only" style={{ padding: '0.75rem 1rem', minWidth: 'auto' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>add</span>
            </Link>
          )}
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined opacity-20 mb-4" style={{ fontSize: '4rem' }}>group</span>
          <h2 className="mb-2">No customers yet</h2>
          <p className="text-on-surface-variant mb-8">Start by adding your first tenant or customer.</p>
          <Link to="/customers/new" className="primary-button">Add First Customer</Link>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined opacity-20 mb-4" style={{ fontSize: '4rem' }}>person_search</span>
          <h2 className="mb-2">No matches found</h2>
          <p className="text-on-surface-variant">Try adjusting your search terms.</p>
          <button className="primary-button glass mt-4" onClick={() => setSearchQuery('')}>Clear Search</button>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="units-table-container desktop-only">
            <table className="units-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(customer => (
                  <tr key={customer.id}>
                    <td style={{ fontWeight: 800 }}>{customer.full_name}</td>
                    <td>{customer.email || '—'}</td>
                    <td>{customer.phone || '—'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
                      {new Date(customer.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span className="status-badge status-occupied">Active</span>
                    </td>
                    <td>
                      {!isStaff && (
                        <div className="row-actions">
                          <button className="icon-action-btn" title="Edit" onClick={() => openEdit(customer)}>
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button className="icon-action-btn danger" title="Delete" onClick={() => handleDelete(customer)}>
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="mobile-only customer-cards-list">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="customer-mobile-card">
                <div className="customer-card-header">
                  <div className="customer-avatar">
                    {customer.full_name.charAt(0)}
                  </div>
                  <div className="customer-main-info">
                    <h3>{customer.full_name}</h3>
                    <span className="status-badge status-occupied" style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem' }}>Active</span>
                  </div>
                  {!isStaff && (
                    <div className="customer-card-actions">
                      <button className="icon-action-btn" onClick={() => openEdit(customer)}>
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button className="icon-action-btn danger" onClick={() => handleDelete(customer)}>
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  )}
                </div>
                <div className="customer-card-body">
                  <div className="info-row">
                    <span className="material-symbols-outlined">call</span>
                    <span>{customer.phone || 'No phone'}</span>
                  </div>
                  <div className="info-row">
                    <span className="material-symbols-outlined">mail</span>
                    <span>{customer.email || 'No email'}</span>
                  </div>
                  <div className="info-row">
                    <span className="material-symbols-outlined">calendar_today</span>
                    <span>Joined: {new Date(customer.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Edit Modal ── */}
      {editingCustomer && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingCustomer(null)}>
          <div className="lease-modal" style={{ maxWidth: '480px' }}>
            <div className="lease-modal-header">
              <div>
                <h2>Edit Customer</h2>
                <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.25rem' }}>Update tenant details</p>
              </div>
              <button className="icon-action-btn" onClick={() => setEditingCustomer(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSave}>
              <div className="lease-modal-body">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.full_name}
                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-row cols-2">
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="john@example.com"
                      value={editForm.email}
                      onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+1 (555) 000-0000"
                      value={editForm.phone}
                      onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="lease-modal-footer">
                <button type="button" className="primary-button glass" onClick={() => setEditingCustomer(null)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
