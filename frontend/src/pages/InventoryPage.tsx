import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { InventoryItem, FoodItem, Cafeteria } from '../types';

interface InventoryPageProps {
  selectedCafeteria: string;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ selectedCafeteria }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [foodCatalog, setFoodCatalog] = useState<FoodItem[]>([]);
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Add form fields
  const [newCafeteriaId, setNewCafeteriaId] = useState<string>('CAF-CENTRAL');
  const [newFoodItemId, setNewFoodItemId] = useState<string>('ITEM-JASMINE-RICE');
  const [newQuantity, setNewQuantity] = useState<number>(30);
  const [newStorageType, setNewStorageType] = useState<string>('refrigerated');
  const [newExpiryHours, setNewExpiryHours] = useState<number>(24);
  const [newNotes, setNewNotes] = useState<string>('');

  // Edit form fields
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editConsumed, setEditConsumed] = useState<number>(0);
  const [editWaste, setEditWaste] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<string>('usable');
  const [editNotes, setEditNotes] = useState<string>('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getInventory(selectedCafeteria, statusFilter, search),
      api.getFoodItems(),
      api.getCafeterias(),
    ])
      .then(([inv, foods, cafs]) => {
        setItems(inv);
        setFoodCatalog(foods);
        setCafeterias(cafs);
      })
      .catch((err) => console.error('Failed to load inventory:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedCafeteria, statusFilter, search]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    try {
      const food = foodCatalog.find((f) => f.id === newFoodItemId);
      const now = new Date();
      const prepDate = now.toISOString().split('T')[0];
      const expiry = new Date(now.getTime() + newExpiryHours * 3600000).toISOString();

      await api.createInventoryItem({
        cafeteria_id: newCafeteriaId,
        food_item_id: newFoodItemId,
        quantity: newQuantity,
        unit: food?.unit || 'kg',
        prepared_qty: newQuantity,
        consumed_qty: 0,
        leftover_qty: 0,
        waste_qty: 0,
        prep_date: prepDate,
        expiry_date: expiry,
        storage_type: newStorageType,
        status: 'usable',
        notes: newNotes,
      });

      setIsAddModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create inventory item');
    }
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditQuantity(item.quantity);
    setEditConsumed(item.consumed_qty);
    setEditWaste(item.waste_qty);
    setEditStatus(item.status);
    setEditNotes(item.notes || '');
    setModalError(null);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setModalError(null);

    // Frontend validation: consumption cannot exceed prepared
    if (editConsumed > selectedItem.prepared_qty) {
      setModalError(`Consumed quantity (${editConsumed}) cannot exceed prepared quantity (${selectedItem.prepared_qty}).`);
      return;
    }
    const derivedLeftover = Math.max(0, selectedItem.prepared_qty - editConsumed);
    if (editWaste > derivedLeftover) {
      setModalError(`Waste quantity (${editWaste}) cannot exceed remaining leftovers (${derivedLeftover}).`);
      return;
    }

    try {
      await api.updateInventoryItem(selectedItem.id, {
        quantity: editQuantity,
        consumed_qty: editConsumed,
        waste_qty: editWaste,
        status: editStatus as any,
        notes: editNotes,
      });

      setIsEditModalOpen(false);
      loadData();
    } catch (err: any) {
      setModalError(err.message || 'Failed to update inventory batch');
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (window.confirm(`Are you sure you want to delete batch ${item.batch_number}?`)) {
      try {
        await api.deleteInventoryItem(item.id);
        loadData();
      } catch (err: any) {
        alert(err.message || 'Failed to delete batch');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Food Inventory & Batch Tracking</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitor prepared batches, track live consumption, log leftovers, and identify surplus lots for redistribution.
          </p>
        </div>

        <button
          onClick={() => {
            setModalError(null);
            setIsAddModalOpen(true);
          }}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Prepared Batch</span>
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by food item or batch code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-500 w-full sm:w-auto cursor-pointer"
            >
              <option value="">All Inventory Statuses</option>
              <option value="usable">Usable (Active Service)</option>
              <option value="surplus">Surplus (Redistribution Ready)</option>
              <option value="allocated">Allocated (Reserved)</option>
              <option value="redistributed">Redistributed</option>
              <option value="waste">Logged as Waste</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Food Item</th>
                <th className="py-3 px-4">Cafeteria</th>
                <th className="py-3 px-4 text-right">Available Qty</th>
                <th className="py-3 px-4 text-right">Prepared</th>
                <th className="py-3 px-4 text-right">Consumed</th>
                <th className="py-3 px-4 text-right">Leftover</th>
                <th className="py-3 px-4 text-right">Surplus</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Storage</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Loading inventory records...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No inventory batches match your current filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                      {item.batch_number}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-900 block">{item.food_name || item.food_item_id}</span>
                      <span className="text-[11px] text-slate-400">Prep: {item.prep_date}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {item.cafeteria_id}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600">
                      {item.prepared_qty} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-600 font-medium">
                      {item.consumed_qty} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-600 font-medium">
                      {item.leftover_qty} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-forest-700">
                      {Math.max(0, item.surplus_qty - item.allocated_qty)} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`badge ${
                          item.status === 'surplus'
                            ? 'badge-success'
                            : item.status === 'allocated'
                            ? 'badge-info'
                            : item.status === 'usable'
                            ? 'badge-neutral'
                            : 'badge-danger'
                        } uppercase tracking-wider text-[10px]`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 capitalize">
                      {item.storage_type.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="Update Batch Quantities"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          title="Delete Batch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Prepared Batch */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-soft-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Add New Prepared Batch</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="inv-add-cafeteria" className="block text-xs font-semibold text-slate-700 mb-1">Cafeteria</label>
                  <select
                    id="inv-add-cafeteria"
                    value={newCafeteriaId}
                    onChange={(e) => setNewCafeteriaId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  >
                    {cafeterias.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="inv-add-food-item" className="block text-xs font-semibold text-slate-700 mb-1">Food Item</label>
                  <select
                    id="inv-add-food-item"
                    value={newFoodItemId}
                    onChange={(e) => setNewFoodItemId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  >
                    {foodCatalog.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.unit})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="inv-add-qty" className="block text-xs font-semibold text-slate-700 mb-1">Prepared Qty</label>
                  <input
                    id="inv-add-qty"
                    type="number"
                    min="1"
                    step="0.5"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Number(e.target.value))}
                    required
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label htmlFor="inv-add-storage" className="block text-xs font-semibold text-slate-700 mb-1">Storage Type</label>
                  <select
                    id="inv-add-storage"
                    value={newStorageType}
                    onChange={(e) => setNewStorageType(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  >
                    <option value="refrigerated">Refrigerated</option>
                    <option value="hot_holding">Hot Holding</option>
                    <option value="dry">Dry Storage</option>
                    <option value="frozen">Frozen</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="inv-add-expiry-hours" className="block text-xs font-semibold text-slate-700 mb-1">Shelf Life (Hours)</label>
                  <input
                    id="inv-add-expiry-hours"
                    type="number"
                    min="2"
                    max="168"
                    value={newExpiryHours}
                    onChange={(e) => setNewExpiryHours(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="inv-add-notes" className="block text-xs font-semibold text-slate-700 mb-1">Kitchen Operational Notes</label>
                <textarea
                  id="inv-add-notes"
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Prepared for lunch rush, stored in walk-in cooler 2..."
                  className="w-full text-xs border border-slate-200 rounded-lg p-2"
                />
              </div>

              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Prepared Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Batch Quantities / Record Waste */}
      {isEditModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-soft-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Update Batch: {selectedItem.batch_number}</h3>
                <p className="text-xs text-slate-500">{selectedItem.food_name} • Prepared: {selectedItem.prepared_qty} {selectedItem.unit}</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="inv-edit-consumed" className="block text-xs font-semibold text-slate-700 mb-1">
                    Consumed ({selectedItem.unit})
                  </label>
                  <input
                    id="inv-edit-consumed"
                    type="number"
                    step="0.5"
                    min="0"
                    max={selectedItem.prepared_qty}
                    value={editConsumed}
                    onChange={(e) => setEditConsumed(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                  <span className="text-[10px] text-slate-400">Max: {selectedItem.prepared_qty}</span>
                </div>

                <div>
                  <label htmlFor="inv-edit-waste" className="block text-xs font-semibold text-slate-700 mb-1">
                    Wasted ({selectedItem.unit})
                  </label>
                  <input
                    id="inv-edit-waste"
                    type="number"
                    step="0.5"
                    min="0"
                    value={editWaste}
                    onChange={(e) => setEditWaste(Number(e.target.value))}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                  <span className="text-[10px] text-slate-400">Cannot exceed leftovers</span>
                </div>

                <div>
                  <label htmlFor="inv-edit-status" className="block text-xs font-semibold text-slate-700 mb-1">Batch Status</label>
                  <select
                    id="inv-edit-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  >
                    <option value="usable">Usable</option>
                    <option value="surplus">Surplus (Redistribution)</option>
                    <option value="allocated">Allocated</option>
                    <option value="redistributed">Redistributed</option>
                    <option value="waste">Waste</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="inv-edit-notes" className="block text-xs font-semibold text-slate-700 mb-1">Update Notes</label>
                <textarea
                  id="inv-edit-notes"
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2"
                />
              </div>

              {modalError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {modalError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
