import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { getMyMeetingHistory } from "../api/meetingApi";

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [meetingId, setMeetingId] = useState("");
  const [recentMeetings, setRecentMeetings] = useState([]);
  const generatedId = `meet-${crypto.randomUUID().slice(0, 8)}`;

  useEffect(() => {
    getMyMeetingHistory()
      .then((response) => setRecentMeetings((response.data.meetings || []).slice(0, 5)))
      .catch(() => setRecentMeetings([]));
  }, []);

  return (
    <div className="page-shell flex min-h-screen items-center">
      <div className="ui-card w-full p-8">
        <h1 className="ui-title">Dashboard</h1>
        <p className="ui-subtitle mt-2">
          You are logged in as <span className="font-medium">{user?.email}</span>
        </p>

        <div className="ui-card-soft mt-6 grid gap-2 p-4 text-sm text-slate-600 dark:text-slate-300">
          <p>
            <span className="text-slate-500 dark:text-slate-400">Name:</span> {user?.name}
          </p>
          <p>
            <span className="text-slate-500 dark:text-slate-400">User ID:</span> {user?._id || user?.id}
          </p>
        </div>

        <div className="ui-card-soft mt-6 p-5">
          <h2 className="text-lg font-medium">Meetings</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/meet/${generatedId}`}
              className="ui-btn-primary"
            >
              Start New Meeting
            </Link>
            <input
              value={meetingId}
              onChange={(event) => setMeetingId(event.target.value)}
              placeholder="Meeting ID"
              className="ui-input max-w-xs"
            />
            <Link
              to={meetingId.trim() ? `/meet/${meetingId.trim()}` : "/meet"}
              className="ui-btn-success"
            >
              Join
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/settings"
            className="ui-btn-ghost"
          >
            Settings
          </Link>
          <Link
            to="/history"
            className="ui-btn-ghost"
          >
            Meet History
          </Link>
          <Link
            to="/home-chats"
            className="ui-btn-ghost"
          >
            Chats Hub
          </Link>
          <button
            type="button"
            onClick={logout}
            className="ui-btn-danger"
          >
            Logout
          </button>
        </div>

        <div className="ui-card-soft mt-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium">Recent Meetings</h2>
            <Link to="/home-chats" className="ui-btn-primary px-3 py-1 text-xs">
              Open Full Chat Hub
            </Link>
          </div>
          {recentMeetings.length === 0 ? (
            <p className="ui-subtitle">No recent meetings found.</p>
          ) : (
            <div className="space-y-2">
              {recentMeetings.map((meeting) => (
                <Link
                  key={meeting._id}
                  to={`/home-chats?meeting=${meeting.roomId}`}
                  className="block rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-800"
                >
                  <p className="font-medium">{meeting.roomId}</p>
                  <p className="text-xs text-slate-500">
                    {meeting.status} • {meeting.replayMetadata?.totalMessages || 0} messages
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
