import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import { USER_ROLES } from '../constants/roles';
const UsersPage = () => {
  const { users, setUsers, refreshUsers, checkAccess, addNotification, toast } = useAppContext();

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, user: null });
  const [newUser, setNewUser] = useState({ name: '', username: '', email: '', role: 'customer_support', pass: '' });

  if (!checkAccess('users')) return <Navigate to="/dashboard" />;

  const saveUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.pass) { toast('Required fields missing', 'error'); return; }
    
    try {
      await axios.post('/user/users/create', {
        username: newUser.username,
        full_name: newUser.name,
        email: newUser.email,
        password: newUser.pass,
        role: newUser.role
      });
      
      addNotification({
        type: 'create',
        module: 'Team Directory',
        action: 'User Invited',
        message: `User "${newUser.name}" invited to the team as ${newUser.role}`,
        entityId: newUser.email
      });

      refreshUsers();
      setAddModal(false);
      setNewUser({ name: '', username: '', email: '', role: 'customer_support', pass: '' });
      toast(`${newUser.name} added to team!`, 'success');
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.detail || 'Failed to invite user', 'error');
    }
  };

  const toggleUser = async (user) => {
    try {
      await axios.put(`/user/users/update/${user.username}`, {
        disabled: !user.disabled
      });
      refreshUsers();
      toast(`User ${user.disabled ? 'activated' : 'deactivated'}`, 'warn');
    } catch (err) {
      console.error(err);
      toast('Failed to update status', 'error');
    }
  };

  const deleteUser = async (username) => {
    if (window.confirm('Remove this user from the system?')) {
      try {
        await axios.delete(`/user/users/delete/${username}`);
        addNotification({
          type: 'delete',
          module: 'Team Directory',
          action: 'User Removed',
          message: `User removed from the team`,
          entityId: username
        });
        refreshUsers();
        toast('User removed', 'error');
      } catch (err) {
        console.error(err);
        toast('Failed to remove user', 'error');
      }
    }
  };

  const updateUser = async () => {
    const { user } = editModal;
    try {
      await axios.put(`/user/users/update/${user.username}`, {
        role: user.role,
        full_name: user.name,
        email: user.email
      });

      addNotification({
        type: 'update',
        module: 'Team Directory',
        action: 'Role Updated',
        message: `Role for "${user.name}" updated to ${user.role.toUpperCase()}`,
        entityId: user.email
      });

      refreshUsers();
      setEditModal({ open: false, user: null });
      toast('User role updated', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to update user', 'error');
    }
  };

  return (
    <div className="page" id="page_users">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>User Management</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Control platform access and assign team roles</p>
        </div>
        <button className="btn btn-sky" onClick={() => setAddModal(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
          Invite Member
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Last Active</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', background: 'var(--bg3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'var(--text3)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      </div>
                      {u.full_name || u.username}
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: '12px' }}>{u.email}</td>
                  <td>
                    <span style={{ 
                      fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', 
                      color: u.role === 'ceo' || u.role === 'partner' ? 'var(--gold)' : u.role === 'admin' ? 'var(--sky)' : 'var(--text3)',
                      background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px'
                    }}>{USER_ROLES.find(r => r.value === u.role)?.label || u.role}</span>
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text3)' }}>{u.created_at?.slice(0, 10) || 'Never'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" title="Edit Role" onClick={() => setEditModal({ open: true, user: { ...u, name: u.full_name } })}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                      </button>
                      <button className="btn btn-red btn-sm" title="Remove" onClick={() => deleteUser(u.username)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
          <span>Invite Team Member</span>
        </div>
      } footer={
        <>
          <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Cancel</button>
          <button className="btn btn-sky" onClick={saveUser}>Send Invitation</button>
        </>
      }>
        <div className="fr">
          <div className="fg"><label className="fl">Full Name</label><input className="fi" placeholder="Enter name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} /></div>
          <div className="fg"><label className="fl">Username</label><input className="fi" placeholder="e.g. fezi123" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} /></div>
        </div>
        <div className="fg"><label className="fl">Email Address</label><input className="fi" type="email" placeholder="name@elitepool.in" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} /></div>
        <div className="fr">
          <div className="fg"><label className="fl">Role</label>
            <select className="fs" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
              {USER_ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
          </div>
          <div className="fg"><label className="fl">Initial Password</label><input className="fi" type="password" placeholder="••••••••" value={newUser.pass} onChange={e => setNewUser({...newUser, pass: e.target.value})} /></div>
        </div>
      </Modal>

      <Modal open={editModal.open} onClose={() => setEditModal({ open: false, user: null })} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
          <span>Edit User Role</span>
        </div>
      }>
        {editModal.user && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', background: 'var(--bg2)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ width: '48px', height: '48px', background: 'var(--bg3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700 }}>{editModal.user.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{editModal.user.email}</div>
              </div>
            </div>
            <div className="fg">
              <label className="fl">Assign New Role</label>
              <select 
                className="fs" 
                value={editModal.user.role}
                onChange={e => setEditModal({ ...editModal, user: { ...editModal.user, role: e.target.value } })}
              >
                {USER_ROLES.map(role => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-sky" style={{ width: '100%', marginTop: '12px' }} onClick={updateUser}>Update User</button>
          </>
        )}
      </Modal>
    </div>
  );
};

export default UsersPage;
