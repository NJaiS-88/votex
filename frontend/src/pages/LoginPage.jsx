import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import { useAuthStore } from "../store/useAuthStore";

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) clearError();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const success = await login(formData);
    if (success) navigate("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <AuthCard
        title="Welcome back"
        subtitle="Login to continue"
        altText="Don't have an account?"
        altLink="/signup"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-slate-200">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none ring-indigo-500 focus:ring"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-slate-200">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none ring-indigo-500 focus:ring"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-500 py-2 font-medium hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-700"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </AuthCard>
    </div>
  );
};

export default LoginPage;
