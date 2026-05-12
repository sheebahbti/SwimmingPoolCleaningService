import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate, Outlet } from 'react-router-dom';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center shadow">
        <Link to="/" className="text-xl font-bold hover:text-blue-200 transition">
          Pool Cleaning Service
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/" className="text-sm hover:text-blue-200 transition">Dashboard</Link>
          {user?.role === 'CUSTOMER' && (
            <Link to="/pools" className="text-sm hover:text-blue-200 transition">My Pools</Link>
          )}
          {user?.role === 'ADMIN' && (
            <>
              <Link to="/users" className="text-sm hover:text-blue-200 transition">Users</Link>
              <Link to="/pools" className="text-sm hover:text-blue-200 transition">All Pools</Link>
            </>
          )}
          <Link to="/profile" className="text-sm hover:text-blue-200 transition">Profile</Link>
          <span className="text-xs bg-blue-800 px-2 py-1 rounded">{user?.role}</span>
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
