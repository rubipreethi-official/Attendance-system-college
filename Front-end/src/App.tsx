import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import "./styles.css";
import AuthLogin from "./components/AuthLogin";
import Attendance from "./Attendance";
import ProtectedRoute from "./ProtectedRoute";
import Dashboard from "./components/Dashboard";
import AdminPanel from "./components/AdminPanel";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<AuthLogin />} />
      <Route path="/login/history" element={<AuthLogin />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route 
        path="/history" 
        element={
        <ProtectedRoute>
          <Attendance />
        </ProtectedRoute>
        } 
      />
      <Route path="/admin" element={<ProtectedRoute>
          <AdminPanel />
        </ProtectedRoute>} />
    </Routes>
  );
};

export default App;
