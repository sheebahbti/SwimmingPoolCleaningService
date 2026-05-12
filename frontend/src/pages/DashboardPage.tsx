import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700">Welcome</h3>
          <p className="text-gray-500 mt-2">Hello, {user?.name}!</p>
          <p className="text-sm text-gray-400 mt-1">Role: {user?.role}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700">
            {user?.role === 'CUSTOMER' ? 'My Pools' : 'Upcoming'}
          </h3>
          {user?.role === 'CUSTOMER' ? (
            <Link to="/pools" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
              Manage your pools →
            </Link>
          ) : (
            <p className="text-gray-400 mt-2 text-sm">No appointments yet</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700">Quick Actions</h3>
          <div className="mt-2 space-y-1">
            <Link to="/profile" className="text-blue-600 text-sm hover:underline block">
              Edit profile →
            </Link>
            {user?.role === 'ADMIN' && (
              <Link to="/users" className="text-blue-600 text-sm hover:underline block">
                Manage users →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
