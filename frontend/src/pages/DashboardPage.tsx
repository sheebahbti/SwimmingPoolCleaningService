import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <h1 className="text-xl font-bold">Pool Cleaning Service</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm">
            {user?.name} ({user?.role})
          </span>
          <button
            onClick={handleLogout}
            className="bg-blue-800 px-3 py-1 rounded text-sm hover:bg-blue-900 transition"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Dashboard content */}
      <main className="max-w-4xl mx-auto p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700">Welcome</h3>
            <p className="text-gray-500 mt-2">Hello, {user?.name}!</p>
            <p className="text-sm text-gray-400 mt-1">Role: {user?.role}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700">Upcoming</h3>
            <p className="text-gray-400 mt-2 text-sm">No appointments yet</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700">Quick Actions</h3>
            <p className="text-gray-400 mt-2 text-sm">Coming in Phase 5</p>
          </div>
        </div>
      </main>
    </div>
  );
}
