import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { Icon, Modal, Field, Badge, LoyaltyBar, PageHeader, Card, PrimaryButton, inputCls } from "../components/UI";

const ROOM_TYPES = ["Deluxe", "Suite", "Standard", "Premium", "Presidential"];
const DEFAULT_ADD = { name: "", email: "", phone: "", total_visits: 1, total_spent: 0, loyalty_score: 50, preferred_room_type: "Deluxe", is_active: true };

export default function Customers({ addToast }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [editModal, setEditModal] = useState(null);
  const [addModal, setAddModal]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editForm, setEditForm]   = useState({});
  const [addForm, setAddForm]     = useState(DEFAULT_ADD);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getCustomers()
      .then((d) => setCustomers(d.customers || []))
      .catch(() => addToast("Failed to load customers", "error"))
      .finally(() => setLoading(false));
  }, [addToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const openEdit = (c) => {
    setEditForm({ phone: c.phone, email: c.email, name: c.name, loyalty_score: c.loyalty_score, is_active: c.is_active });
    setEditModal(c);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const payload = {};
      if (editForm.phone !== editModal.phone) payload.phone = editForm.phone;
      if (editForm.email !== editModal.email) payload.email = editForm.email;
      if (editForm.name  !== editModal.name)  payload.name  = editForm.name;
      if (editForm.loyalty_score !== editModal.loyalty_score) payload.loyalty_score = Number(editForm.loyalty_score);
      if (editForm.is_active !== editModal.is_active) payload.is_active = editForm.is_active;
      await api.updateCustomer(editModal.customer_id, payload);
      addToast("Customer updated", "success");
      setEditModal(null);
      load();
    } catch { addToast("Failed to update", "error"); }
    setSaving(false);
  };

  const confirmDelete = async () => {
    try {
      await api.deleteCustomer(deleteConfirm.customer_id);
      addToast("Customer deleted", "success");
      setDeleteConfirm(null);
      load();
    } catch { addToast("Failed to delete", "error"); }
  };

  const saveAdd = async () => {
    if (!addForm.name || !addForm.phone) return addToast("Name & phone required", "warn");
    setSaving(true);
    try {
      await api.createCustomer({
        ...addForm,
        total_visits: Number(addForm.total_visits),
        total_spent: Number(addForm.total_spent),
        loyalty_score: Number(addForm.loyalty_score),
      });
      addToast("Customer created!", "success");
      setAddModal(false);
      setAddForm(DEFAULT_ADD);
      load();
    } catch { addToast("Failed to create", "error"); }
    setSaving(false);
  };

  return (
    <div className="animate-[fadeUp_0.35s_ease_both]">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} total records`}
        action={
          <PrimaryButton onClick={() => setAddModal(true)}>
            <Icon name="add" size={15} /> Add Customer
          </PrimaryButton>
        }
      />

      <Card>
        {/* Search bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 gap-3">
          <div className="relative flex items-center flex-1 max-w-sm">
            <span className="absolute left-2.5 text-slate-400 pointer-events-none flex items-center">
              <Icon name="search" size={14} />
            </span>
            <input
              className="pl-8 pr-3 py-2 border-[1.5px] border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 w-full transition-all"
              placeholder="Search by name, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-xs text-slate-400 font-semibold">{filtered.length} results</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-300">
            <Icon name="loader" size={28} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {["ID", "Name", "Email", "Phone", "Visits", "Loyalty", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-[0.07em] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.customer_id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-[11px] text-slate-400 font-mono">{c.customer_id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 text-sm">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500 text-[13px]">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-[13px] font-mono">{c.phone}</td>
                    <td className="px-4 py-3 text-slate-900 text-sm text-center">{c.total_visits}</td>
                    <td className="px-4 py-3"><LoyaltyBar score={c.loyalty_score} /></td>
                    <td className="px-4 py-3">
                      <Badge value={c.is_active ? "Active" : "Inactive"} type={c.is_active ? "active" : "inactive"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(c)}
                          className="w-8 h-8 cursor-pointer rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white flex items-center justify-center transition-all">
                          <Icon name="edit" size={14} />
                        </button>
                        <button onClick={() => setDeleteConfirm(c)}
                          className="w-8 h-8 cursor-pointer rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">No customers match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Edit Modal ── */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={`Edit — ${editModal?.name}`}>
        <Field label="Name">
          <input className={inputCls} value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputCls} value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
        </Field>
        <Field label="Phone (E.164)">
          <input className={inputCls} value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
        </Field>
        <Field label="Loyalty Score (0–100)">
          <input className={inputCls} type="number" min={0} max={100} value={editForm.loyalty_score || 0} onChange={(e) => setEditForm({ ...editForm, loyalty_score: e.target.value })} />
        </Field>
        <Field label="Status">
          <select className={inputCls} value={editForm.is_active ? "true" : "false"} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === "true" })}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>
        <PrimaryButton onClick={saveEdit} disabled={saving} className="w-full mt-1">
          {saving ? "Saving…" : "Save Changes"}
        </PrimaryButton>
      </Modal>

      {/* ── Add Modal ── */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add New Customer">
        {["name", "email", "phone"].map((f) => (
          <Field key={f} label={f.charAt(0).toUpperCase() + f.slice(1)}>
            <input className={inputCls} value={addForm[f]} onChange={(e) => setAddForm({ ...addForm, [f]: e.target.value })} placeholder={f === "phone" ? "+91XXXXXXXXXX" : ""} />
          </Field>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total Visits">
            <input className={inputCls} type="number" value={addForm.total_visits} onChange={(e) => setAddForm({ ...addForm, total_visits: e.target.value })} />
          </Field>
          <Field label="Loyalty Score">
            <input className={inputCls} type="number" min={0} max={100} value={addForm.loyalty_score} onChange={(e) => setAddForm({ ...addForm, loyalty_score: e.target.value })} />
          </Field>
        </div>
        <Field label="Preferred Room">
          <select className={inputCls} value={addForm.preferred_room_type} onChange={(e) => setAddForm({ ...addForm, preferred_room_type: e.target.value })}>
            {ROOM_TYPES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <PrimaryButton onClick={saveAdd} disabled={saving} className="w-full mt-1">
          {saving ? "Creating…" : "Create Customer"}
        </PrimaryButton>
      </Modal>

      {/* ── Delete Confirm ── */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Customer">
        <p className="text-slate-500 text-sm leading-relaxed">
          Are you sure you want to delete <strong className="text-slate-800">{deleteConfirm?.name}</strong>? This cannot be undone.
        </p>
        <div className="grid grid-cols-2 gap-3 mt-5">
          <PrimaryButton variant="secondary" onClick={() => setDeleteConfirm(null)} className="w-full">Cancel</PrimaryButton>
          <PrimaryButton variant="danger" onClick={confirmDelete} className="w-full">Delete</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}