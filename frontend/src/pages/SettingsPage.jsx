import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";

const SettingsPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const theme = useAuthStore((state) => state.theme);
  const colorScheme = useAuthStore((state) => state.colorScheme);
  const setTheme = useAuthStore((state) => state.setTheme);
  const setColorScheme = useAuthStore((state) => state.setColorScheme);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const resetMyData = useAuthStore((state) => state.resetMyData);
  const loading = useAuthStore((state) => state.loading);
  const [name, setName] = useState(user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [message, setMessage] = useState("");

  const saveSettings = async () => {
    const ok = await updateProfile({ name, avatarUrl, theme, colorScheme });
    setMessage(ok ? "Settings saved." : "Could not save settings.");
  };

  const handleThemeChange = (nextTheme) => {
    setTheme(nextTheme);
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      "Reset your data? This removes meetings hosted by you and resets your profile settings."
    );
    if (!confirmed) return;
    const ok = await resetMyData();
    if (ok) {
      setName((user?.email || "").split("@")[0]);
      setAvatarUrl("");
      setTheme("dark");
      setMessage("Your data was reset.");
    }
  };

  return (
    <div className="page-shell flex min-h-screen items-center">
      <div className="ui-card w-full p-8">
        <h1 className="ui-title">Settings</h1>
        <p className="ui-subtitle mt-2">
          Manage display name, image, theme and account data.
        </p>

        <div className="ui-card-soft mt-6 grid gap-4 p-5">
          <div className="space-y-1">
            <label className="mb-1 block text-sm">Display Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="ui-input"
            />
          </div>
          <div className="space-y-1">
            <label className="mb-1 block text-sm">Profile Image URL</label>
            <input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              className="ui-input"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm">Theme</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleThemeChange("light")}
                className={`rounded px-3 py-2 text-sm ${
                  theme === "light"
                    ? "bg-indigo-500 text-white shadow-sm"
                    : "border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange("dark")}
                className={`rounded px-3 py-2 text-sm ${
                  theme === "dark"
                    ? "bg-indigo-500 text-white shadow-sm"
                    : "border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                Dark
              </button>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm">Color Scheme</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "indigo", label: "Indigo" },
                { id: "teal", label: "Teal" },
                { id: "slate", label: "Slate" },
                { id: "rose", label: "Rose" },
              ].map((scheme) => (
                <button
                  key={scheme.id}
                  type="button"
                  onClick={() => setColorScheme(scheme.id)}
                  className={`rounded px-3 py-2 text-sm ${
                    colorScheme === scheme.id
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  {scheme.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-emerald-500">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveSettings}
            disabled={loading}
            className="ui-btn-primary disabled:cursor-not-allowed disabled:bg-indigo-700"
          >
            Save Settings
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="ui-btn-danger disabled:cursor-not-allowed disabled:bg-rose-700"
          >
            Reset Data
          </button>
          <Link
            to="/"
            className="ui-btn-ghost"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={() => navigate("/meet")}
            className="ui-btn-ghost"
          >
            Go to Meet
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
