import { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import api from '../lib/api';

interface Schedule {
  id: number;
  date: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  customer: { id: number; name: string };
  technician: { id: number; name: string };
  pool: { id: number; address: string };
}

const statusColors: Record<string, string> = {
  SCHEDULED: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

export default function SchedulesPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = () => {
    let endpoint = '/schedules';
    if (user?.role === 'CUSTOMER') endpoint = '/schedules/mine';
    else if (user?.role === 'TECHNICIAN') endpoint = '/schedules/assigned';

    api.get(endpoint)
      .then((res) => setSchedules(res.data))
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.patch(`/schedules/${id}/status`, { status });
      fetchSchedules();
    } catch {
      alert('Failed to update status');
    }
  };

  const calendarEvents = schedules.map((s) => ({
    id: String(s.id),
    title: `${s.pool.address} — ${user?.role === 'CUSTOMER' ? s.technician.name : s.customer.name}`,
    start: s.date,
    backgroundColor: statusColors[s.status],
    borderColor: statusColors[s.status],
  }));

  if (loading) return <p className="text-gray-500">Loading schedules...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {user?.role === 'ADMIN' ? 'All Appointments' :
           user?.role === 'TECHNICIAN' ? 'My Assigned Jobs' : 'My Appointments'}
        </h2>
        {user?.role === 'CUSTOMER' && (
          <Link
            to="/book"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
          >
            + Book Appointment
          </Link>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-sm">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            {status.replace('_', ' ')}
          </div>
        ))}
      </div>

      {/* Calendar view */}
      <div className="bg-white rounded-lg shadow p-4 mb-8">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          events={calendarEvents}
          height="auto"
        />
      </div>

      {/* List view */}
      <h3 className="text-lg font-semibold text-gray-700 mb-3">All Appointments</h3>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Pool</th>
              {user?.role !== 'CUSTOMER' && <th className="px-4 py-3">Customer</th>}
              {user?.role !== 'TECHNICIAN' && <th className="px-4 py-3">Technician</th>}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  {new Date(s.date).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </td>
                <td className="px-4 py-3">{s.pool.address}</td>
                {user?.role !== 'CUSTOMER' && <td className="px-4 py-3">{s.customer.name}</td>}
                {user?.role !== 'TECHNICIAN' && <td className="px-4 py-3">{s.technician.name}</td>}
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded text-xs font-medium text-white"
                    style={{ backgroundColor: statusColors[s.status] }}
                  >
                    {s.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 space-x-2">
                  {/* Technician actions */}
                  {user?.role === 'TECHNICIAN' && s.status === 'SCHEDULED' && (
                    <button onClick={() => updateStatus(s.id, 'IN_PROGRESS')} className="text-amber-600 hover:underline">
                      Start
                    </button>
                  )}
                  {user?.role === 'TECHNICIAN' && s.status === 'IN_PROGRESS' && (
                    <button onClick={() => updateStatus(s.id, 'COMPLETED')} className="text-green-600 hover:underline">
                      Complete
                    </button>
                  )}
                  {/* Customer cancel */}
                  {user?.role === 'CUSTOMER' && s.status === 'SCHEDULED' && (
                    <button onClick={() => updateStatus(s.id, 'CANCELLED')} className="text-red-500 hover:underline">
                      Cancel
                    </button>
                  )}
                  {/* Admin actions */}
                  {user?.role === 'ADMIN' && s.status === 'SCHEDULED' && (
                    <>
                      <button onClick={() => updateStatus(s.id, 'IN_PROGRESS')} className="text-amber-600 hover:underline">
                        Start
                      </button>
                      <button onClick={() => updateStatus(s.id, 'CANCELLED')} className="text-red-500 hover:underline">
                        Cancel
                      </button>
                    </>
                  )}
                  {user?.role === 'ADMIN' && s.status === 'IN_PROGRESS' && (
                    <button onClick={() => updateStatus(s.id, 'COMPLETED')} className="text-green-600 hover:underline">
                      Complete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {schedules.length === 0 && (
          <p className="text-center text-gray-400 py-8">No appointments found</p>
        )}
      </div>
    </div>
  );
}
