import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import { useAuthStore } from "../store/useAuthStore";

const SignupPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const signup = useAuthStore((state) => state.signup);
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
    const success = await signup(formData);
    if (success) navigate("/");
  };

  return (
    <div className="page-shell flex min-h-screen items-center justify-center">
      <AuthCard
        title="Create account"
        subtitle="Create your profile to start meetings"
        altText="Already have an account?"
        altLink="/login"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="ui-input"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-slate-700 dark:text-slate-200">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="ui-input"
            />
          </div>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="ui-btn-primary w-full disabled:cursor-not-allowed disabled:bg-indigo-700"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>
      </AuthCard>
    </div>
  );
};

export default SignupPage;
