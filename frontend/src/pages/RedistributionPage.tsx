import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  Truck,
  Building,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight,
  Plus,
  AlertTriangle,
  Layers,
  X
} from 'lucide-react';
import { api } from '../services/api';
import {
  RecipientOrganization,
  SurplusBatch,
  SurplusMatchResponse,
  RedistributionTransaction
} from '../types';

interface RedistributionPageProps {
  selectedCafeteria: string;
}

export const RedistributionPage: React.FC<RedistributionPageProps> = ({ selectedCafeteria }) => {
  const [surplusBatches, setSurplusBatches] = useState<SurplusBatch[]>([]);
  const [recipients, setRecipients] = useState<RecipientOrganization[]>([]);
  const [history, setHistory] = useState<RedistributionTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Matching Drawer/Modal
  const [selectedBatch, setSelectedBatch] = useState<SurplusBatch | null>(null);
  const [matchData, setMatchData] = useState<SurplusMatchResponse | null>(null);
  const [matchingLoading, setMatchingLoading] = useState<boolean>(false);
  const [matchingError, setMatchingError] = useState<string | null>(null);

  // Allocation Form State
  const [allocRecipientId, setAllocRecipientId] = useState<string>('');
  const [allocQuantity, setAllocQuantity] = useState<number>(10);
  const [allocPickup, setAllocPickup] = useState<string>('');
  const [allocNotes, setAllocNotes] = useState<string>('');
  const [allocSubmitting, setAllocSubmitting] = useState<boolean>(false);
  const [allocError, setAllocError] = useState<string | null>(null);

  // Add Recipient Modal State
  const [isAddRecipModalOpen, setIsAddRecipModalOpen] = useState<boolean>(false);
  const [newRecipName, setNewRecipName] = useState<string>('');
  const [newRecipType, setNewRecipType] = useState<string>('shelter');
  const [newRecipPerson, setNewRecipPerson] = useState<string>('');
  const [newRecipEmail, setNewRecipEmail] = useState<string>('');
  const [newRecipAddress, setNewRecipAddress] = useState<string>('');
  const [newRecipCategories, setNewRecipCategories] = useState<string>('Grains,Proteins,Bakery,Soups');
  const [newRecipCapacity, setNewRecipCapacity] = useState<number>(250);
  const [newRecipDistance, setNewRecipDistance] = useState<number>(3.5);
  const [newRecipPickup, setNewRecipPickup] = useState<boolean>(true);
  const [newRecipError, setNewRecipError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getSurplusBatches(selectedCafeteria),
      api.getRecipients(),
      api.getRedistributionHistory(),
    ])
      .then(([surplus, recips, txs]) => {
        setSurplusBatches(surplus);
        setRecipients(recips);
        setHistory(txs);
      })
      .catch((err) => console.error('Failed to load redistribution data:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedCafeteria]);

  const handleOpenMatching = async (batch: SurplusBatch) => {
    setSelectedBatch(batch);
    setAllocQuantity(batch.available_surplus_qty);
    setAllocPickup(new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 16));
    setAllocError(null);
    setMatchingLoading(true);
    setMatchingError(null);

    try {
      const matchResp = await api.getSurplusMatch(batch.inventory_item_id);
      setMatchData(matchResp);
      if (matchResp.candidates.length > 0) {
        setAllocRecipientId(matchResp.candidates[0].recipient_id);
      }
    } catch (err: any) {
      setMatchingError(err.message || 'Matching failed');
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch || !allocRecipientId) return;
    setAllocSubmitting(true);
    setAllocError(null);

    try {
      await api.allocateSurplus({
        inventory_item_id: selectedBatch.inventory_item_id,
        recipient_id: allocRecipientId,
        quantity: allocQuantity,
        scheduled_pickup: allocPickup,
        notes: allocNotes,
      });

      setSelectedBatch(null);
      setMatchData(null);
      loadData();
    } catch (err: any) {
      setAllocError(err.message || 'Allocation failed');
    } finally {
      setAllocSubmitting(false);
    }
  };

  const handleAddRecipientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewRecipError(null);
    try {
      const id = `RECIP-${newRecipName.replace(/\s+/g, '-').toUpperCase().slice(0, 12)}`;
      await api.createRecipient({
        id,
        name: newRecipName,
        org_type: newRecipType,
        contact_person: newRecipPerson,
        contact_email: newRecipEmail,
        address: newRecipAddress,
        accepted_categories: newRecipCategories,
        storage_capacity_kg: newRecipCapacity,
        current_stored_kg: 0,
        allows_pickup: newRecipPickup,
        distance_km: newRecipDistance,
        active_status: true,
      });

      setIsAddRecipModalOpen(false);
      loadData();
    } catch (err: any) {
      setNewRecipError(err.message || 'Failed to add recipient');
    }
  };

  const handleUpdateStatus = async (txId: number, nextStatus: string) => {
    try {
      await api.updateTransactionStatus(txId, nextStatus);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update transaction status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Intelligent Food Surplus Redistribution</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Algorithmic matching of edible surplus with local shelters, food banks, and student pantries with zero over-allocation risk.
          </p>
        </div>

        <button
          onClick={() => {
            setNewRecipError(null);
            setIsAddRecipModalOpen(true);
          }}
          className="btn-secondary flex items-center gap-2 self-start sm:self-auto text-xs sm:text-sm"
        >
          <Plus className="w-4 h-4 text-forest-700" />
          <span>Add Recipient Partner</span>
        </button>
      </div>

      {/* Available Surplus Lots Grid */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-base text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-forest-700" />
              <span>Available Surplus Lots Awaiting Match</span>
            </h2>
            <p className="text-xs text-slate-500">Live batches from kitchen leftovers ready for immediate redistribution</p>
          </div>
          <span className="badge badge-info">{surplusBatches.length} Batches Ready</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">Loading surplus batches...</div>
        ) : surplusBatches.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No unallocated surplus food</p>
            <p className="text-xs text-slate-400 mt-0.5">All surplus has either been matched or kitchens are running at zero excess.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {surplusBatches.map((batch) => (
              <div
                key={batch.inventory_item_id}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-forest-300 hover:shadow-soft transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] text-slate-400 block">{batch.batch_number}</span>
                    <h3 className="font-bold text-sm text-slate-900">{batch.food_name}</h3>
                    <span className="text-[11px] text-slate-500">{batch.category} • {batch.cafeteria_id}</span>
                  </div>
                  <span className="badge badge-success text-[10px] uppercase">{batch.status}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Surplus Qty</span>
                    <span className="font-extrabold text-forest-800 text-base">
                      {batch.available_surplus_qty} {batch.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Safe Time Remaining</span>
                    <span className="font-semibold text-amber-700 text-sm flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {batch.safe_use_remaining_hours}h
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenMatching(batch)}
                  className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run Algorithmic Match</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recipient Partners List & Redistribution History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recipient Organizations (1 col) */}
        <div className="card">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 font-semibold text-sm text-slate-900">
              <Building className="w-4 h-4 text-forest-700" />
              <span>Partner Organizations ({recipients.length})</span>
            </div>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {recipients.map((r) => (
              <div key={r.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 text-xs space-y-1.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{r.name}</h3>
                    <span className="text-[11px] text-slate-500 capitalize">{r.org_type.replace('_', ' ')}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-forest-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {r.distance_km} km
                  </span>
                </div>

                <div className="text-[11px] text-slate-600 leading-snug">
                  <div>Capacity: <strong>{r.storage_capacity_kg - r.current_stored_kg} kg available</strong> of {r.storage_capacity_kg} kg</div>
                  <div className="text-slate-400 truncate">Accepts: {r.accepted_categories}</div>
                </div>

                <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                  <span className="badge badge-neutral text-[9px]">
                    {r.allows_pickup ? 'Has Pickup Fleet' : 'Drop-off Required'}
                  </span>
                  <span>Contact: {r.contact_person}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Redistribution Transactions History (2 cols) */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-forest-700" />
                <span>Redistribution Transactions & Chain of Custody</span>
              </h2>
              <p className="text-xs text-slate-500">Log of allocated surplus deliveries and completion verifications</p>
            </div>
            <span className="badge badge-success text-[10px]">{history.length} Transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Transaction</th>
                  <th className="py-2.5 px-3">Recipient Partner</th>
                  <th className="py-2.5 px-3">Food Item</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3">Scheduled Pickup</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                      {tx.transaction_code}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {tx.recipient_name || tx.recipient_id}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {tx.food_name}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-forest-700">
                      {tx.quantity} {tx.unit}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {tx.scheduled_pickup || tx.matched_date}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`badge ${
                          tx.status === 'completed'
                            ? 'badge-success'
                            : tx.status === 'collected'
                            ? 'badge-info'
                            : tx.status === 'scheduled'
                            ? 'badge-warning'
                            : 'badge-neutral'
                        } uppercase tracking-wider text-[9px]`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {tx.status === 'scheduled' && (
                        <button
                          onClick={() => handleUpdateStatus(tx.id, 'collected')}
                          className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold"
                        >
                          Mark Collected
                        </button>
                      )}
                      {tx.status === 'collected' && (
                        <button
                          onClick={() => handleUpdateStatus(tx.id, 'completed')}
                          className="text-[10px] px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-semibold"
                        >
                          Mark Completed
                        </button>
                      )}
                      {tx.status === 'completed' && (
                        <span className="text-emerald-600 text-[10px] font-semibold flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Delivered</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal / Drawer: Algorithmic Recipient Matching & Allocation */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-soft-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="badge badge-info text-[10px] mb-1">Redistribution Engine</span>
                <h3 className="font-bold text-lg text-slate-900">
                  Match Candidates for {selectedBatch.food_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Batch: {selectedBatch.batch_number} • Surplus Available: <strong>{selectedBatch.available_surplus_qty} {selectedBatch.unit}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {matchingLoading ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                <div className="w-8 h-8 border-3 border-forest-200 border-t-forest-700 rounded-full animate-spin mx-auto"></div>
                <p>Computing compatibility, capacity, safe transit windows, and distance weighting...</p>
              </div>
            ) : matchData && (
              <form onSubmit={handleAllocateSubmit} className="space-y-4">
                {/* Candidates List with Transparent Scores */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Ranked Recipient Organizations:
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {matchData.candidates.map((c) => (
                      <label
                        key={c.recipient_id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          allocRecipientId === c.recipient_id
                            ? 'bg-emerald-50/70 border-forest-600 ring-2 ring-forest-600/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="matchRecipient"
                          value={c.recipient_id}
                          checked={allocRecipientId === c.recipient_id}
                          onChange={(e) => setAllocRecipientId(e.target.value)}
                          className="mt-1 text-forest-700 focus:ring-forest-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900">{c.recipient_name}</span>
                            <span className="badge badge-success text-xs font-bold">
                              {c.compatibility_score}% Match
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {c.distance_km} km away • {c.available_capacity_kg} kg available capacity
                          </div>
                          {/* Explanations */}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {c.reasons.map((r, ri) => (
                              <span key={ri} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Allocation Parameters */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label htmlFor="alloc-qty" className="block text-xs font-semibold text-slate-700 mb-1">
                      Quantity to Allocate ({selectedBatch.unit})
                    </label>
                    <input
                      id="alloc-qty"
                      type="number"
                      step="0.5"
                      min="0.5"
                      max={selectedBatch.available_surplus_qty}
                      value={allocQuantity}
                      onChange={(e) => setAllocQuantity(Number(e.target.value))}
                      required
                      className="w-full text-xs border border-slate-200 rounded-lg p-2"
                    />
                    <span className="text-[10px] text-slate-400">
                      Available max: {selectedBatch.available_surplus_qty} {selectedBatch.unit}
                    </span>
                  </div>

                  <div>
                    <label htmlFor="alloc-pickup" className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Pickup</label>
                    <input
                      id="alloc-pickup"
                      type="datetime-local"
                      value={allocPickup}
                      onChange={(e) => setAllocPickup(e.target.value)}
                      required
                      className="w-full text-xs border border-slate-200 rounded-lg p-2"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="alloc-notes" className="block text-xs font-semibold text-slate-700 mb-1">Redistribution Notes</label>
                  <input
                    id="alloc-notes"
                    type="text"
                    value={allocNotes}
                    onChange={(e) => setAllocNotes(e.target.value)}
                    placeholder="e.g. Loading dock 3, insulated containers ready..."
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>

                {allocError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {allocError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedBatch(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={allocSubmitting}
                    className="btn-primary"
                  >
                    {allocSubmitting ? 'Confirming Reservation...' : 'Confirm Surplus Allocation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Partner Organization */}
      {isAddRecipModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-soft-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Add Recipient Partner</h3>
              <button
                onClick={() => setIsAddRecipModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRecipientSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="recip-org-name" className="block text-xs font-semibold text-slate-700 mb-1">Organization Name</label>
                  <input
                    id="recip-org-name"
                    type="text"
                    required
                    value={newRecipName}
                    onChange={(e) => setNewRecipName(e.target.value)}
                    placeholder="e.g. Hope Mission Shelter"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label htmlFor="recip-org-type" className="block text-xs font-semibold text-slate-700 mb-1">Organization Type</label>
                  <select
                    id="recip-org-type"
                    value={newRecipType}
                    onChange={(e) => setNewRecipType(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  >
                    <option value="shelter">Homeless Shelter</option>
                    <option value="food_bank">Regional Food Bank</option>
                    <option value="student_pantry">Student Food Pantry</option>
                    <option value="soup_kitchen">Community Kitchen</option>
                    <option value="ngo">NGO / Non-Profit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="recip-contact-person" className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                  <input
                    id="recip-contact-person"
                    type="text"
                    required
                    value={newRecipPerson}
                    onChange={(e) => setNewRecipPerson(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label htmlFor="recip-contact-email" className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
                  <input
                    id="recip-contact-email"
                    type="email"
                    required
                    value={newRecipEmail}
                    onChange={(e) => setNewRecipEmail(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="recip-address" className="block text-xs font-semibold text-slate-700 mb-1">Physical Address</label>
                <input
                  id="recip-address"
                  type="text"
                  required
                  value={newRecipAddress}
                  onChange={(e) => setNewRecipAddress(e.target.value)}
                  placeholder="Street, City, Postal Code"
                  className="w-full text-xs border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="recip-capacity" className="block text-xs font-semibold text-slate-700 mb-1">Capacity (kg)</label>
                  <input
                    id="recip-capacity"
                    type="number"
                    value={newRecipCapacity}
                    onChange={(e) => setNewRecipCapacity(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label htmlFor="recip-distance" className="block text-xs font-semibold text-slate-700 mb-1">Distance (km)</label>
                  <input
                    id="recip-distance"
                    type="number"
                    step="0.1"
                    value={newRecipDistance}
                    onChange={(e) => setNewRecipDistance(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRecipPickup}
                      onChange={(e) => setNewRecipPickup(e.target.checked)}
                      className="w-4 h-4 rounded text-forest-700"
                    />
                    <span>Has Pickup Vehicle</span>
                  </label>
                </div>
              </div>

              {newRecipError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {newRecipError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddRecipModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Register Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
