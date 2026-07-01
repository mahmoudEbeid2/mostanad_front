import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8" dir="rtl">
      <div className="max-w-4xl mx-auto bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-700">
        <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-blue-500">لوحة التحكم الأساسية</h1>
          <button 
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
          >
            تسجيل الخروج
          </button>
        </div>
        
        <div className="bg-gray-700 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-200">مرحباً، {user?.name} 👋</h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <p className="mb-1 text-gray-400">اسم المستخدم:</p>
              <p className="font-medium bg-gray-800 py-1 px-3 rounded inline-block">{user?.username}</p>
            </div>
            <div>
              <p className="mb-1 text-gray-400">البريد الإلكتروني:</p>
              <p className="font-medium bg-gray-800 py-1 px-3 rounded inline-block">{user?.email}</p>
            </div>
            <div>
              <p className="mb-1 text-gray-400">الدور (Role):</p>
              <p className="font-medium bg-gray-800 py-1 px-3 rounded inline-block">{user?.role?.name}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-700 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-200">الصلاحيات (Permissions) المتاحة لك:</h2>
          <div className="flex flex-wrap gap-2">
            {user?.role?.permissions?.length > 0 ? (
              user.role.permissions.map(perm => (
                <span key={perm} className="bg-blue-900 text-blue-200 px-3 py-1 rounded-full text-xs font-semibold border border-blue-700">
                  {perm}
                </span>
              ))
            ) : (
              <p className="text-gray-400">لا توجد صلاحيات مخصصة لك حالياً.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
