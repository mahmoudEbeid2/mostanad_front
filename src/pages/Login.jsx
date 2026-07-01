import { ShieldCheck } from "lucide-react";
import LoginForm from "../features/authentication/LoginForm";

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans text-gray-900 selection:bg-blue-500/30 p-4">
      
      {/* Decorative Background Glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 sm:p-12 relative z-10">
        
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-gray-500 text-sm">
            Please enter your details to sign in to your workspace.
          </p>
        </div>

        <LoginForm />

        <p className="mt-8 text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <a href="#" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
            Request access
          </a>
        </p>
      </div>
      
    </div>
  );
}
