import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';

interface Pool {
  id: number;
  customerId: number;
  address: string;
  size: string;
  type: string;
  notes: string | null;
  customer?: { id: number; name: string; email: string };
}

export default function PoolsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPool, setEditingPool] = useState<Pool | null>(null);
  const [form, setForm] = useState({ address: '', size: '', type: '', notes: '' });
  const [error, setError] = useState('');

  const fetchPools = () => {
    const endpoint = isAdmin ? '/pools' : '/pools/mine';
    api.get(endpoint)
      .then((res) => setPools(res.data))
      .catch(() => setPools([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const resetForm = () => {
    setForm({ address: '', size: '', type: '', notes: '' });
    setEditingPool(null);
    setShowForm(false);
    setError('');
  };

  const startEdit = (pool: Pool) => {
    setForm({ address: pool.address, size: pool.size, type: pool.type, notes: pool.notes || '' });
    setEditingPool(pool);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingPool) {
        await api.patch(`/pools/${editingPool.id}`, form);
      } else {
        await api.post('/pools', form);
      }
      resetForm();
      fetchPools();
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosErr = err as { response?: { data?: { error?: string } } };
        setError(axiosErr.response?.data?.error || 'Operation failed');
      } else {
        setError('Operation failed');
      }
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this pool?')) return;
    try {
      await api.delete(`/pools/${id}`);
      fetchPools();
    } catch {
      setError('Failed to delete pool');
    }
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) return <p className="text-gray-500">Loading pools...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {isAdmin ? 'All Pools' : 'My Pools'}
        </h2>
        {!isAdmin && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
          >
            + Add Pool
          </button>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingPool ? 'Edit Pool' : 'Add New Pool'}
          </h3>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                required
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123 Main St"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
              <select
                required
                value={form.size}
                onChange={(e) => update('size', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select size</option>
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                required
                value={form.type}
                onChange={(e) => update('type', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type</option>
                <option value="In-ground">In-ground</option>
                <option value="Above-ground">Above-ground</option>
                <option value="Indoor">Indoor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Saltwater, heated, etc."
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
              >
                {editingPool ? 'Save Changes' : 'Add Pool'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pool list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pools.map((pool) => (
          <div key={pool.id} className="bg-white rounded-lg shadow p-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-gray-800">{pool.address}</h3>
                {isAdmin && pool.customer && (
                  <p className="text-xs text-gray-400 mt-1">Owner: {pool.customer.name}</p>
                )}
              </div>
              <div className="flex gap-2">
                {(!isAdmin || pool.customerId === user?.id) && (
                  <button
                    onClick={() => startEdit(pool)}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => handleDelete(pool.id)}
                  className="text-red-500 text-sm hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-3 flex gap-3 text-sm">
              <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">{pool.size}</span>
              <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">{pool.type}</span>
            </div>
            {pool.notes && (
              <p className="text-sm text-gray-500 mt-2">{pool.notes}</p>
            )}
          </div>
        ))}
      </div>

      {pools.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No pools yet</p>
          {!isAdmin && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="mt-3 text-blue-600 text-sm hover:underline"
            >
              Add your first pool
            </button>
          )}
        </div>
      )}
    </div>
  );
}
