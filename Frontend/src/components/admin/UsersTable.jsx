import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi } from "../../services/api";
import { Card, Icon, Modal, PrimaryButton } from "../UI";

function formatCreated(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex animate-pulse gap-4 px-4 py-3">
          <div className="h-4 flex-1 rounded bg-slate-100" />
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="h-4 w-40 rounded bg-slate-100" />
          <div className="h-8 w-20 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function UsersTable({
  addToast,
  listVersion = 0,
  currentUserId,
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [roleSavingId, setRoleSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authApi.listUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast?.(err.message || "Failed to load users", "error");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load, listVersion]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
    );
  }, [users, search]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await authApi.deleteUser(deleteTarget.id);
      addToast?.("User removed", "success");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      addToast?.(err.message || "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function changeRole(user, nextRole) {
    if (user.role === nextRole) return;
    setRoleSavingId(user.id);
    try {
      await authApi.patchUserRole(user.id, nextRole);
      addToast?.("Role updated", "success");
      await load();
    } catch (err) {
      addToast?.(err.message || "Could not update role", "error");
    } finally {
      setRoleSavingId(null);
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Users</h2>
            <p className="mt-0.5 text-[13px] font-medium text-slate-400">
              {users.length} account{users.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="relative flex w-full items-center sm:w-64">
            <span className="pointer-events-none absolute left-2.5 flex items-center text-slate-400">
              <Icon name="search" size={14} />
            </span>
            <input
              className="w-full rounded-lg border-[1.5px] border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Search email or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users"
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Icon name="users" size={22} />
            </div>
            <p className="text-[15px] font-semibold text-slate-700">
              {users.length === 0 ? "No users yet" : "No matches"}
            </p>
            <p className="mt-1 text-[13px] font-medium text-slate-400">
              {users.length === 0
                ? "Create a user with the form above."
                : "Try a different search."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  {["Email", "Role", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.07em] text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = currentUserId != null && u.id === currentUserId;
                  const disableDelete = isSelf;
                  return (
                    <tr
                      key={u.id}
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-3 text-[13px] font-semibold text-slate-900">
                        <span className="break-all">{u.email}</span>
                        {isSelf && (
                          <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-indigo-500">
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-semibold text-slate-700 outline-none transition-all hover:border-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                          value={u.role}
                          disabled={roleSavingId === u.id}
                          onChange={(e) => changeRole(u, e.target.value)}
                          aria-label={`Role for ${u.email}`}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-slate-500">
                        {formatCreated(u.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={disableDelete}
                          title={
                            isSelf ? "You cannot delete your own account here" : "Delete user"
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-[12px] font-semibold text-red-600 transition-all hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Icon name="trash" size={14} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete user?"
      >
        <p className="text-[14px] font-medium leading-relaxed text-slate-600">
          This will permanently remove{" "}
          <span className="font-semibold text-slate-900">{deleteTarget?.email}</span>.
          This cannot be undone.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={deleting}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </button>
          <PrimaryButton variant="danger" disabled={deleting} onClick={confirmDelete}>
            {deleting ? "Deleting…" : "Delete user"}
          </PrimaryButton>
        </div>
      </Modal>
    </>
  );
}
