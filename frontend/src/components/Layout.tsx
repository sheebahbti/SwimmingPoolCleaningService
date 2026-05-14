import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate, Outlet } from 'react-router-dom';

const roleBadgeStyles: Record<string, string> = {
  ADMIN: 'bg-red-500 text-white',
  TECHNICIAN: 'bg-green-500 text-white',
  CUSTOMER: 'bg-purple-500 text-white',
};

const roleLabels: Record<string, string> = {
  ADMIN: '👑 Admin View',
  TECHNICIAN: '🔧 Technician View',
  CUSTOMER: '👤 Customer View',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const badgeStyle = user?.role ? roleBadgeStyles[user.role] : 'bg-gray-500';
  const roleLabel = user?.role ? roleLabels[user.role] : user?.role;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xl font-bold hover:text-blue-200 transition">
            Pool Cleaning Service
          </Link>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${badgeStyle}`}>
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/" className="text-sm hover:text-blue-200 transition">Dashboard</Link>
          <Link to="/schedules" className="text-sm hover:text-blue-200 transition">
            {user?.role === 'TECHNICIAN' ? 'My Jobs' : 'Appointments'}
          </Link>
          {user?.role === 'CUSTOMER' && (
            <Link to="/pools" className="text-sm hover:text-blue-200 transition">My Pools</Link>
          )}
          {(user?.role === 'ADMIN' || user?.role === 'CUSTOMER') && (
            <Link to="/invoices" className="text-sm hover:text-blue-200 transition">Invoices</Link>
          )}
          {user?.role === 'ADMIN' && (
            <>
              <Link to="/users" className="text-sm hover:text-blue-200 transition">Users</Link>
              <Link to="/pools" className="text-sm hover:text-blue-200 transition">All Pools</Link>
            </>
          )}
          <Link to="/profile" className="text-sm hover:text-blue-200 transition">Profile</Link>
          <span className="text-xs text-blue-200">{user?.name}</span>
          <button
            onClick={handleLogout}
            className="bg-blue-800 px-3 py-1 rounded text-sm hover:bg-blue-900 transition"
          >
            Logout
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
