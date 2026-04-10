import { useAuthStore } from "../store/useAuthStore";
import { Link } from "react-router-dom";

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Auth Dashboard</h1>
        <p className="mt-2 text-slate-300">
          You are logged in as <span className="font-medium">{user?.email}</span>
        </p>

        <div className="mt-6 grid gap-2 text-sm text-slate-300">
          <p>
            <span className="text-slate-400">Name:</span> {user?.name}
          </p>
          <p>
            <span className="text-slate-400">User ID:</span> {user?._id || user?.id}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/meet"
            className="rounded-lg bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400"
          >
            Go to Meeting Lobby
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-rose-500 px-4 py-2 font-medium hover:bg-rose-400"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
