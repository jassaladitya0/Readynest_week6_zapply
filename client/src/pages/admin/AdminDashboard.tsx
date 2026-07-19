import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Flag, Activity, Shield, Search,
  Ban, Trash2, Bell, CheckCircle, RefreshCw, LogOut
} from 'lucide-react';
import { adminAPI } from '../../lib/api';
import type { AdminUser, Report } from '../../types';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import './AdminPages.css';

type Tab = 'reports' | 'users' | 'actions';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('reports');
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [suspendDialog, setSuspendDialog] = useState<{ userId: string; handle: string } | null>(null);
  const [suspendHours, setSuspendHours] = useState(24);
  const [suspendReason, setSuspendReason] = useState('');

  // Auth check
  useEffect(() => {
    const token = sessionStorage.getItem('zapply_admin_token');
    const expires = Number(sessionStorage.getItem('zapply_admin_expires') || 0);
    if (!token || Date.now() > expires) {
      navigate('/admin-zapply-secret');
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [statsData, reportsData, usersData, actionsData] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getReports({ status: 'pending' }),
        adminAPI.getUsers(),
        adminAPI.getActions(),
      ]);
      setStats(statsData);
      setReports(reportsData.reports || []);
      setUsers(usersData.users || []);
      setActions(actionsData.actions || []);
    } catch (err: any) {
      if (err.response?.status === 403) {
        navigate('/admin-zapply-secret');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSearchUsers = async (q: string) => {
    setUserSearch(q);
    try {
      const res = await adminAPI.getUsers({ search: q });
      setUsers(res.users || []);
    } catch { /* ignore */ }
  };

  const handleWarn = async (userId: string, handle: string) => {
    const reason = prompt(`Warning reason for @${handle}:`);
    if (!reason) return;
    try {
      await adminAPI.warnUser(userId, reason);
      toast.success(`Warning sent to @${handle}`);
      loadData();
    } catch { toast.error('Failed to warn user'); }
  };

  const handleSuspend = async () => {
    if (!suspendDialog) return;
    try {
      await adminAPI.suspendUser(suspendDialog.userId, suspendReason, suspendHours);
      toast.success(`@${suspendDialog.handle} suspended for ${suspendHours}h`);
      setSuspendDialog(null);
      setSuspendReason('');
      loadData();
    } catch { toast.error('Failed to suspend user'); }
  };

  const handleUnsuspend = async (userId: string, handle: string) => {
    if (!confirm(`Unsuspend @${handle}?`)) return;
    try {
      await adminAPI.unsuspendUser(userId);
      toast.success(`@${handle} unsuspended`);
      loadData();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (userId: string, handle: string) => {
    const reason = prompt(`Delete reason for @${handle} (this is permanent!):`);
    if (!reason) return;
    if (!confirm(`PERMANENTLY delete @${handle}? This cannot be undone.`)) return;
    try {
      await adminAPI.deleteUser(userId, reason);
      toast.success(`@${handle} deleted`);
      loadData();
    } catch { toast.error('Failed to delete user'); }
  };

  const handleDismissReport = async (reportId: string) => {
    await adminAPI.updateReport(reportId, 'dismissed');
    setReports((prev) => prev.filter((r) => r._id !== reportId));
    toast.success('Report dismissed');
  };

  const handleActionReport = async (reportId: string) => {
    await adminAPI.updateReport(reportId, 'actioned');
    setReports((prev) => prev.filter((r) => r._id !== reportId));
    toast.success('Report marked as actioned');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('zapply_admin_token');
    sessionStorage.removeItem('zapply_admin_expires');
    navigate('/admin-zapply-secret');
  };

  if (isLoading) {
    return (
      <div className="admin-loading">
        <span className="spinner spinner-lg" />
        <p>Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-brand">
          <Shield size={24} style={{ color: '#ef4444' }} />
          <span>Zapply Admin</span>
        </div>
        <div className="admin-header-right">
          <motion.button className="btn btn-ghost btn-sm" onClick={loadData} whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}>
            <RefreshCw size={16} />
          </motion.button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="admin-stats">
          {[
            { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#7c3aed' },
            { label: 'Verified', value: stats.verifiedUsers, icon: CheckCircle, color: '#10b981' },
            { label: 'Suspended', value: stats.suspendedUsers, icon: Ban, color: '#f59e0b' },
            { label: 'Pending Reports', value: stats.pendingReports, icon: Flag, color: '#ef4444' },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              className="stat-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="stat-icon" style={{ background: `${stat.color}22`, color: stat.color }}>
                <stat.icon size={22} />
              </div>
              <div className="stat-value">{stat.value?.toLocaleString()}</div>
              <div className="stat-label">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        {(['reports', 'users', 'actions'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`admin-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'reports' && <><Flag size={14} /> Reports {reports.length > 0 && <span className="badge">{reports.length}</span>}</>}
            {t === 'users' && <><Users size={14} /> Users</>}
            {t === 'actions' && <><Activity size={14} /> Action Log</>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="admin-content">
        <AnimatePresence mode="wait">
          {/* Reports Tab */}
          {tab === 'reports' && (
            <motion.div key="reports" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {reports.length === 0 ? (
                <div className="admin-empty">
                  <CheckCircle size={40} style={{ color: 'var(--success)', opacity: 0.5 }} />
                  <p>No pending reports</p>
                </div>
              ) : (
                <div className="reports-list">
                  {reports.map((report) => (
                    <div key={report._id} className="report-card">
                      <div className="report-header">
                        <div>
                          <span className="report-label">Reported:</span>
                          <span className="report-user">@{report.reportedUserHandle}</span>
                          {(report.reportedUserId as any)?.isSuspended && (
                            <span className="badge-suspended">Suspended</span>
                          )}
                        </div>
                        <div className="report-time">
                          {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="report-body">
                        <span className="report-reason-badge">{report.reason.replace('_', ' ')}</span>
                        {report.description && <p className="report-desc">{report.description}</p>}
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          By: @{(report.reporterId as any)?.userId || 'unknown'}
                        </p>
                      </div>
                      <div className="report-actions">
                        <button
                          className="btn btn-sm"
                          style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                          onClick={() => handleWarn((report.reportedUserId as any)?._id || '', report.reportedUserHandle)}
                        >
                          <Bell size={12} /> Warn
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                          onClick={() => setSuspendDialog({ userId: (report.reportedUserId as any)?._id || '', handle: report.reportedUserHandle })}
                        >
                          <Ban size={12} /> Suspend
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleDismissReport(report._id)}>
                          Dismiss
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleActionReport(report._id)}>
                          <CheckCircle size={12} /> Actioned
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Users Tab */}
          {tab === 'users' && (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="users-search">
                <div className="input-with-icon">
                  <Search size={16} className="input-icon" />
                  <input
                    className="input admin-input"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    style={{ paddingLeft: 44 }}
                  />
                </div>
              </div>
              <div className="users-table">
                <div className="users-table-header">
                  <span>User</span>
                  <span>Status</span>
                  <span>Reports</span>
                  <span>Joined</span>
                  <span>Actions</span>
                </div>
                {users.map((user) => (
                  <div key={user._id} className="user-row">
                    <div className="user-info">
                      {user.avatar ? (
                        <img src={user.avatar} className="avatar avatar-sm" alt={user.displayName} />
                      ) : (
                        <div className="avatar-placeholder avatar-sm">{user.displayName.charAt(0)}</div>
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{user.displayName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{user.userId}</div>
                      </div>
                    </div>
                    <div className="user-status">
                      {user.isSuspended ? (
                        <span className="badge-suspended">Suspended</span>
                      ) : user.isVerified ? (
                        <span className="badge-active">Active</span>
                      ) : (
                        <span className="badge-pending">Unverified</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13 }}>{user.reportCount || 0}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {format(new Date(user.createdAt), 'MMM d, yyyy')}
                    </div>
                    <div className="user-actions">
                      <button className="btn btn-icon btn-ghost btn-sm" title="Warn" onClick={() => handleWarn(user._id, user.userId)}>
                        <Bell size={14} />
                      </button>
                      {user.isSuspended ? (
                        <button className="btn btn-icon btn-sm" title="Unsuspend" style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)' }} onClick={() => handleUnsuspend(user._id, user.userId)}>
                          <CheckCircle size={14} />
                        </button>
                      ) : (
                        <button className="btn btn-icon btn-sm" title="Suspend" style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)' }} onClick={() => setSuspendDialog({ userId: user._id, handle: user.userId })}>
                          <Ban size={14} />
                        </button>
                      )}
                      <button className="btn btn-icon btn-sm" title="Delete" style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }} onClick={() => handleDelete(user._id, user.userId)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Actions Tab */}
          {tab === 'actions' && (
            <motion.div key="actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="actions-list">
                {actions.length === 0 && <div className="admin-empty"><p>No actions logged yet</p></div>}
                {actions.map((action) => (
                  <div key={action._id} className="action-row">
                    <div className={`action-badge action-${action.action}`}>{action.action}</div>
                    <div>
                      <span style={{ fontSize: 13 }}>
                        @{(action.targetUserId as any)?.userId || action.targetUserHandle}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {action.reason}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Suspend Dialog */}
      <AnimatePresence>
        {suspendDialog && (
          <motion.div className="admin-dialog-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="admin-dialog" initial={{ scale: 0.9, y: -20 }} animate={{ scale: 1, y: 0 }}>
              <h3>Suspend @{suspendDialog.handle}</h3>
              <div className="input-group">
                <label className="input-label">Duration</label>
                <select className="input admin-input" value={suspendHours} onChange={(e) => setSuspendHours(Number(e.target.value))}>
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                  <option value={0}>Permanent</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Reason</label>
                <input className="input admin-input" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="Reason for suspension..." />
              </div>
              <div className="dialog-actions">
                <button className="btn btn-secondary" onClick={() => setSuspendDialog(null)}>Cancel</button>
                <button className="btn btn-danger" onClick={handleSuspend}>Suspend</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
