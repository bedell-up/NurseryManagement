import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { users as usersApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import Confirm from '../../components/ui/Confirm';
import { Plus, Pencil, Trash2, Users, ShieldCheck, Shield, User } from 'lucide-react';

const ROLES = ['admin', 'manager', 'staff'];

const ROLE_META = {
  admin:   { label: 'Admin',   color: 'bg-red-100 text-red-700',    icon: ShieldCheck },
  manager: { label: 'Manager', color: 'bg-amber-100 text-amber-700', icon: Shield },
  staff:   { label: 'Staff',   color: 'bg-blue-100 text-blue-700',   icon: User },
};

const EMPTY_FORM = { email: '', name: '', role: 'staff', password: '', confirm_password: '' };

function UserForm({ initial, onSave, onCancel, isPending, error, isEdit }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isEdit && form.password !== form.confirm_password) return;
    onSave(form);
  };

  const passwordMismatch = form.confirm_password && form.password !== form.confirm_password;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Email *</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={set('email')}
            required
            autoFocus={!isEdit}
            disabled={isEdit}
            placeholder="user@example.com"
          />
          {isEdit && <p className="text-forest-400 text-xs mt-1">Email cannot be changed after creation.</p>}
        </div>
        <div className="col-span-2">
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={set('name')} placeholder="Full name (optional)" />
        </div>
        <div className="col-span-2">
          <label className="label">Role *</label>
          <select className="select" value={form.role} onChange={set('role')} required>
            {ROLES.map(r => (
              <option key={r} value={r}>{ROLE_META[r].label}</option>
            ))}
          </select>
          <p className="text-forest-400 text-xs mt-1">
            Admin: full access · Manager: can edit most data · Staff: read + limited edits
          </p>
        </div>
      </div>

      <div className="border-t border-forest-100 pt-4">
        <p className="text-sm font-medium text-forest-700 mb-3">
          {isEdit ? 'Change Password (leave blank to keep current)' : 'Password *'}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{isEdit ? 'New Password' : 'Password'}</label>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={set('password')}
              required={!isEdit}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input
              className={`input ${passwordMismatch ? 'border-red-400' : ''}`}
              type="password"
              value={form.confirm_password}
              onChange={set('confirm_password')}
              required={!isEdit && !!form.password}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
            {passwordMismatch && <p className="text-red-500 text-xs mt-1">Passwords do not match</p>}
          </div>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button
          type="submit"
          disabled={isPending || passwordMismatch}
          className="btn-primary"
        >
          {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
        </button>
      </div>
    </form>
  );
}

function RoleBadge({ role }) {
  const meta = ROLE_META[role] ?? ROLE_META.staff;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      <Icon size={11} /> {meta.label}
    </span>
  );
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [modalUser, setModalUser] = useState(null); // null=closed, 'new'=create, object=edit
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError] = useState('');
  const [toggleTarget, setToggleTarget] = useState(null);

  const { data: userList = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => usersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setModalUser(null); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setModalUser(null); setToggleTarget(null); setFormError(''); },
    onError: (e) => setFormError(e.response?.data?.error || 'Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => usersApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleteTarget(null); },
  });

  const handleSave = (form) => {
    if (!form.password && !modalUser?.id) return setFormError('Password is required');
    if (form.password && form.password !== form.confirm_password) return setFormError('Passwords do not match');
    if (form.password && form.password.length < 8) return setFormError('Password must be at least 8 characters');

    const payload = {
      email: form.email,
      name: form.name || null,
      role: form.role,
      ...(form.password ? { password: form.password } : {}),
    };

    if (modalUser === 'new') {
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate({ id: modalUser.id, data: payload });
    }
  };

  const openEdit = (u) => {
    setFormError('');
    setModalUser({ ...u, password: '', confirm_password: '' });
  };

  const handleToggleActive = (u) => {
    updateMutation.mutate({ id: u.id, data: { is_active: !u.is_active } });
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="p-6 max-w-screen-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-forest-900">Users</h1>
          <p className="text-forest-500 text-sm mt-0.5">Manage who can access the admin backend.</p>
        </div>
        <button onClick={() => { setModalUser('new'); setFormError(''); }} className="btn-primary">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-forest-50 border-b border-forest-100 text-left">
              <th className="px-4 py-3 font-medium text-forest-600">User</th>
              <th className="px-4 py-3 font-medium text-forest-600">Role</th>
              <th className="px-4 py-3 font-medium text-forest-600">Status</th>
              <th className="px-4 py-3 font-medium text-forest-600 hidden md:table-cell">Last Login</th>
              <th className="px-4 py-3 font-medium text-forest-600 hidden md:table-cell">Created</th>
              <th className="px-4 py-3 font-medium text-forest-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest-50">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-3">
                    <div className="h-4 bg-forest-100 rounded animate-pulse w-3/4" />
                  </td>
                </tr>
              ))
            ) : userList.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <Users size={32} className="mx-auto mb-3 text-forest-200" />
                  <p className="text-forest-400 font-medium">No users yet</p>
                </td>
              </tr>
            ) : (
              userList.map(u => (
                <tr key={u.id} className={`hover:bg-forest-50/60 transition-colors group ${!u.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-forest-900 flex items-center gap-2">
                      {u.name || <span className="text-forest-400 italic">No name</span>}
                      {u.id === currentUser?.id && (
                        <span className="text-xs bg-forest-100 text-forest-500 px-1.5 py-0.5 rounded-full">you</span>
                      )}
                    </div>
                    <div className="text-xs text-forest-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => u.id !== currentUser?.id && setToggleTarget(u)}
                      disabled={u.id === currentUser?.id}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        u.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-forest-100 text-forest-500 hover:bg-forest-200'
                      } ${u.id === currentUser?.id ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-forest-500 hidden md:table-cell">{fmtDate(u.last_login_at)}</td>
                  <td className="px-4 py-3 text-forest-500 hidden md:table-cell">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(u)} className="btn-ghost px-2 py-1.5" title="Edit">
                        <Pencil size={14} />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => setDeleteTarget(u)} className="btn px-2 py-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Role legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-forest-400">
        <span><span className="font-medium text-forest-600">Admin</span> — full access including user management</span>
        <span><span className="font-medium text-forest-600">Manager</span> — can create and edit plants, inventory, production</span>
        <span><span className="font-medium text-forest-600">Staff</span> — read access + limited edits</span>
      </div>

      {/* Create / Edit modal */}
      {modalUser !== null && (
        <Modal
          title={modalUser === 'new' ? 'Add User' : 'Edit User'}
          onClose={() => { setModalUser(null); setFormError(''); }}
        >
          <UserForm
            initial={modalUser === 'new' ? EMPTY_FORM : modalUser}
            onSave={handleSave}
            onCancel={() => { setModalUser(null); setFormError(''); }}
            isPending={createMutation.isPending || updateMutation.isPending}
            error={formError}
            isEdit={modalUser !== 'new'}
          />
        </Modal>
      )}

      {/* Toggle active confirm */}
      {toggleTarget && (
        <Confirm
          title={toggleTarget.is_active ? 'Deactivate User' : 'Activate User'}
          message={
            toggleTarget.is_active
              ? `Deactivate "${toggleTarget.email}"? They will no longer be able to log in.`
              : `Reactivate "${toggleTarget.email}"? They will be able to log in again.`
          }
          onConfirm={() => handleToggleActive(toggleTarget)}
          onCancel={() => setToggleTarget(null)}
          danger={toggleTarget.is_active}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Confirm
          title="Delete User"
          message={`Permanently delete "${deleteTarget.email}"? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}
