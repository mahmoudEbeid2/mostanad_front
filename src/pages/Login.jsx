import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login as loginApi } from "../services/apiAuth";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { loginAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error("يرجى إدخال اسم المستخدم/البريد الإلكتروني وكلمة المرور");
      return;
    }

    try {
      setIsLoading(true);
      const data = await loginApi({ identifier, password });
      
      if (data.status === "success") {
        toast.success("تم تسجيل الدخول بنجاح!");
        loginAuth(data.data.user, data.data.token);
        navigate("/", { replace: true });
      }
    } catch (error) {
      const message = error.response?.data?.message || "حدث خطأ أثناء تسجيل الدخول";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white w-full">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-500 mb-2">تسجيل الدخول</h1>
          <p className="text-gray-400">مرحباً بك مجدداً في مستند</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" dir="rtl">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              البريد الإلكتروني أو اسم المستخدم
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:opacity-50 text-right"
              placeholder="admin أو admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:opacity-50 text-right"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 ease-in-out disabled:opacity-70 flex justify-center items-center"
          >
            {isLoading ? (
              <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              "تسجيل الدخول"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
