import { ShieldCheck, Activity, Users, FileText } from "lucide-react";
import LoginForm from "../features/authentication/LoginForm";

export default function Login() {
  return (
    <div className="min-h-screen flex w-full bg-gray-950 font-sans text-gray-100 selection:bg-blue-500/30">
      
      {/* Left Side - Form (Mobile full width, Desktop half width) */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 md:px-24 lg:px-32 relative z-10">
        
        {/* Subtle background glow for the form side */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[100px]"></div>
        </div>

        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Mostanad<span className="text-blue-500">.</span>
            </h1>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-extrabold text-white mb-3">Welcome back</h2>
            <p className="text-gray-400">
              Please enter your details to sign in to your workspace.
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <a href="#" className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Request access
            </a>
          </p>
        </div>
      </div>

      {/* Right Side - Visuals (Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 bg-gray-900 relative overflow-hidden items-center justify-center border-l border-gray-800">
        {/* Decorative background shapes */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
        <div className="absolute top-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-blue-600/20 to-purple-600/20 blur-[120px]"></div>
        
        {/* Floating Glassmorphism Cards */}
        <div className="relative w-full max-w-lg z-10">
          
          <div className="absolute -top-20 -left-10 w-48 p-6 bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl animate-pulse" style={{ animationDuration: '4s' }}>
            <Activity className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="text-white font-semibold mb-1">Fast Processing</h3>
            <p className="text-xs text-gray-400">AI-powered workflow</p>
          </div>

          <div className="relative z-20 p-10 bg-gray-800/60 backdrop-blur-2xl rounded-3xl border border-gray-600/30 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] shadow-blue-900/20">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Document AI</h2>
                <p className="text-sm text-gray-400">Automated Extraction</p>
              </div>
            </div>
            <p className="text-gray-300 leading-relaxed text-sm">
              Streamline your document verification and catalog processing with our state-of-the-art AI infrastructure. Built for enterprise scale and extreme accuracy.
            </p>
          </div>

          <div className="absolute -bottom-16 -right-10 w-56 p-6 bg-gray-800/40 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }}>
            <Users className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="text-white font-semibold mb-1">Team Collaboration</h3>
            <p className="text-xs text-gray-400">Manage roles easily</p>
          </div>

        </div>
      </div>
      
    </div>
  );
}
