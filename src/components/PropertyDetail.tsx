import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import '../styles/Units.css';
import '../styles/Properties.css';

const unitTypes = ['Studio', '1BHK', '2BHK', '3BHK', 'Office', 'Retail', 'Warehouse'];

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

const TypeDropdown: React.FC<{
  value: string;
  options: string[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="custom-select-container" ref={ref}>
      <div className={`custom-select-trigger ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        {value}
        <span className="material-symbols-outlined">keyboard_arrow_down</span>
      </div>
      {open && (
        <div className="custom-options">
          {options.map(opt => (
            <div key={opt} className={`custom-option ${value === opt ? 'selected' : ''}`} onClick={() => { onChange(opt); setOpen(false); }}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PropertyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ownerId, isStaff } = useOwner();
  const queryClient = useQueryClient();
  const { showAlert, showConfirm, DialogMount } = useDialog();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState({
    unit_number: '',
    floor: '0',
    type: 'Studio',
    base_rent: '',
    area_sqft: '',
    status: 'Vacant' as Unit['status'],
  });
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState('$');

  const { data: property, isLoading: isPropLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'properties', id!));
      if (!snap.exists()) throw new Error('Property not found');
      const ownerSnap = await getDoc(doc(db, 'owners', ownerId!));
      setCurrency(currencySymbols[ownerSnap.data()?.currency || 'USD'] || '$');
      return { id: snap.id, ...snap.data() } as Property;
    },
    enabled: !!id && !!ownerId,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', id],
    queryFn: async () => {
      const q = query(collection(db, 'units'), where('property_id', '==', id));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Unit))
        .sort((a, b) => a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }));
    },
    enabled: !!id,
  });

  const stats = useMemo(() => {
    const total = units.length;
    const occupied = units.filter(u => u.status === 'Occupied').length;
    const rent = units.reduce((acc, u) => acc + (u.base_rent || 0), 0);
    return { total, occupancy: total > 0 ? Math.round((occupied / total) * 100) : 0, totalRent: rent };
  }, [units]);

  const openAdd = () => {
    setEditingUnit(null);
    setUnitForm({ unit_number: '', floor: '0', type: 'Studio', base_rent: '', area_sqft: '', status: 'Vacant' });
    setIsModalOpen(true);
  };

  const openEdit = (u: Unit) => {
    setEditingUnit(u);
    setUnitForm({ unit_number: u.unit_number, floor: String(u.floor), type: u.type, base_rent: String(u.base_rent), area_sqft: String(u.area_sqft), status: u.status });
    setIsModalOpen(true);
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...unitForm, floor: parseInt(unitForm.floor), base_rent: parseFloat(unitForm.base_rent), area_sqft: parseFloat(unitForm.area_sqft), property_id: id, owner_id: ownerId, updated_at: serverTimestamp() };
      if (editingUnit) {
        await updateDoc(doc(db, 'units', editingUnit.id), payload);
      } else {
        await addDoc(collection(db, 'units'), { ...payload, created_at: serverTimestamp() });
        await updateDoc(doc(db, 'properties', id!), { total_units: (property?.total_units || 0) + 1 });
      }
      queryClient.invalidateQueries({ queryKey: ['units', id] });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      setIsModalOpen(false);
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: Unit) => {
    if (u.status === 'Occupied') { showAlert('Cannot delete an occupied unit.'); return; }
    const ok = await showConfirm(`Delete unit ${u.unit_number}?`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'units', u.id));
      await updateDoc(doc(db, 'properties', id!), { total_units: Math.max(0, (property?.total_units || 0) - 1) });
      queryClient.invalidateQueries({ queryKey: ['units', id] });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isPropLoading) return <LoadingScreen message="Loading property details" />;
  if (!property) return null;

  return (
    <div className="view-container">
      {DialogMount}
      <header className="view-header">
        <div>
          <div className="view-eyebrow" style={{ cursor: 'pointer' }} onClick={() => navigate('/properties')}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', marginRight: '0.5rem' }}>arrow_back</span>
            Back to Portfolio
          </div>
          <h1 className="view-title">{property.name}</h1>
          <p className="text-on-surface-variant mt-2">{property.address}</p>
        </div>
        {!isStaff && <button className="primary-button" onClick={openAdd}><span className="material-symbols-outlined">add</span>Add Unit</button>}
      </header>

      <div className="view-metrics-bar">
        <div className="metric-pill"><span className="metric-pill-label">Units</span><span className="metric-pill-value">{stats.total}</span></div>
        <div className="metric-pill"><span className="metric-pill-label">Occupancy</span><span className="metric-pill-value">{stats.occupancy}%</span></div>
        <div className="metric-pill"><span className="metric-pill-label">Monthly Potential</span><span className="metric-pill-value">{currency}{stats.totalRent.toLocaleString()}</span></div>
      </div>

      <div className="modern-table-wrap">
        <table className="modern-table">
          <thead><tr><th>Unit</th><th>Floor</th><th>Type</th><th>Area</th><th>Rent</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {units.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 800 }}>{u.unit_number}</td>
                <td>{u.floor}</td>
                <td>{u.type}</td>
                <td>{u.area_sqft} sqft</td>
                <td style={{ fontWeight: 700 }}>{currency}{u.base_rent.toLocaleString()}</td>
                <td><span className="property-type-badge">{u.status}</span></td>
                <td>
                  {!isStaff && (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button className="btn-icon" onClick={() => openEdit(u)}><span className="material-symbols-outlined">edit</span></button>
                      <button className="btn-icon danger" onClick={() => handleDelete(u)}><span className="material-symbols-outlined">delete</span></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-modern">
            <header className="modal-header"><h2 className="modal-title">{editingUnit ? 'Edit Unit' : 'New Unit'}</h2><button className="modal-close-btn" onClick={() => setIsModalOpen(false)}><span className="material-symbols-outlined">close</span></button></header>
            <form onSubmit={handleUnitSubmit} className="modal-form-modern">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group-modern"><label>Unit Number</label><input type="text" value={unitForm.unit_number} onChange={e => setUnitForm({...unitForm, unit_number: e.target.value})} required /></div>
                <div className="form-group-modern"><label>Floor</label><input type="number" value={unitForm.floor} onChange={e => setUnitForm({...unitForm, floor: e.target.value})} required /></div>
              </div>
              <div className="form-group-modern"><label>Type</label><TypeDropdown value={unitForm.type} options={unitTypes} onChange={v => setUnitForm({...unitForm, type: v})} /></div>
              <footer className="modal-footer-modern" style={{ padding: 0 }}><button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>Save</button></footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetail;
