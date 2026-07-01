import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn } from "lucide-react";
import toast from "react-hot-toast";

import { login as loginApi } from "../../services/apiAuth";
import { useAuth } from "../../context/AuthContext";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import FormRow from "../../ui/FormRow";

export default function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { loginAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error("Please enter your email/username and password");
      return;
    }

    try {
      setIsLoading(true);
      const data = await loginApi({ identifier, password });
      
      if (data.status === "success") {
        toast.success("Successfully logged in!");
        loginAuth(data.data.user, data.data.token);
        navigate("/", { replace: true });
      }
    } catch (error) {
      const message = error.response?.data?.message || "An error occurred during login";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      <FormRow label="Email or Username">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-500" />
          </div>
          <Input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={isLoading}
            placeholder="admin or admin@example.com"
            className="pl-10"
          />
        </div>
      </FormRow>

      <FormRow label="Password">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-gray-500" />
          </div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="••••••••"
            className="pl-10"
          />
        </div>
      </FormRow>

      <div className="flex items-center justify-between mt-2 mb-4">
        <div className="flex items-center">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
          />
          <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">
            Remember me
          </label>
        </div>
        <div className="text-sm">
          <a href="#" className="font-medium text-blue-500 hover:text-blue-400 transition-colors">
            Forgot password?
          </a>
        </div>
      </div>

      <Button type="submit" isLoading={isLoading} className="w-full">
        <LogIn className="w-5 h-5 mr-2" />
        Sign In
      </Button>
    </form>
  );
}
