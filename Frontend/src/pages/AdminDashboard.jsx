import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import AdminLayout from "../components/admin/AdminLayout";
import CreateUserForm from "../components/admin/CreateUserForm";
import UsersTable from "../components/admin/UsersTable";

export default function AdminDashboard({ addToast }) {
  const { user } = useAuth();
  const [listVersion, setListVersion] = useState(0);

  return (
    <AdminLayout
      title="Admin"
      subtitle="Manage Voice-Labs accounts"
    >
      <CreateUserForm
        addToast={addToast}
        onCreated={() => setListVersion((v) => v + 1)}
      />
      <UsersTable
        addToast={addToast}
        listVersion={listVersion}
        currentUserId={user?.id}
      />
    </AdminLayout>
  );
}
