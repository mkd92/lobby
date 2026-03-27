import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import '../styles/Units.css';
import '../styles/Properties.css';

const unitTypes = ['Studio', '1BHK', '2BHK', '3BHK', 'Office', 'Retail', 'Warehouse'];
const propertyTypes = ['Residential', 'Commercial', 'Industrial', 'Mixed'];

const currencySymbols: { [key: string]: string } = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$'
};

interface Unit {
  id: string;
  unit_number: string;
  floor: number;
  type: string;
  status: 'Vacant' | 'Occupied' | 'Maintenance';
  base_rent: number;
  area_sqft: number;
}

interface Property {
  id: string;
  name: string;
  address: string;
  type: string;
  total_units: number;
}

// ── Inline type dropdown (reusable within this file) ──────────────────
const TypeDropdown: React.FC<{
  value: string;
  options: string[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="custom-select-container" ref={ref}>
      <div
        className={`custom-select-trigger ${open ? 'open' : ''}`}
        style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', background: 'var(--surface-container-lowest)' }}
        onClick={() => setOpen(o => !o)}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); }
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        {value}
        <span className="material-symbols-outlined" style={{ transition: '0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '1.1rem' }}>
          keyboard_arrow_down
        </span>
      </div>
      {open && (
        <div className="custom-options" style={{ top: 'calc(100% + 0.25rem)' }}>
          {options.map(opt => (
            <div
              key={opt}
              className={`custom-option ${value === opt ? 'selected' : ''}`}
              style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
              {value === opt && <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>check</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────
const PropertyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm, DialogMount } = useDialog();
  const { ownerId, isStaff } = useOwner();
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currency, setCurrency] = useState('USD');

  // Add unit form
  const [newUnit, setNewUnit] = useState({ unit_number: '', floor: 0, type: 'Studio', base_rent: 0, area_sqft: 0 });

  // Edit unit
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editUnitData, setEditUnitData] = useState({ unit_number: '', floor: 0, type: 'Studio', base_rent: 0, area_sqft: 0, status: 'Vacant' as Unit['status'] });

  // Edit property
  const [editingProperty, setEditingProperty] = useState(false);
  const [editPropertyData, setEditPropertyData] = useState({ name: '', address: '', type: '' });

  // Outside click for add-form dropdown
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [propSnap, unitsSnap, ownerSnap] = await Promise.all([
        getDoc(doc(db, 'properties', id!)),
        getDocs(query(collection(db, 'units'), where('property_id', '==', id))),
        ownerId ? getDoc(doc(db, 'owners', ownerId)) : Promise.resolve(null),
      ]);

      if (!propSnap.exists()) throw new Error('Property not found');
      setProperty({ id: propSnap.id, ...propSnap.data() } as Property);

      const fetchedUnits: Unit[] = unitsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Unit));
      fetchedUnits.sort((a, b) => a.unit_number.localeCompare(b.unit_number));
      setUnits(fetchedUnits);

      if (ownerSnap && ownerSnap.exists()) {
        setCurrency(ownerSnap.data().currency || 'USD');
      }
    } catch (error) {
      console.error('Error fetching property details:', error);
      navigate('/properties');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, ownerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Add unit ────────────────────────────────────────────────────────
  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'units'), {
        ...newUnit,
        property_id: id,
        owner_id: ownerId,
        status: 'Vacant',
        created_at: serverTimestamp(),
      });
      setNewUnit({ unit_number: '', floor: 0, type: 'Studio', base_rent: 0, area_sqft: 0 });
      fetchData();
    } catch (error) {
      showAlert('Error adding unit: ' + (error as Error).message);
    }
  };

  // ── Edit unit ───────────────────────────────────────────────────────
  const startEditUnit = (unit: Unit) => {
    setEditingUnitId(unit.id);
    setEditUnitData({ unit_number: unit.unit_number, floor: unit.floor, type: unit.type, base_rent: unit.base_rent, area_sqft: unit.area_sqft, status: unit.status });
  };

  const handleEditUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnitId) return;
    try {
      await updateDoc(doc(db, 'units', editingUnitId), editUnitData);
      setEditingUnitId(null);
      fetchData();
    } catch (error) {
      showAlert((error as Error).message);
    }
  };

  // ── Delete unit ─────────────────────────────────────────────────────
  const handleDeleteUnit = async (unit: Unit) => {
    const activeLeasesSnap = await getDocs(
      query(collection(db, 'leases'), where('unit_id', '==', unit.id), where('status', '==', 'Active'))
    );

    if (!activeLeasesSnap.empty) {
      await showAlert('Cannot delete — this unit has an active lease.\nDelete the lease first, then delete the unit.');
      return;
    }
    const ok = await showConfirm(`Delete unit ${unit.unit_number}? This cannot be undone.`, { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'units', unit.id));
      setEditingUnitId(null);
      fetchData();
    } catch (error) {
      showAlert((error as Error).message);
    }
  };

  // ── Edit property ───────────────────────────────────────────────────
  const startEditProperty = () => {
    if (!property) return;
    setEditPropertyData({ name: property.name, address: property.address, type: property.type });
    setEditingProperty(true);
  };

  const handleEditProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'properties', id!), editPropertyData);
      setEditingProperty(false);
      fetchData();
    } catch (error) {
      showAlert((error as Error).message);
    }
  };

  // ── Delete property ─────────────────────────────────────────────────
  const handleDeleteProperty = async () => {
    const unitIds = units.map(u => u.id);
    if (unitIds.length > 0) {
      const leaseChecks = await Promise.all(
        unitIds.map(uid =>
          getDocs(query(collection(db, 'leases'), where('unit_id', '==', uid), where('status', '==', 'Active')))
        )
      );
      const activeLeaseCount = leaseChecks.reduce((sum, snap) => sum + snap.size, 0);

      if (activeLeaseCount > 0) {
        await showAlert(`Cannot delete — ${activeLeaseCount} unit(s) in this property have active leases.\nDelete those leases first.`);
        return;
      }
    }
    const ok = await showConfirm(`Delete property "${property?.name}" and all its units? This cannot be undone.`, { danger: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'properties', id!));
      navigate('/properties');
    } catch (error) {
      showAlert((error as Error).message);
    }
  };

  const sym = currencySymbols[currency] || '$';

  if (loading) return <div className="p-12">Loading property dashboard...</div>;
  if (!property) return null;

  return (
    <div className="property-dashboard">
      {DialogMount}
      <header className="mb-12">
        <button
          onClick={() => navigate('/properties')}
          className="text-primary font-bold flex items-center gap-2 mb-4 hover:opacity-70 transition-opacity"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          All Properties
        </button>

        {/* Property header — view or edit */}
        {!isStaff && editingProperty ? (
          <form onSubmit={handleEditProperty} className="add-unit-bar shadow-ambient" style={{ marginBottom: 0 }}>
            <div className="unit-input-group">
              <label>Property Name</label>
              <input type="text" className="unit-mini-input" value={editPropertyData.name} onChange={e => setEditPropertyData(d => ({ ...d, name: e.target.value }))} required />
            </div>
            <div className="unit-input-group">
              <label>Address</label>
              <input type="text" className="unit-mini-input" value={editPropertyData.address} onChange={e => setEditPropertyData(d => ({ ...d, address: e.target.value }))} required />
            </div>
            <div className="unit-input-group" style={{ flex: 0.7 }}>
              <label>Type</label>
              <TypeDropdown value={editPropertyData.type} options={propertyTypes} onChange={v => setEditPropertyData(d => ({ ...d, type: v }))} />
            </div>
            <button type="submit" className="primary-button" style={{ padding: '0.6rem 1.5rem' }}>Save</button>
            <button type="button" className="primary-button glass" style={{ padding: '0.6rem 1.25rem' }} onClick={() => setEditingProperty(false)}>Cancel</button>
            <button type="button" className="delete-btn" onClick={handleDeleteProperty}>
              <span className="material-symbols-outlined">delete</span>Delete Property
            </button>
          </form>
        ) : (
          <div className="flex justify-between items-end">
            <div>
              <h1 className="display-small mb-2">{property.name}</h1>
              <p className="text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>location_on</span>
                {property.address}
                <span className="property-type-tag" style={{ position: 'static', marginLeft: '0.5rem' }}>{property.type}</span>
              </p>
            </div>
            {!isStaff && (
              <button className="icon-action-btn" title="Edit property" onClick={startEditProperty}>
                <span className="material-symbols-outlined">edit</span>
              </button>
            )}
          </div>
        )}
      </header>

      <section className="unit-management">
        <div className="flex justify-between items-center mb-6">
          <h2 className="display-small" style={{ fontSize: '1.5rem' }}>Unit Inventory</h2>
          <div className="label-small uppercase tracking-widest opacity-50">{units.length} units defined</div>
        </div>

        {/* Add unit form */}
        {!isStaff && <form onSubmit={handleAddUnit} className="add-unit-bar shadow-ambient">
          <div className="unit-input-group">
            <label>Unit #</label>
            <input type="text" className="unit-mini-input" placeholder="e.g. A-101" value={newUnit.unit_number} onChange={e => setNewUnit({ ...newUnit, unit_number: e.target.value })} required />
          </div>
          <div className="unit-input-group" style={{ flex: 0.5 }}>
            <label>Floor</label>
            <input type="number" className="unit-mini-input" value={newUnit.floor} onChange={e => setNewUnit({ ...newUnit, floor: parseInt(e.target.value) || 0 })} required />
          </div>
          <div className="unit-input-group">
            <label>Type</label>
            <div className="custom-select-container" ref={addDropdownRef}>
              <div
                className={`custom-select-trigger ${isDropdownOpen ? 'open' : ''}`}
                style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', background: 'var(--surface-container-lowest)' }}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsDropdownOpen(!isDropdownOpen); }
                  if (e.key === 'Escape') setIsDropdownOpen(false);
                  if (isDropdownOpen) {
                    const idx = unitTypes.indexOf(newUnit.type);
                    if (e.key === 'ArrowDown') { e.preventDefault(); setNewUnit(p => ({ ...p, type: unitTypes[(idx + 1) % unitTypes.length] })); }
                    if (e.key === 'ArrowUp')   { e.preventDefault(); setNewUnit(p => ({ ...p, type: unitTypes[(idx - 1 + unitTypes.length) % unitTypes.length] })); }
                  }
                }}
              >
                {newUnit.type}
                <span className="material-symbols-outlined" style={{ transition: '0.2s', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '1.1rem' }}>keyboard_arrow_down</span>
              </div>
              {isDropdownOpen && (
                <div className="custom-options" style={{ top: 'calc(100% + 0.25rem)' }}>
                  {unitTypes.map(type => (
                    <div key={type} className={`custom-option ${newUnit.type === type ? 'selected' : ''}`} style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }} onClick={() => { setNewUnit(p => ({ ...p, type })); setIsDropdownOpen(false); }}>
                      {type}
                      {newUnit.type === type && <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>check</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="unit-input-group">
            <label>Rent ({sym})</label>
            <input type="number" className="unit-mini-input" value={newUnit.base_rent} onChange={e => setNewUnit({ ...newUnit, base_rent: parseFloat(e.target.value) || 0 })} required />
          </div>
          <button type="submit" className="primary-button" style={{ padding: '0.6rem 1.5rem' }}>Add Unit</button>
        </form>}

        {/* Units table — desktop */}
        <div className="units-table-container desktop-only">
          <table className="units-table">
            <thead>
              <tr>
                <th>Unit No</th>
                <th>Floor</th>
                <th>Type</th>
                <th>Status</th>
                <th>Monthly Rent</th>
                <th>Area (sqft)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {units.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
                    No units added yet. Use the form above to add your first unit.
                  </td>
                </tr>
              ) : (
                units.map(unit =>
                  editingUnitId === unit.id ? (
                    <tr key={unit.id} style={{ background: 'var(--surface-container-high)' }}>
                      <td><input type="text" className="unit-mini-input" value={editUnitData.unit_number} onChange={e => setEditUnitData(d => ({ ...d, unit_number: e.target.value }))} style={{ width: '100%' }} /></td>
                      <td><input type="number" className="unit-mini-input" value={editUnitData.floor} onChange={e => setEditUnitData(d => ({ ...d, floor: parseInt(e.target.value) || 0 }))} style={{ width: '5rem' }} /></td>
                      <td><TypeDropdown value={editUnitData.type} options={unitTypes} onChange={v => setEditUnitData(d => ({ ...d, type: v }))} /></td>
                      <td><TypeDropdown value={editUnitData.status} options={['Vacant', 'Occupied', 'Maintenance']} onChange={v => setEditUnitData(d => ({ ...d, status: v as Unit['status'] }))} /></td>
                      <td><input type="number" className="unit-mini-input" value={editUnitData.base_rent} onChange={e => setEditUnitData(d => ({ ...d, base_rent: parseFloat(e.target.value) || 0 }))} style={{ width: '7rem' }} /></td>
                      <td><input type="number" className="unit-mini-input" value={editUnitData.area_sqft} onChange={e => setEditUnitData(d => ({ ...d, area_sqft: parseInt(e.target.value) || 0 }))} style={{ width: '6rem' }} /></td>
                      <td>
                        <div className="bed-row-actions">
                          <button className="icon-action-btn active" title="Save" onClick={handleEditUnit}><span className="material-symbols-outlined">check</span></button>
                          <button className="icon-action-btn" title="Cancel" onClick={() => setEditingUnitId(null)}><span className="material-symbols-outlined">close</span></button>
                          <button className="icon-action-btn danger" title="Delete" onClick={() => handleDeleteUnit(unit)}><span className="material-symbols-outlined">delete</span></button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={unit.id}>
                      <td style={{ fontWeight: 800 }}>{unit.unit_number}</td>
                      <td>{unit.floor}</td>
                      <td>{unit.type}</td>
                      <td><span className={`status-badge status-${unit.status.toLowerCase()}`}>{unit.status}</span></td>
                      <td style={{ fontWeight: 700 }}>{sym}{unit.base_rent.toLocaleString()}</td>
                      <td>{unit.area_sqft || '—'}</td>
                      <td>{!isStaff && <button className="icon-action-btn" title="Edit unit" onClick={() => startEditUnit(unit)}><span className="material-symbols-outlined">edit</span></button>}</td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Unit cards — mobile */}
        <div className="mobile-only unit-cards-list">
          {units.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.4, fontSize: '0.875rem' }}>
              No units added yet.
            </div>
          ) : (
            units.map(unit => (
              <div key={unit.id} className="unit-mobile-card">
                {editingUnitId === unit.id ? (
                  <div className="unit-card-edit-form">
                    <div className="unit-card-edit-row">
                      <div className="unit-input-group"><label>Unit #</label><input type="text" className="unit-mini-input" value={editUnitData.unit_number} onChange={e => setEditUnitData(d => ({ ...d, unit_number: e.target.value }))} /></div>
                      <div className="unit-input-group"><label>Floor</label><input type="number" className="unit-mini-input" value={editUnitData.floor} onChange={e => setEditUnitData(d => ({ ...d, floor: parseInt(e.target.value) || 0 }))} /></div>
                    </div>
                    <div className="unit-card-edit-row">
                      <div className="unit-input-group"><label>Type</label><TypeDropdown value={editUnitData.type} options={unitTypes} onChange={v => setEditUnitData(d => ({ ...d, type: v }))} /></div>
                      <div className="unit-input-group"><label>Status</label><TypeDropdown value={editUnitData.status} options={['Vacant', 'Occupied', 'Maintenance']} onChange={v => setEditUnitData(d => ({ ...d, status: v as Unit['status'] }))} /></div>
                    </div>
                    <div className="unit-card-edit-row">
                      <div className="unit-input-group"><label>Rent ({sym})</label><input type="number" className="unit-mini-input" value={editUnitData.base_rent} onChange={e => setEditUnitData(d => ({ ...d, base_rent: parseFloat(e.target.value) || 0 }))} /></div>
                      <div className="unit-input-group"><label>Area (sqft)</label><input type="number" className="unit-mini-input" value={editUnitData.area_sqft} onChange={e => setEditUnitData(d => ({ ...d, area_sqft: parseInt(e.target.value) || 0 }))} /></div>
                    </div>
                    <div className="unit-card-edit-actions">
                      <button className="icon-action-btn active" onClick={handleEditUnit}><span className="material-symbols-outlined">check</span></button>
                      <button className="icon-action-btn" onClick={() => setEditingUnitId(null)}><span className="material-symbols-outlined">close</span></button>
                      <button className="icon-action-btn danger" onClick={() => handleDeleteUnit(unit)}><span className="material-symbols-outlined">delete</span></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="unit-card-header">
                      <div>
                        <span className="unit-card-number">{unit.unit_number}</span>
                        <span className="unit-card-meta">Floor {unit.floor} · {unit.type}</span>
                      </div>
                      <div className="unit-card-header-right">
                        <span className={`status-badge status-${unit.status.toLowerCase()}`}>{unit.status}</span>
                        {!isStaff && <button className="icon-action-btn" onClick={() => startEditUnit(unit)}><span className="material-symbols-outlined">edit</span></button>}
                      </div>
                    </div>
                    <div className="unit-card-body">
                      <div className="unit-card-field">
                        <span className="unit-card-label">Monthly Rent</span>
                        <span className="unit-card-value">{sym}{unit.base_rent.toLocaleString()}</span>
                      </div>
                      {unit.area_sqft ? (
                        <div className="unit-card-field">
                          <span className="unit-card-label">Area</span>
                          <span className="unit-card-value">{unit.area_sqft} sqft</span>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default PropertyDetail;
