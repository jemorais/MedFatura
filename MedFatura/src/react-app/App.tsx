import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from "@/react-app/contexts/AuthContext";
import HomePage from "@/react-app/pages/Home";
import AuthCallbackPage from "@/react-app/pages/AuthCallback";
import ProfileSetupPage from "@/react-app/pages/ProfileSetup";
import InviteAcceptPage from "@/react-app/pages/InviteAccept";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/setup" element={<ProfileSetupPage />} />
          <Route path="/invite" element={<InviteAcceptPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
