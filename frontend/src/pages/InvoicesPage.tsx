import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';

interface Invoice {
  id: number;
  scheduleId: number;
  amount: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  dueDate: string;
  paidAt: string | null;
  schedule: {
    date: string;
    customer: { id: number; name: string; email: string };
    technician: { id: number; name: string };
    pool: { address: string };
  };
}

const statusColors: Record<string, string> = {
  PENDING: '#f59e0b',
  PAID: '#10b981',
  OVERDUE: '#ef4444',
};

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const [statusError, setStatusError] = useState('');

  const fetchInvoices = () => {
    const params = filter ? `?status=${filter}` : '';
    api.get(`/invoices${params}`)
      .then((res) => setInvoices(res.data))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const updateStatus = async (id: number, status: string) => {
    try {
      setStatusError('');
      await api.patch(`/invoices/${id}/status`, { status });
      fetchInvoices();
    } catch {
      setStatusError('Failed to update invoice status');
    }
  };

  const downloadPDF = async (id: number) => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setStatusError('Failed to download PDF');
    }
  };

  if (loading) return <p className="text-gray-500">Loading invoices...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {user?.role === 'ADMIN' ? 'All Invoices' : 'My Invoices'}
        </h2>

        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </div>

      {statusError && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{statusError}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">
            {invoices.filter((i) => i.status === 'PENDING').length}
          </p>
          <p className="text-sm text-gray-600">Pending</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {invoices.filter((i) => i.status === 'PAID').length}
          </p>
          <p className="text-sm text-gray-600">Paid</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600">
            {invoices.filter((i) => i.status === 'OVERDUE').length}
          </p>
          <p className="text-sm text-gray-600">Overdue</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-3">Invoice #</th>
              {user?.role === 'ADMIN' && <th className="px-4 py-3">Customer</th>}
              <th className="px-4 py-3">Pool</th>
              <th className="px-4 py-3">Service Date</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">
                  INV-{String(inv.id).padStart(4, '0')}
                </td>
                {user?.role === 'ADMIN' && (
                  <td className="px-4 py-3">{inv.schedule.customer.name}</td>
                )}
                <td className="px-4 py-3">{inv.schedule.pool.address}</td>
                <td className="px-4 py-3">
                  {new Date(inv.schedule.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 font-medium">
                  ${Number(inv.amount).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {new Date(inv.dueDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: statusColors[inv.status] }}
                  >
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    onClick={() => downloadPDF(inv.id)}
                    className="text-blue-600 hover:underline"
                  >
                    PDF
                  </button>

                  {/* Admin actions */}
                  {user?.role === 'ADMIN' && inv.status !== 'PAID' && (
                    <button
                      onClick={() => updateStatus(inv.id, 'PAID')}
                      className="text-green-600 hover:underline"
                    >
                      Mark Paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && (
          <p className="text-center text-gray-400 py-8">No invoices found</p>
        )}
      </div>
    </div>
  );
}
