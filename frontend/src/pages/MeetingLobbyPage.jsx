import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { getMyMeetingHistory } from "../api/meetingApi";

const MeetingLobbyPage = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState("");
  const [history, setHistory] = useState([]);

  const handleCreateMeeting = () => {
    const generatedId = `meet-${crypto.randomUUID().slice(0, 8)}`;
    navigate(`/meet/${generatedId}`);
  };

  const handleJoinMeeting = (event) => {
    event.preventDefault();
    if (!meetingId.trim()) return;
    navigate(`/meet/${meetingId.trim()}`);
  };

  useEffect(() => {
    getMyMeetingHistory()
      .then((response) => setHistory(response.data.meetings || []))
      .catch(() => setHistory([]));
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8">
      <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-8">
        <h1 className="text-2xl font-semibold">Meeting Lobby</h1>
        <p className="mt-2 text-slate-300">
          Signed in as <span className="font-medium">{user?.email}</span>
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 rounded-lg bg-rose-500 px-4 py-2 font-medium hover:bg-rose-400"
        >
          Logout
        </button>

        <div className="mt-8 rounded-xl border border-slate-700 p-5">
          <h2 className="text-lg font-medium">Create New Meeting</h2>
          <p className="mt-1 text-sm text-slate-400">
            A meeting ID is generated automatically when you create.
          </p>
          <button
            type="button"
            onClick={handleCreateMeeting}
            className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400"
          >
            Create & Join
          </button>
        </div>

        <form onSubmit={handleJoinMeeting} className="mt-5 rounded-xl border border-slate-700 p-5">
          <h2 className="text-lg font-medium">Join Existing Meeting</h2>
          <input
            value={meetingId}
            onChange={(event) => setMeetingId(event.target.value)}
            placeholder="Enter meeting ID"
            className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 outline-none ring-indigo-500 focus:ring"
          />
          <button
            type="submit"
            className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 font-medium hover:bg-emerald-400"
          >
            Join Meeting
          </button>
        </form>

        <div className="mt-5 rounded-xl border border-slate-700 p-5">
          <h2 className="text-lg font-medium">Recent Meetings & Replay Metadata</h2>
          <div className="mt-3 space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400">No recent meetings found.</p>
            ) : (
              history.map((meeting) => (
                <div key={meeting._id} className="rounded bg-slate-800 p-3 text-sm">
                  <p className="font-medium text-indigo-300">{meeting.roomId}</p>
                  <p className="text-slate-300">
                    Status: {meeting.status} | Duration: {meeting.replayMetadata?.durationSec || 0}s
                  </p>
                  <p className="text-slate-400">
                    Participants: {meeting.replayMetadata?.totalParticipants || 0} | Messages:{" "}
                    {meeting.replayMetadata?.totalMessages || 0} | Reactions:{" "}
                    {meeting.replayMetadata?.totalReactions || 0} | Recordings:{" "}
                    {meeting.replayMetadata?.totalRecordings || 0}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingLobbyPage;
