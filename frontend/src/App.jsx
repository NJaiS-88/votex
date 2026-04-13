import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import MeetingLobbyPage from "./pages/MeetingLobbyPage";
import MeetingRoomPage from "./pages/MeetingRoomPage";
import SettingsPage from "./pages/SettingsPage";
import MeetingHistoryPage from "./pages/MeetingHistoryPage";
import HomeChatsPage from "./pages/HomeChatsPage";
import { useAuthStore } from "./store/useAuthStore";

const ProtectedRoute = ({ children }) => {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { token } = useAuthStore();
  return token ? <Navigate to="/" replace /> : children;
};

function App() {
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);
  const token = useAuthStore((state) => state.token);
  const theme = useAuthStore((state) => state.theme);
  const colorScheme = useAuthStore((state) => state.colorScheme);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token, fetchCurrentUser]);

  return (
    <div
      className={`min-h-screen ${
        theme === "dark"
          ? "dark bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-white"
          : "bg-linear-to-b from-slate-100 via-white to-slate-100 text-slate-900"
      } scheme-${colorScheme}`}
    >
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />
        <Route
          path="/meet"
          element={
            <ProtectedRoute>
              <MeetingLobbyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/meet/:roomId"
          element={
            <ProtectedRoute>
              <MeetingRoomPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <MeetingHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home-chats"
          element={
            <ProtectedRoute>
              <HomeChatsPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
