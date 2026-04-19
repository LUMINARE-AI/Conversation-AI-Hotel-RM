import { useState, useCallback, useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import VoiceLabsGate from "./components/VoiceLabsGate";
import { Toast } from "./components/UI";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { VOICE_LABS_PAGE_IDS } from "./constants";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Call from "./pages/Call";
import Reports from "./pages/Reports";
import Upload from "./pages/Upload";
import Samvaad from "./pages/Samvaad";
import WebProjects from "./pages/WebProjects";
import AboutUs from "./pages/AboutUs";
import ContactUs from "./pages/ContactUs";
import Home from "./pages/Home";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdminAccessDenied from "./pages/AdminAccessDenied";

const PAGES = {
  home: Home,
  dashboard: Dashboard,
  customers: Customers,
  call: Call,
  reports: Reports,
  upload: Upload,
  samvaad: Samvaad,
  "web-projects": WebProjects,
  about: AboutUs,
  contact: ContactUs,
};

function AppShell() {
  const [page, setPage] = useState("home");
  const [toasts, setToasts] = useState([]);
  const { user, loading, logout } = useAuth();

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    if (!loading && user && page === "login") {
      setPage("dashboard");
    }
  }, [loading, user, page]);

  let PageComponent;
  if (loading) {
    PageComponent = function LoadingPage() {
      return (
        <div className="flex min-h-[50vh] items-center justify-center text-[14px] font-medium text-slate-500">
          Loading…
        </div>
      );
    };
  } else if (page === "login" || (page === "admin" && !user)) {
    const redirect = page === "admin" ? "admin" : "dashboard";
    PageComponent = function LoginRoute() {
      return (
        <Login setPage={setPage} addToast={addToast} afterLoginPage={redirect} />
      );
    };
  } else if (page === "admin" && user && user.role !== "admin") {
    PageComponent = AdminAccessDenied;
  } else if (page === "admin" && user?.role === "admin") {
    PageComponent = AdminDashboard;
  } else if (VOICE_LABS_PAGE_IDS.includes(page) && !user) {
    PageComponent = VoiceLabsGate;
  } else {
    PageComponent = PAGES[page];
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <Navbar page={page} setPage={setPage} user={user} onLogout={logout} />

      <main className="flex-1" style={{ paddingTop: "82px" }}>
        <div className="max-w-310 mx-auto px-7 py-9">
          <PageComponent addToast={addToast} setPage={setPage} />
        </div>
      </main>

      <Footer setPage={setPage} />

      <Toast toasts={toasts} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
