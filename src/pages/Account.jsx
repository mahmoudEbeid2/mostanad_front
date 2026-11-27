import { User, Shield, Bell, Key, CreditCard, LogOut, Languages } from "lucide-react";
import Button from "../ui/Button";
import { useAuth } from "../context/AuthContext";
import { LANG, setLang, t } from "../i18n";

export default function Account() {
  const { user, logout } = useAuth();
  
  const userName = user?.name || "User Name";
  const userEmail = user?.email || "user@example.com";
  const roleName = user?.role?.name || "Unknown Role";
  const companyName = user?.company?.name || "System Admin";
  return (
    <div className="relative min-h-screen">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-gray-50 -z-20" />
      <div className="absolute top-0 inset-x-0 h-[500px] bg-gradient-to-br from-indigo-100/50 via-teal-50/50 to-rose-50/30 -z-10" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay -z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40 -z-10" />

      <div className="max-w-6xl mx-auto pb-12 pt-4 relative z-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center md:text-start">
          <div className="inline-flex items-center justify-center p-3.5 bg-white rounded-2xl mb-5 shadow-sm border border-gray-100">
            <User className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-3">{t("account.accountManagement")}</h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto md:mx-0">{t("account.manageYourPersonalInformationSecurity")}</p>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Profile Section */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Personal Info */}
          <div className="bg-white/80 p-8 md:p-10 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-teal-50 rounded-2xl">
                <User className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t("account.personalInformation")}</h2>
                <p className="text-gray-500 text-sm mt-1">{t("account.updateYourPersonalDetailsAnd")}</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t("account.fullName")}</label>
                  <input type="text" defaultValue={userName} className="w-full px-4 py-3.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none text-gray-700 font-semibold" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t("account.emailAddress")}</label>
                  <input type="email" defaultValue={userEmail} className="w-full px-4 py-3.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none text-gray-700 font-semibold" disabled />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">{user?.company ? t("account.companyName") : t("account.accountType")}</label>
                  <input type="text" defaultValue={companyName} className="w-full px-4 py-3.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none text-gray-700 font-semibold disabled:opacity-60 disabled:bg-gray-100" disabled />
                </div>
              </div>
              <div className="flex justify-end pt-6 border-t border-gray-50 mt-8">
                <Button className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl px-8 py-3 shadow-lg shadow-teal-200 font-bold transition-all hover:-translate-y-0.5">{t("account.saveChanges")}</Button>
              </div>
            </div>
          </div>

          {/* Interface language (UI plan, Phase A §1): English by default, kept per browser */}
          <div className="bg-white/80 p-8 md:p-10 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 backdrop-blur-xl" data-testid="account-language">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Languages className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t("account.language")}</h2>
                <p className="text-gray-500">{t("account.languageHint")}</p>
              </div>
            </div>
            <div className="flex gap-3" role="radiogroup" aria-label={t("account.language")}>
              {[
                ["en", "English"],
                ["ar", "العربية"], // i18n-ignore: each language is named in its own script
              ].map(([code, name]) => (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={LANG === code}
                  onClick={() => LANG !== code && setLang(code)}
                  className={`rounded-xl border px-5 py-2.5 text-sm font-semibold ${LANG === code ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="bg-white/80 p-8 md:p-10 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Shield className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{t("account.securityPassword")}</h2>
                <p className="text-gray-500 text-sm mt-1">{t("account.ensureYourAccountIsSecure")}</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t("account.currentPassword")}</label>
                  <input type="password" placeholder="••••••••" className="w-full px-4 py-3.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none text-gray-700 font-semibold" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t("account.newPassword")}</label>
                  <input type="password" placeholder={t("account.enterNewPassword")} className="w-full px-4 py-3.5 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all outline-none text-gray-700 font-semibold" />
                </div>
              </div>
              <div className="flex justify-end pt-6 border-t border-gray-50 mt-8">
                <Button variant="secondary" className="text-rose-600 bg-rose-50 border-transparent hover:bg-rose-100 hover:border-rose-200 font-bold rounded-xl px-8 py-3 transition-colors">{t("account.updatePassword")}</Button>
              </div>
            </div>
          </div>

        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Account Tier */}
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-8 rounded-[2rem] shadow-xl shadow-indigo-200 text-white relative overflow-hidden group hover:shadow-2xl hover:shadow-indigo-300 transition-shadow">
            <div className="absolute -top-10 -end-10 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Shield className="w-48 h-48" />
            </div>
            <div className="relative z-10">
              <div className="inline-block px-4 py-1.5 bg-white/20 rounded-full text-xs font-bold tracking-widest uppercase mb-6 backdrop-blur-md border border-white/20">
                {roleName}{" "}{t("account.role")}</div>
              <h3 className="text-3xl font-extrabold mb-3">{user?.company ? t("account.companyAccount") : t("account.systemAccount")}</h3>
              <p className="text-indigo-100 font-medium text-sm leading-relaxed">
                {user?.company 
                  ? t("account.managingCertificatesAndBrandConfiguratio")
                  : t("account.fullAdministrativeAccessManagingPlatform")}
              </p>
            </div>
          </div>

          {/* Active Permissions */}
          <div className="bg-white/80 p-6 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4 px-2">
              <Key className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-gray-900">{t("account.activePermissions")}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {user?.role?.permissions && user.role.permissions.length > 0 ? (
                user.role.permissions.map((perm, index) => (
                  <span key={index} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100/50">
                    {perm}
                  </span>
                ))
              ) : (
                <span className="text-gray-400 text-sm font-medium px-2 py-1">{t("account.noSpecialPermissionsAssigned")}</span>
              )}
            </div>
          </div>

          <div className="pt-4">
             <button onClick={logout} className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl text-red-600 hover:bg-red-50 hover:text-red-700 font-bold transition-colors">
               <LogOut className="w-5 h-5" />{t("account.signOut")}</button>
          </div>

        </div>

      </div>
      </div>
    </div>
  );
}
