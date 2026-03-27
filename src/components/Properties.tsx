import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import '../styles/Properties.css';

const propertyTypes = ['Residential', 'Commercial', 'Industrial', 'Mixed'];

interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  unitCount?: number;
}

const Properties: React.FC = () => {
  const navigate = useNavigate();
  const { showAlert, showConfirm, DialogMount } = useDialog();
  const { ownerId, isStaff } = useOwner();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editData, setEditData] = useState({ name: '', address: '', type: '' });
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchProperties = useCallback(async () => {
    if (!ownerId) return;
    try {
      const [propSnap, unitSnap] = await Promise.all([
        getDocs(query(collection(db, 'properties'), where('owner_id', '==', ownerId))),
        getDocs(query(collection(db, 'units'), where('owner_id', '==', ownerId))),
      ]);

      const unitCounts: Record<string, number> = {};
      unitSnap.docs.forEach(d => {
        const pid = d.data().property_id;
        if (pid) unitCounts[pid] = (unitCounts[pid] || 0) + 1;
      });

      const props: Property[] = propSnap.docs
        .map(d => ({ id: d.id, ...d.data(), unitCount: unitCounts[d.id] || 0 } as Property))
        .sort((a, b) => a.name.localeCompare(b.name));

      setProperties(props);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const openEdit = (e: React.MouseEvent, property: Property) => {
    e.preventDefault();
    e.stopPropagation();
    setEditData({ name: property.name, address: property.address, type: property.type });
    setEditingProperty(property);
    setTypeDropdownOpen(false);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'properties', editingProperty.id), editData);
      setEditingProperty(null);
      fetchProperties();
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, property: Property) => {
    e.preventDefault();
    e.stopPropagation();

    const unitSnap = await getDocs(
      query(collection(db, 'units'), where('property_id', '==', property.id), where('status', '==', 'Occupied'))
    );

    if (!unitSnap.empty) {
      await showAlert(`Cannot delete — ${unitSnap.size} unit(s) are currently occupied.\nPlease terminate all active leases first.`);
      return;
    }

    const ok = await showConfirm(`Delete "${property.name}" and all its units? This cannot be undone.`, { danger: true });
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'properties', property.id));
      fetchProperties();
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (loading) return <div className="p-12">Loading properties...</div>;

  return (
    <div className="properties-container">
      {DialogMount}
      <header className="page-header mb-12">
        <div>
          <h1 className="display-small mb-2">Properties</h1>
          <p className="text-on-surface-variant">Manage your real estate portfolio.</p>
        </div>
        {!isStaff && (
          <Link to="/properties/new" className="primary-button">+ Add Property</Link>
        )}
      </header>

      {properties.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined" style={{ fontSize: '4rem', opacity: 0.2, display: 'block', marginBottom: '1rem' }}>domain</span>
          <h2 className="mb-2">No properties yet</h2>
          <p className="text-on-surface-variant mb-8">Start by adding your first property to the platform.</p>
          <Link to="/properties/new" className="primary-button" style={{ textDecoration: 'none' }}>Create First Property</Link>
        </div>
      ) : (
        <div className="properties-grid">
          {properties.map(property => (
            <div key={property.id} className="property-card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/properties/${property.id}`)}>
              <div className="property-header-compact">
                <div className="property-icon-box">
                  <span className="material-symbols-outlined">apartment</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <div className="property-type-badge">{property.type}</div>
                  {!isStaff && (
                    <div className="property-actions-compact" onClick={e => e.stopPropagation()}>
                      <button className="prop-action-btn" title="Edit property" onClick={e => openEdit(e, property)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>edit</span>
                      </button>
                      <button className="prop-action-btn danger" title="Delete property" onClick={e => handleDelete(e, property)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="property-info">
                <h3 className="property-name">{property.name}</h3>
                <div className="property-address">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>location_on</span>
                  {property.address}
                </div>
                <div className="property-stats">
                  <div className="stat-item">
                    <div className="stat-label">Units</div>
                    <div className="stat-value">{property.unitCount || 0}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">Status</div>
                    <div className="stat-value" style={{ color: 'var(--primary)' }}>Active</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingProperty && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingProperty(null)}>
          <div className="modal-content" style={{ borderRadius: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Edit Property</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.6 }}>Update the property details</p>
              </div>
              <button className="icon-action-btn" onClick={() => setEditingProperty(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="unit-input-group">
                <label>Property Name</label>
                <input type="text" className="unit-mini-input" value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} required style={{ padding: '0.7rem 0.9rem', borderRadius: '0.75rem' }} />
              </div>
              <div className="unit-input-group">
                <label>Address</label>
                <input type="text" className="unit-mini-input" value={editData.address} onChange={e => setEditData(d => ({ ...d, address: e.target.value }))} required style={{ padding: '0.7rem 0.9rem', borderRadius: '0.75rem' }} />
              </div>
              <div className="unit-input-group">
                <label>Type</label>
                <div className="custom-select-container">
                  <div
                    className={`custom-select-trigger ${typeDropdownOpen ? 'open' : ''}`}
                    style={{ padding: '0.7rem 0.9rem', fontSize: '0.9rem' }}
                    onClick={() => setTypeDropdownOpen(o => !o)}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTypeDropdownOpen(o => !o); } if (e.key === 'Escape') setTypeDropdownOpen(false); }}
                  >
                    {editData.type}
                    <span className="material-symbols-outlined" style={{ transition: '0.2s', transform: typeDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '1.1rem' }}>keyboard_arrow_down</span>
                  </div>
                  {typeDropdownOpen && (
                    <div className="custom-options">
                      {propertyTypes.map(t => (
                        <div key={t} className={`custom-option ${editData.type === t ? 'selected' : ''}`} onClick={() => { setEditData(d => ({ ...d, type: t })); setTypeDropdownOpen(false); }}>
                          {t}
                          {editData.type === t && <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>check</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                <button type="button" className="primary-button glass" style={{ padding: '0.7rem 1.5rem' }} onClick={() => setEditingProperty(null)}>Cancel</button>
                <button type="submit" className="primary-button" style={{ padding: '0.7rem 2rem' }} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Properties;
