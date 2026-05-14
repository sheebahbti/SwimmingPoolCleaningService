import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';

interface Pool {
  id: number;
  address: string;
  size: string;
  type: string;
}

interface Technician {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export default function BookingPage() {
  const navigate = useNavigate();
  const [pools, setPools] = useState<Pool[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [form, setForm] = useState({ poolId: '', technicianId: '', date: '', time: '', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/pools/mine'), api.get('/technicians')])
      .then(([poolsRes, techRes]) => {
        setPools(poolsRes.data);
        setTechnicians(techRes.data);
      })
      .catch(() => setError('Failed to load booking data'));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!form.poolId || !form.technicianId || !form.date || !form.time) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    try {
      const dateTime = `${form.date}T${form.time}:00`;
      await api.post('/schedules', {
        poolId: parseInt(form.poolId),
        technicianId: parseInt(form.technicianId),
        date: dateTime,
        notes: form.notes || undefined,
      });
      navigate('/schedules');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Booking failed'));
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Book an Appointment</h2>

      <div className="max-w-lg bg-white rounded-lg shadow p-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
        )}

        {pools.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">You need to add a pool before booking.</p>
            <Link to="/pools" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
              Add a pool →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Pool</label>
              <select
                required
                value={form.poolId}
                onChange={(e) => update('poolId', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a pool</option>
                {pools.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address} ({p.size} {p.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Technician</label>
              <select
                required
                value={form.technicianId}
                onChange={(e) => update('technicianId', e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a technician</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => update('date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  required
                  value={form.time}
                  onChange={(e) => update('time', e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any special instructions..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? 'Booking...' : 'Book Appointment'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/schedules')}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
