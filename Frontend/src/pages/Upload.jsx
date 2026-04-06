import { useState } from "react";
import { api } from "../services/api";
import { Icon, Badge, PageHeader, Card, PrimaryButton } from "../components/UI";

function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    return headers.reduce((obj, h, i) => { obj[h] = vals[i]; return obj; }, {});
  });
}

export default function Upload({ addToast }) {
  const [file, setFile]         = useState(null);
  const [parsed, setParsed]     = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults]   = useState(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try { setParsed(parseCSV(e.target.result)); }
      catch { addToast("Could not parse CSV", "error"); }
    };
    reader.readAsText(f);
  };

  const handleUpload = async () => {
    if (!file) return addToast("No file selected", "warn");
    setUploading(true);
    try {
      const res = await api.uploadCustomers(file);
      setResults(res);
      addToast(`${res.total_created} customers created!`, "success");
    } catch { addToast("Upload failed", "error"); }
    setUploading(false);
  };

  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      <PageHeader title="Upload Data" subtitle="Bulk import customers via CSV" />

      <div className="grid grid-cols-2 gap-6">

        {/* Left: drop zone */}
        <div className="flex flex-col gap-4">
          {/* Drop area */}
          <div
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200
              ${dragging
                ? "border-indigo-400 bg-indigo-50"
                : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40"
              }`}
          >
            <div className={`transition-colors ${dragging ? "text-indigo-500" : "text-slate-300"}`}>
              <Icon name="upload" size={40} />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-base">Drop CSV file here</p>
              <p className="text-sm text-slate-400 mt-1">or click to browse files</p>
            </div>
            <label className="mt-1 px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors shadow-md shadow-indigo-200/60">
              Browse File
              <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </label>
            {file && (
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 mt-1">
                <Icon name="check" size={14} /> {file.name}
              </div>
            )}
          </div>

          {/* CSV hint */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4">
            <p className="text-xs font-bold text-slate-700 mb-2">Expected CSV columns:</p>
            <code className="text-xs text-indigo-500 font-mono">
              name, email, phone, total_visits, loyalty_score, preferred_room_type
            </code>
          </div>

          {/* Upload button */}
          {file && (
            <PrimaryButton onClick={handleUpload} disabled={uploading} className="w-full">
              {uploading
                ? <><Icon name="loader" size={15} /> Uploading…</>
                : <><Icon name="upload" size={15} /> Upload {parsed.length} Customers</>
              }
            </PrimaryButton>
          )}

          {/* Results */}
          {results && (
            <div className="flex items-center bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex-1 flex flex-col items-center py-5 gap-1">
                <span className="text-4xl font-extrabold text-emerald-500 tracking-tight">{results.total_created}</span>
                <span className="text-xs font-semibold text-slate-400">Created</span>
              </div>
              <div className="w-px h-14 bg-slate-200" />
              <div className="flex-1 flex flex-col items-center py-5 gap-1">
                <span className="text-4xl font-extrabold text-red-500 tracking-tight">{results.failed}</span>
                <span className="text-xs font-semibold text-slate-400">Failed</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: preview */}
        <div>
          {parsed.length > 0 ? (
            <Card>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <span className="text-[15px] font-bold text-slate-900">Preview</span>
                <Badge value={`${parsed.length} rows`} type="neutral" />
              </div>
              <div className="overflow-y-auto max-h-95">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      {["#", "Name", "Phone", "Email"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.07em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((row, i) => (
                      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{i + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{row.name}</td>
                        <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{row.phone}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{row.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-70 rounded-2xl border-2 border-dashed border-slate-200 text-slate-300 gap-3">
              <Icon name="upload" size={36} />
              <p className="text-sm font-medium text-slate-400">CSV preview will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}