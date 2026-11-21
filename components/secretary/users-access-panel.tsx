"use client";

import { useState } from "react";

type Staff = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  head_title: string | null;
  is_active: boolean;
};

const ROLES = [
  { value: "secretary", label: "Secretary" },
  { value: "chief_ambassador", label: "Chief Ambassador" },
  { value: "ambassador", label: "Ambassador" },
  { value: "mentor", label: "Mentor" },
  { value: "head", label: "Head" },
];

export function UsersAccessPanel({
  initialStaff,
  currentUserId,
}: {
  initialStaff: Staff[];
  currentUserId: string | null;
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("ambassador");
  const [headTitle, setHeadTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("ambassador");
  const [editHeadTitle, setEditHeadTitle] = useState("");
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ id: string; message: string } | null>(null);

  function startEdit(s: Staff) {
    setEditingId(s.id);
    setEditRole(s.role);
    setEditHeadTitle(s.head_title || "");
    setRowError(null);
  }

  async function saveEdit(staffId: string) {
    setRowSavingId(staffId);
    setRowError(null);
    try {
      const res = await fetch("/api/staff/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: staffId, role: editRole, head_title: editHeadTitle }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setStaff((prev) =>
        prev.map((s) =>
          s.id === staffId ? { ...s, role: editRole, head_title: editHeadTitle || null } : s
        )
      );
      setEditingId(null);
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRowSavingId(null);
    }
  }

  async function toggleActive(s: Staff) {
    setRowSavingId(s.id);
    setRowError(null);
    try {
      const res = await fetch("/api/staff/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_id: s.id, is_active: !s.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setStaff((prev) => prev.map((row) => (row.id === s.id ? { ...row, is_active: !s.is_active } : row)));
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRowSavingId(null);
    }
  }

  async function sendNow(s: Staff) {
    setSendingId(s.id);
    setSendResult(null);
    try {
      const res = await fetch("/api/secretary/send-notification-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: s.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed");
      setSendResult({ id: s.id, message: json.message || "Sent." });
    } catch (e) {
      setSendResult({ id: s.id, message: e instanceof Error ? e.message : "Send failed." });
    } finally {
      setSendingId(null);
    }
  }

  async function invite() {
    setError(null);
    setSuccess(null);
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name, email, role, head_title: headTitle }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invite failed");
      setStaff((prev) => [
        ...prev,
        { id: crypto.randomUUID(), full_name: name, email, role, head_title: headTitle || null, is_active: true },
      ]);
      setSuccess(`Invited ${name} — they'll get an email to set their password.`);
      setName("");
      setEmail("");
      setHeadTitle("");
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-marigold">
            Management
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">Users &amp; Access</h1>
          <p className="mt-1 text-sm text-muted">
            Invite and manage Secretary, Chief Ambassador, Ambassador, Mentor, and Head accounts.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="whitespace-nowrap rounded-lg bg-marigold px-4 py-2.5 text-sm font-semibold text-ink"
        >
          {showForm ? "Cancel" : "+ Invite staff"}
        </button>
      </div>

      {showForm && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {role === "head" && (
              <input
                value={headTitle}
                onChange={(e) => setHeadTitle(e.target.value)}
                placeholder="Head title (e.g. Web Dev Head)"
                className="rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink"
              />
            )}
          </div>
          {error && (
            <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
          <button
            onClick={invite}
            disabled={saving}
            className="mt-4 rounded-lg bg-marigold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {saving ? "Inviting..." : "Send invite"}
          </button>
        </div>
      )}

      {success && (
        <p className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {success}
        </p>
      )}

      {rowError && (
        <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {rowError}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
       <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  No staff accounts yet.
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3 text-ink">{s.full_name}</td>
                  <td className="px-4 py-3 text-muted">{s.email}</td>
                  <td className="px-4 py-3 capitalize text-ink-light">
                    {editingId === s.id ? (
                      <div className="flex flex-col gap-2">
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          className="rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink"
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        {editRole === "head" && (
                          <input
                            value={editHeadTitle}
                            onChange={(e) => setEditHeadTitle(e.target.value)}
                            placeholder="Head title"
                            className="rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink"
                          />
                        )}
                      </div>
                    ) : (
                      s.head_title || s.role.replace("_", " ")
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        s.is_active
                          ? "bg-green-500/15 text-green-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === s.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(s.id)}
                          disabled={rowSavingId === s.id}
                          className="rounded-md bg-marigold px-2.5 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                        >
                          {rowSavingId === s.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-light"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-light hover:border-marigold/50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleActive(s)}
                          disabled={rowSavingId === s.id || s.id === currentUserId}
                          title={s.id === currentUserId ? "You can't deactivate your own account" : undefined}
                          className={`rounded-md px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                            s.is_active
                              ? "bg-red-500/15 text-red-400"
                              : "bg-green-500/15 text-green-400"
                          }`}
                        >
                          {rowSavingId === s.id
                            ? "Saving..."
                            : s.is_active
                              ? "Deactivate"
                              : "Reactivate"}
                        </button>
                        <button
                          onClick={() => sendNow(s)}
                          disabled={sendingId === s.id}
                          className="rounded-md border border-marigold/40 px-2.5 py-1.5 text-xs font-semibold text-marigold hover:bg-marigold/10 disabled:opacity-50"
                        >
                          {sendingId === s.id ? "Sending..." : "✉ Send login email now"}
                        </button>
                        {sendResult?.id === s.id && (
                          <span className="text-[11px] text-ink-light">{sendResult.message}</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
       </div>
      </div>
    </div>
  );
}
