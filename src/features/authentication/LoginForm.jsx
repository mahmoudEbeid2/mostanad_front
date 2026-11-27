import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn } from "lucide-react";
import toast from "react-hot-toast";

import { login as loginApi } from "../../services/apiAuth";
import { useAuth } from "../../context/AuthContext";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";
import { t } from "../../i18n";

export default function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { loginAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error(t("loginForm.pleaseEnterYourEmailUsername"));
      return;
    }

    try {
      setIsLoading(true);
      const data = await loginApi({ identifier, password });
      
      if (data.status === "success") {
        toast.success(t("loginForm.successfullyLoggedIn"));
        loginAuth(data.data.user, data.data.token);
        navigate("/", { replace: true });
      }
    } catch (error) {
      const message = error.response?.data?.message || t("loginForm.anErrorOccurredDuringLogin");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      <FormRow label={t("loginForm.emailOrUsername")}>
        <div className="relative">
          <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={isLoading}
            placeholder={t("loginForm.adminOrAdminExampleCom")}
            className="ps-10"
          />
        </div>
      </FormRow>

      <FormRow label={t("loginForm.password")}>
        <div className="relative">
          <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="••••••••"
            className="ps-10"
          />
        </div>
      </FormRow>

      <div className="flex items-center justify-between mt-1 mb-3">
        <div className="flex items-center">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="remember-me" className="ms-2 block text-sm text-gray-600">{t("loginForm.rememberMe")}</label>
        </div>
        <div className="text-sm">
          <a href="#" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">{t("loginForm.forgotPassword")}</a>
        </div>
      </div>

      <Button type="submit" isLoading={isLoading} className="w-full">
        <LogIn className="w-5 h-5" />{t("loginForm.signIn")}</Button>
    </form>
  );
}
