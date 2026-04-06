import { useState, useCallback } from "react";
import Navbar from "./components/Navbar";
import { Toast } from "./components/UI";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Call from "./pages/Call";
import Reports from "./pages/Reports";
import Upload from "./pages/Upload";

const PAGES = { dashboard: Dashboard, customers: Customers, call: Call, reports: Reports, upload: Upload };

export default function App() {
  const [page, setPage]   = useState("dashboard");
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const PageComponent = PAGES[page];

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar page={page} setPage={setPage} />

      {/* navbar=62px + breadcrumb=40px = 102px total offset */}
      <main style={{ paddingTop: "82px" }}>
        <div className="max-w-310 mx-auto px-7 py-9">
          <PageComponent addToast={addToast} />
        </div>
      </main>

      <Toast toasts={toasts} />
    </div>
  );
}