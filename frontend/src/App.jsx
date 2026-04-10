import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import MeetingLobbyPage from "./pages/MeetingLobbyPage";
import MeetingRoomPage from "./pages/MeetingRoomPage";
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

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    }
  }, [token, fetchCurrentUser]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
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
      </Routes>
    </div>
  );
}

export default App;
