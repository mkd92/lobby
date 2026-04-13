import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { useDialog } from '../hooks/useDialog';
import { useOwner } from '../context/OwnerContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingScreen } from './layout/LoadingScreen';
import { useEscapeKey } from '../hooks/useEscapeKey';
import '../styles/PropertyDetail.css';

interface Unit {
  id: string;
  unit_number: string;
  price: number;
  status: 'Vacant' | 'Occupied' | 'Maintenance';
}

interface Property {
  id: string;
  name: string;
  address: string;
}

const PropertyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ownerId, userRole } = useOwner();
  const canCreate = userRole !== 'viewer';
  const isOwner = userRole === 'owner';
  const queryClient = useQueryClient();
  const { showAlert, DialogMount } = useDialog();

  const [propertyForm, setPropertyForm] = useState({ name: '', address: '' });
  const [savingProperty, setSavingProperty] = useState(false);

  const [newUnit, setNewUnit] = useState({ unit_number: '', price: 0 });
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);

  const [vacancyFilter, setVacancyFilter] = useState<'All' | 'Vacant' | 'Occupied'>('All');

  useEscapeKey(() => {
    setIsAddUnitModalOpen(false);
  }, isAddUnitModalOpen);

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ['property', id, ownerId],
    queryFn: async () => {
      if (!id) throw new Error('No property id');
      const symbols: { [key: string]: string } = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: '$', AUD: '$' };

      const [propertySnap, allUnitsSnap, ownerSnap, allPropLeasesSnap] = await Promise.all([
        getDoc(doc(db, 'properties', id)),
        getDocs(query(collection(db, 'units'), where('owner_id', '==', ownerId))),
        ownerId ? getDoc(doc(db, 'owners', ownerId)) : Promise.resolve(null),
        getDocs(query(collection(db, 'property_leases'), where('owner_id', '==', ownerId))),
      ]);

      if (!propertySnap.exists()) {
        navigate('/properties');
        throw new Error('Property not found');
      }

      const property = { id: propertySnap.id, ...propertySnap.data() } as Property;

      const activeLeases = allPropLeasesSnap.docs
        .map(d => d.data())
        .filter(l => l.property_id === id && l.status === 'Active');
      const occupiedUnitIds = new Set(activeLeases.map(l => l.unit_id));

      const units: Unit[] = allUnitsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(u => u.property_id === id)
        .map(u => ({
          id: u.id,
          unit_number: u.unit_number,
          price: u.price,
          status: occupiedUnitIds.has(u.id)
            ? 'Occupied'
            : (u.status === 'Maintenance' ? 'Maintenance' : 'Vacant'),
        } as Unit))
        .sort((a, b) => String(a.unit_number).localeCompare(String(b.unit_number), undefined, { numeric: true }));

      let currencySymbol = '$';
      if (ownerSnap && ownerSnap.exists()) {
        const currency = (ownerSnap.data() as any)?.currency || 'USD';
        currencySymbol = symbols[currency] || '$';
      }

      return { property, units, currencySymbol };
    },
    enabled: !!id && !!ownerId,
  });

  useEffect(() => {
    if (data?.property) {
      setPropertyForm({ name: data.property.name, address: data.property.address });
    }
  }, [data?.property]);

  const filteredUnits = useMemo(() => {
    if (!data) return [];
    return data.units.filter(unit => {
      if (vacancyFilter === 'Vacant') return unit.status === 'Vacant';
      if (vacancyFilter === 'Occupied') return unit.status === 'Occupied';
      return true;
    });
  }, [data, vacancyFilter]);

  const stats = useMemo(() => {
    if (!data) return { totalUnits: 0, vacantUnits: 0, occupiedUnits: 0 };
    const totalUnits = data.units.length;
    const vacantUnits = data.units.filter(u => u.status === 'Vacant').length;
    const occupiedUnits = data.units.filter(u => u.status === 'Occupied').length;
    return { totalUnits, vacantUnits, occupiedUnits };
  }, [data]);

  const handlePropertySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !id) return;
    setSavingProperty(true);
    try {
      await updateDoc(doc(db, 'properties', id), {
        ...propertyForm,
        updated_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['property', id, ownerId] });
      queryClient.invalidateQueries({ queryKey: ['properties', ownerId] });
      showAlert('Property updated.');
    } catch (err) {
      showAlert((err as Error).message);
    } finally {
      setSavingProperty(false);
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate || !id) return;
    try {
      await addDoc(collection(db, 'units'), {
        unit_number: newUnit.unit_number,
        price: newUnit.price,
        status: 'Vacant',
        property_id: id,
        owner_id: ownerId,
        created_at: serverTimestamp(),
      });
      queryClient.invalidateQueries({ queryKey: ['property', id, ownerId] });
      setNewUnit({ unit_number: '', price: 0 });
      setIsAddUnitModalOpen(false);
    } catch (err) {
      showAlert((err as Error).message);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading Property" />;
  if (isError) {
    return (
      <div className="view-container flex flex-col items-center justify-center min-h-[60vh]">
        <div className="modern-card p-12 text-center max-w-lg">
          <span className="material-symbols-outlined text-error text-5xl mb-6">error_outline</span>
          <h2 className="text-2xl font-bold mb-4">Property Not Found</h2>
          <p className="text-on-surface-variant mb-8">{(error as any)?.message || 'Missing or insufficient permissions.'}</p>
          <button onClick={() => navigate('/properties')} className="primary-button w-full">Return to Portfolio</button>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="view-container page-fade-in">
      {DialogMount}

      <header className="view-header flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="view-eyebrow flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/properties')}>
            <span className="material-symbols-outlined transition-transform group-hover:-translate-x-1" style={{ fontSize: '1.125rem' }}>arrow_back</span>
            Property Portfolio
          </div>
          <h1 className="text-white font-display font-black text-4xl md:text-6xl tracking-tighter leading-none mt-2">
            Property Profile
          </h1>
        </div>
        {canCreate && (
          <button onClick={() => setIsAddUnitModalOpen(true)} className="primary-button">
            <span className="material-symbols-outlined mr-2">add_home</span>
            Add Unit
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="glass-panel p-10 rounded-[40px]">
            <div className="view-eyebrow mb-10">Property Details</div>
            <form onSubmit={handlePropertySubmit} className="flex flex-col gap-6">
              <div className="form-group-modern">
                <label>Property Name</label>
                <input
                  type="text"
                  value={propertyForm.name}
                  onChange={e => setPropertyForm({ ...propertyForm, name: e.target.value })}
                  placeholder="Property Name"
                  required
                  disabled={!isOwner}
                />
              </div>
              <div className="form-group-modern">
                <label>Address</label>
                <textarea
                  value={propertyForm.address}
                  onChange={e => setPropertyForm({ ...propertyForm, address: e.target.value })}
                  placeholder="Full property address"
                  required
                  disabled={!isOwner}
                  style={{ minHeight: '100px' }}
                />
              </div>
              {isOwner && (
                <div className="pt-4 border-t border-white/5">
                  <button type="submit" className="primary-button w-full" disabled={savingProperty}>
                    {savingProperty ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="glass-panel p-10 rounded-[40px] bg-primary-container/5">
            <h3 className="view-eyebrow text-[0.625rem] opacity-40 mb-8">Unit Summary</h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Total Units</span>
                <span className="text-white font-bold">{stats.totalUnits}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Occupied</span>
                <span className="text-white font-bold">{stats.occupiedUnits}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-bold text-secondary/40 uppercase tracking-widest">Vacant</span>
                <span className="text-white font-bold">{stats.vacantUnits}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="view-toolbar mb-8">
            <div className="filter-tabs-modern">
              {(['All', 'Vacant', 'Occupied'] as const).map(tab => (
                <button key={tab} className={`tab-btn ${vacancyFilter === tab ? 'active' : ''}`} onClick={() => setVacancyFilter(tab)}>
                  {tab}
                  {vacancyFilter === tab && <div className="tab-indicator" />}
                </button>
              ))}
            </div>
            <div className="prop-filter-count">
              Showing {filteredUnits.length} of {data.units.length} units
            </div>
          </div>

          {data.units.length === 0 ? (
            <div className="modern-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ opacity: 0.1, marginBottom: '1.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '3rem' }}>door_front</span>
              </div>
              <h3 className="text-lg font-bold mb-2">No Units Yet</h3>
              <p className="text-on-surface-variant text-sm mb-6">Add units to this property to start managing occupancy.</p>
              {canCreate && (
                <button className="primary-button" onClick={() => setIsAddUnitModalOpen(true)}>Add First Unit</button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredUnits.map(unit => (
                <div key={unit.id} className="modern-card glass-panel" style={{ padding: '2rem' }}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-white font-display font-bold text-2xl tracking-tight">Unit {unit.unit_number}</h3>
                      <div className="text-secondary/40 text-[0.6rem] uppercase tracking-widest font-black mt-1">
                        {data.currencySymbol}{unit.price.toLocaleString()} / month
                      </div>
                    </div>
                    <span className={`badge-modern ${
                      unit.status === 'Occupied' ? 'badge-success' :
                      unit.status === 'Maintenance' ? 'badge-warning' :
                      ''
                    }`} style={unit.status === 'Vacant' ? { background: 'rgba(255,255,255,0.05)', color: 'var(--on-surface-variant)' } : {}}>
                      {unit.status}
                    </span>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        unit.status === 'Occupied' ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]' :
                        unit.status === 'Maintenance' ? 'bg-error' :
                        'border-2 border-white/20'
                      }`}
                    />
                    <span className="text-[0.6rem] font-bold text-secondary/60 uppercase tracking-widest">
                      {unit.status === 'Occupied' ? 'Lease Active' : unit.status === 'Maintenance' ? 'Under Maintenance' : 'Available'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isAddUnitModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsAddUnitModalOpen(false)}>
          <div className="modal-content-modern" style={{ maxWidth: '480px' }}>
            <header className="modal-header-modern">
              <h2 className="modal-title">Add Unit</h2>
              <p className="modal-subtitle">Register a new rentable unit for this property</p>
            </header>
            <form onSubmit={handleAddUnit} className="modal-form-modern">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Unit Number</label>
                  <input
                    type="text"
                    value={newUnit.unit_number}
                    onChange={e => setNewUnit({ ...newUnit, unit_number: e.target.value })}
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    placeholder="e.g. 101"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group-modern">
                  <label className="text-[0.65rem] uppercase tracking-[0.15em] font-black text-secondary/40 block mb-3">Monthly Rent ({data.currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newUnit.price}
                    onChange={e => setNewUnit({ ...newUnit, price: parseFloat(e.target.value) })}
                    className="auth-input w-full bg-surface-container-low focus:bg-surface-container-high transition-all border-none rounded-2xl p-5 font-display font-bold text-xl"
                    required
                  />
                </div>
              </div>
              <footer className="modal-footer-modern">
                <button type="button" className="text-secondary/40 font-bold uppercase tracking-widest text-xs px-6" onClick={() => setIsAddUnitModalOpen(false)}>Discard</button>
                <button type="submit" className="primary-button px-10">Add Unit</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyDetail;
