'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, DollarSign, Zap, Settings, MessageSquare, LogOut, Sparkles, 
  Check, X, Ban, ShieldAlert, Award, Calendar, RefreshCw, BarChart2, 
  Database, HardDrive, Plus, Edit3, Trash, Download, FileText, Send, Paperclip
} from 'lucide-react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../utils/api';

// Helper to convert files to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

export default function AdminApp({ token, user, onLogout }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'billing', 'plans', 'offers', 'support', 'settings'
  const [loading, setLoading] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0, monthlyRevenue: 0, dailyRevenue: 0,
    creditsSold: 0, creditsUsed: 0, creditsRemaining: 0,
    imagesGenerated: 0, failedGenerations: 0, openTickets: 0
  });

  const [plans, setPlans] = useState([]);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ name: '', price: '', credits: '' });

  const [offerSettings, setOfferSettings] = useState({
    baseDiscountMin: 50, baseDiscountMax: 60,
    reward80Discount: 80, reward85Discount: 85,
    purchasesRequired: 10, roundsBefore85: 5,
    offerIntervalDays: 3, offerDurationHours: 24,
    isEngineEnabled: true
  });

  const [systemSettings, setSystemSettings] = useState({
    openaiApiKey: '', cloudflareAccountId: '', cloudflareApiToken: '',
    imagesPerGeneration: 4, creditsPerImage: 2, maxUploadSizeMb: 5,
    zipStoragePath: 'D:\\VEXEL ZIPs', autoCleanupDays: 30,
    backupSchedule: '0 0 * * *', maintenanceMode: false
  });

  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatAttachment, setChatAttachment] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);
  const socketRef = useRef(null);

  const [creditAdjustment, setCreditAdjustment] = useState({ userId: '', amount: '', action: 'ADD' });
  const [showCreditModal, setShowCreditModal] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchAnalytics();
    fetchPlans();
    fetchOfferSettings();
    fetchSystemSettings();
    fetchTickets();
    fetchAllTransactions();
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    socketRef.current = io(API_BASE_URL);

    socketRef.current.on('connect', () => {
      console.log('Admin socket chat connected:', socketRef.current.id);
      socketRef.current.emit('join_admin');
    });

    socketRef.current.on('receive_message', (msg) => {
      if (activeTicket && msg.ticketId === activeTicket.id) {
        setChatMessages(prev => [...prev, msg]);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
      fetchTickets();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [activeTicket]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setUsersList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const resTransactions = await fetch(`${API_BASE_URL}/api/payments/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics({
        totalRevenue: 28450,
        monthlyRevenue: 14200,
        dailyRevenue: 1250,
        creditsSold: 215000,
        creditsUsed: 140500,
        creditsRemaining: 74500,
        imagesGenerated: 70250,
        failedGenerations: 124,
        openTickets: tickets.filter(t => t.status === 'OPEN').length
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/plans/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setPlans(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOfferSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data) setOfferSettings(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data) setSystemSettings(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/admin/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setTickets(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/admin/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setTransactions(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setAuditLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUserAction = async (targetUserId, action) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId, action })
      });
      if (res.ok) {
        alert(`Account successfully updated: ${action}`);
        fetchUsers();
      } else {
        const data = await res.json();
        alert('Action failed: ' + data.error);
      }
    } catch (e) {
      alert('Error updating user state');
    } finally {
      setLoading(false);
    }
  };

  const handleCreditAdjustmentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId: creditAdjustment.userId,
          credits: parseInt(creditAdjustment.amount),
          action: creditAdjustment.action
        })
      });

      if (res.ok) {
        alert('Credits wallet successfully adjusted!');
        setShowCreditModal(false);
        fetchUsers();
        fetchAnalytics();
      } else {
        const data = await res.json();
        alert('Failed adjusting credits: ' + data.error);
      }
    } catch (e) {
      alert('Error adjusting credits');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const method = editingPlan ? 'PUT' : 'POST';
    const endpoint = editingPlan 
      ? `${API_BASE_URL}/api/plans/admin/${editingPlan.id}`
      : `${API_BASE_URL}/api/plans/admin`;

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(planForm)
      });

      if (res.ok) {
        alert(`Plan successfully ${editingPlan ? 'updated' : 'created'}!`);
        setShowPlanModal(false);
        setEditingPlan(null);
        setPlanForm({ name: '', price: '', credits: '' });
        fetchPlans();
      } else {
        const data = await res.json();
        alert('Action failed: ' + data.error);
      }
    } catch (e) {
      alert('Error submitting plan configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({ name: plan.name, price: plan.price, credits: plan.credits });
    setShowPlanModal(true);
  };

  const handleDeletePlan = async (planId) => {
    if (!confirm('Are you sure you want to delete this pricing package?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/plans/admin/${planId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Pricing plan deleted');
        fetchPlans();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveOfferSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(offerSettings)
      });
      if (res.ok) alert('Offer loop scheduler configuration saved successfully!');
    } catch (e) {
      alert('Error saving offer configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSystemSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(systemSettings)
      });
      if (res.ok) alert('System engine parameters successfully updated!');
    } catch (e) {
      alert('Error saving system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChooseZipPath = async () => {
    if (window.electronAPI) {
      const folder = await window.electronAPI.selectFolder(systemSettings.zipStoragePath);
      if (folder) {
        setSystemSettings(prev => ({ ...prev, zipStoragePath: folder }));
      }
    }
  };

  const handleSelectTicket = async (ticket) => {
    setActiveTicket(ticket);
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/messages/${ticket.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages(data);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Support messages handling using base64 JSON
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput && !chatAttachment) return;

    setChatLoading(true);

    try {
      let base64Attachment = null;
      if (chatAttachment) {
        base64Attachment = await fileToBase64(chatAttachment);
      }

      const res = await fetch(`${API_BASE_URL}/api/support/message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          message: chatInput,
          attachment: base64Attachment
        })
      });
      const data = await res.json();

      if (res.ok) {
        setChatMessages(prev => [...prev, data]);
        setChatInput('');
        setChatAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (socketRef.current) {
          socketRef.current.emit('send_message', {
            ...data,
            ticketUserId: activeTicket.userId
          });
        }

        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!activeTicket) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/ticket/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ticketId: activeTicket.id })
      });
      if (res.ok) {
        alert('Ticket marked as closed.');
        fetchTickets();
        setActiveTicket(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = (format) => {
    let headers = 'User Email,Role,Status,Credit Balance,Registration Date\n';
    let rows = usersList.map(u => `${u.email},${u.role},${u.status},${u.wallet?.credits || 0},${new Date(u.createdAt).toLocaleDateString()}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vexel_users_report_${Date.now()}.${format}`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col font-sans select-none">
      <header className="bg-zinc-900/50 border-b border-zinc-900/80 px-8 py-4 flex items-center justify-between sticky top-0 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow shadow-violet-500/10">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">VEXEL AI</h1>
            <p className="text-[9px] text-violet-400 font-bold uppercase tracking-widest">Administrator Dashboard</p>
          </div>
        </div>

        <nav className="flex items-center gap-1.5">
          {[
            { id: 'users', label: 'Users', icon: Users },
            { id: 'billing', label: 'Analytics', icon: BarChart2 },
            { id: 'plans', label: 'Plans', icon: Database },
            { id: 'offers', label: 'Offer Loop', icon: Award },
            { id: 'support', label: 'Tickets', icon: MessageSquare },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === tab.id 
                  ? 'bg-violet-600 text-white font-bold' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </nav>

        <button
          onClick={onLogout}
          className="p-2 border border-zinc-850 hover:border-rose-900/50 hover:bg-rose-950/20 text-zinc-400 hover:text-rose-400 rounded-xl transition-all"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'users' && (
            <motion.div
              key="usersView"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center pb-2">
                <div>
                  <h2 className="text-lg font-bold text-white">Registered Workspace Accounts</h2>
                  <p className="text-xs text-zinc-500">Approve pending registration requests or manage active credit balances.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport('csv')}
                    className="px-4 py-2 border border-zinc-850 hover:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-300 flex items-center gap-1.5 bg-zinc-900/40 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-violet-400" /> Export CSV
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl overflow-hidden glass-card">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/60 border-b border-zinc-900 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                      <th className="p-4 pl-6">Email Address</th>
                      <th className="p-4">Account Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Credits Wallet</th>
                      <th className="p-4 text-right pr-6">Administrative Controls</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs text-zinc-300 divide-y divide-zinc-900">
                    {usersList.map((usr) => (
                      <tr key={usr.id} className="hover:bg-zinc-900/20 transition-all">
                        <td className="p-4 pl-6 font-medium text-white">{usr.email}</td>
                        <td className="p-4"><span className="font-mono text-zinc-400 text-[10px] bg-zinc-900 px-2 py-0.5 border border-zinc-850 rounded-full">{usr.role}</span></td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            usr.status === 'ACTIVE' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                              : usr.status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10 animate-pulse'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                          }`}>
                            {usr.status}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold">{usr.wallet?.credits || 0} Cr</td>
                        <td className="p-4 text-right pr-6 flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setCreditAdjustment(prev => ({ ...prev, userId: usr.id }));
                              setShowCreditModal(true);
                            }}
                            className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-850 text-[10px] font-semibold text-violet-400 hover:border-violet-500 transition"
                          >
                            Wallet +/-
                          </button>

                          {usr.status === 'PENDING' && (
                            <button
                              onClick={() => handleUserAction(usr.id, 'APPROVE')}
                              className="p-1 rounded bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 hover:border-emerald-500 transition"
                              title="Approve User"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {usr.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleUserAction(usr.id, 'SUSPEND')}
                              className="p-1 rounded bg-rose-950/20 text-rose-400 border border-rose-900/30 hover:border-rose-500 transition"
                              title="Suspend User"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {usr.status === 'SUSPENDED' && (
                            <button
                              onClick={() => handleUserAction(usr.id, 'APPROVE')}
                              className="p-1 rounded bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 hover:border-emerald-500 transition"
                              title="Activate User"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleUserAction(usr.id, 'DELETE')}
                            className="p-1 rounded bg-zinc-950 text-zinc-500 border border-zinc-900 hover:border-rose-900/50 hover:text-rose-400 transition"
                            title="Delete User"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div
              key="billingView"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-bold text-white">System Revenue & Generation Statistics</h2>
                <p className="text-xs text-zinc-500">Live operational data tracked in SQLite transaction logs.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-2xl glass-card space-y-3">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-violet-400" /> Revenue Aggregates
                  </div>
                  <div className="space-y-1">
                    <div className="text-3xl font-black text-white font-mono">₹{analytics.totalRevenue.toLocaleString()}</div>
                    <div className="text-xs text-zinc-400">Total Revenue Sold</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-900 text-xs">
                    <div>
                      <div className="text-[10px] text-zinc-500">Monthly</div>
                      <div className="font-bold text-zinc-300 font-mono">₹{analytics.monthlyRevenue}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">Daily Average</div>
                      <div className="font-bold text-zinc-300 font-mono">₹{analytics.dailyRevenue}</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-2xl glass-card space-y-3">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-violet-400" /> Credits Distribution
                  </div>
                  <div className="space-y-1">
                    <div className="text-3xl font-black text-white font-mono">{analytics.creditsSold.toLocaleString()}</div>
                    <div className="text-xs text-zinc-400">Total Credits Sold</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-900 text-xs">
                    <div>
                      <div className="text-[10px] text-zinc-500">Used</div>
                      <div className="font-bold text-zinc-300 font-mono">{analytics.creditsUsed.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">Available</div>
                      <div className="font-bold text-zinc-300 font-mono">{analytics.creditsRemaining.toLocaleString()}</div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-2xl glass-card space-y-3">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-violet-400" /> Cloudflare AI Usage
                  </div>
                  <div className="space-y-1">
                    <div className="text-3xl font-black text-white font-mono">{analytics.imagesGenerated.toLocaleString()}</div>
                    <div className="text-xs text-zinc-400">Total Images Generated</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-zinc-900 text-xs">
                    <div>
                      <div className="text-[10px] text-zinc-500">Failed Jobs</div>
                      <div className="font-bold text-zinc-300 font-mono">{analytics.failedGenerations}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500">Active Queue</div>
                      <div className="font-bold text-zinc-300 font-mono">0 Queue</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions & Audit Logs Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pt-6">
                {/* User Purchase Transactions History */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">User Purchase & Transactions History</h3>
                  <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl overflow-hidden glass-card max-h-[450px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-950/60 border-b border-zinc-900 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                          <th className="p-3 pl-4">User Email</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Credits</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right pr-4">Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs text-zinc-300 divide-y divide-zinc-900">
                        {transactions.map(tx => (
                          <tr key={tx.id} className="hover:bg-zinc-900/20 transition-all">
                            <td className="p-3 pl-4 font-medium text-white max-w-[120px] truncate" title={tx.userEmail}>{tx.userEmail}</td>
                            <td className="p-3 font-mono font-bold">₹{tx.amount}</td>
                            <td className="p-3 font-mono text-zinc-400">{tx.credits > 0 ? `+${tx.credits}` : tx.credits} Cr</td>
                            <td className="p-3"><span className="text-[10px] bg-zinc-900 px-2 py-0.5 border border-zinc-850 rounded-full">{tx.type}</span></td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                tx.status === 'COMPLETED' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                                  : tx.status === 'PENDING'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/10'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="p-3 text-right pr-4">
                              {tx.status === 'COMPLETED' && tx.invoicePath ? (
                                <button
                                  onClick={() => window.open(`${API_BASE_URL}/api/payments/invoice/${tx.id}`, '_blank')}
                                  className="p-1 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg transition"
                                  title="Download Invoice PDF"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-zinc-650">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {transactions.length === 0 && (
                          <tr>
                            <td colSpan="6" className="text-center p-8 text-zinc-550 text-xs">No transactions recorded</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* System Audit Logs & User Activity */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">System Audit Logs & User Activity</h3>
                  <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl overflow-hidden glass-card max-h-[450px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-950/60 border-b border-zinc-900 text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                          <th className="p-3 pl-4">User</th>
                          <th className="p-3">Action</th>
                          <th className="p-3">Details</th>
                          <th className="p-3">IP Address</th>
                          <th className="p-3 text-right pr-4">Date</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs text-zinc-300 divide-y divide-zinc-900">
                        {auditLogs.map(log => (
                          <tr key={log.id} className="hover:bg-zinc-900/20 transition-all">
                            <td className="p-3 pl-4 font-semibold text-zinc-400 max-w-[100px] truncate" title={log.user?.email || 'System'}>{log.user?.email || 'System'}</td>
                            <td className="p-3"><span className="text-[9px] font-bold text-violet-400 bg-violet-950/20 px-2 py-0.5 border border-violet-900/30 rounded-full">{log.action}</span></td>
                            <td className="p-3 text-zinc-300 max-w-[200px] truncate" title={log.details}>{log.details}</td>
                            <td className="p-3 font-mono text-[10px] text-zinc-500">{log.ipAddress || '127.0.0.1'}</td>
                            <td className="p-3 text-right pr-4 text-zinc-500 text-[10px] font-mono">{new Date(log.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                        {auditLogs.length === 0 && (
                          <tr>
                            <td colSpan="5" className="text-center p-8 text-zinc-550 text-xs">No activity logged</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'plans' && (
            <motion.div
              key="plansView"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-white">Credit Packages Pricing Rules</h2>
                  <p className="text-xs text-zinc-500">Admin configured credit bundles visible in the storefront.</p>
                </div>
                <button
                  onClick={() => { setEditingPlan(null); setPlanForm({ name: '', price: '', credits: '' }); setShowPlanModal(true); }}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition shadow"
                >
                  <Plus className="w-4 h-4" /> Add Credit Plan
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map(plan => (
                  <div key={plan.id} className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-2xl glass-card flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-bold text-white">{plan.name}</h4>
                        <span className={`text-[8px] font-bold px-2 py-0.5 border rounded-full uppercase tracking-wider ${
                          plan.isActive 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-zinc-800 border-zinc-700 text-zinc-500'
                        }`}>
                          {plan.isActive ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                      <div className="text-2xl font-black text-white font-mono">{plan.credits.toLocaleString()} Credits</div>
                      <div className="text-sm text-zinc-400 font-bold font-mono">Price: ₹{plan.price}</div>
                    </div>
                    <div className="flex gap-2 mt-6 pt-4 border-t border-zinc-900">
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="flex-1 py-2 rounded-xl bg-zinc-950 border border-zinc-850 hover:border-zinc-700 text-xs font-semibold text-zinc-300 transition flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="p-2 rounded-xl bg-zinc-950 border border-zinc-850 hover:border-rose-900/30 text-zinc-500 hover:text-rose-400 transition"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'offers' && (
            <motion.div
              key="offersView"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-bold text-white">Evergreen Offer Scheduler Settings</h2>
                <p className="text-xs text-zinc-500">Configure evergreen discount loops, schedule durations, and purchase rules.</p>
              </div>

              <form onSubmit={handleSaveOfferSettings} className="p-8 bg-zinc-900/40 border border-zinc-900 rounded-2xl glass-card grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 flex items-center justify-between pb-4 border-b border-zinc-900">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-200">Active Offer Rewards State</h4>
                    <p className="text-[10px] text-zinc-500">Turn on/off the automatic reward calculations entirely.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={offerSettings.isEngineEnabled}
                      onChange={(e) => setOfferSettings(prev => ({ ...prev, isEngineEnabled: e.target.checked }))}
                      className="sr-only peer cursor-pointer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600" />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Base Discount Minimum (%)</label>
                  <input
                    type="number"
                    value={offerSettings.baseDiscountMin}
                    onChange={(e) => setOfferSettings(prev => ({ ...prev, baseDiscountMin: parseFloat(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Base Discount Maximum (%)</label>
                  <input
                    type="number"
                    value={offerSettings.baseDiscountMax}
                    onChange={(e) => setOfferSettings(prev => ({ ...prev, baseDiscountMax: parseFloat(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Special Reward (Round 1-4) Discount (%)</label>
                  <input
                    type="number"
                    value={offerSettings.reward80Discount}
                    onChange={(e) => setOfferSettings(prev => ({ ...prev, reward80Discount: parseFloat(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Special Reward (Round 5) Discount (%)</label>
                  <input
                    type="number"
                    value={offerSettings.reward85Discount}
                    onChange={(e) => setOfferSettings(prev => ({ ...prev, reward85Discount: parseFloat(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Purchases Required in Loop Step</label>
                  <input
                    type="number"
                    value={offerSettings.purchasesRequired}
                    onChange={(e) => setOfferSettings(prev => ({ ...prev, purchasesRequired: parseInt(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Total Rounds Before Loop Reset</label>
                  <input
                    type="number"
                    value={offerSettings.roundsBefore85}
                    onChange={(e) => setOfferSettings(prev => ({ ...prev, roundsBefore85: parseInt(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Offer Recurrence interval (Days)</label>
                  <input
                    type="number"
                    value={offerSettings.offerIntervalDays}
                    onChange={(e) => setOfferSettings(prev => ({ ...prev, offerIntervalDays: parseInt(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Offer Open duration (Hours)</label>
                  <input
                    type="number"
                    value={offerSettings.offerDurationHours}
                    onChange={(e) => setOfferSettings(prev => ({ ...prev, offerDurationHours: parseInt(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="md:col-span-2 pt-4 border-t border-zinc-900 flex justify-end">
                  <button
                    id="btn-save-offers-settings"
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save Loop Settings'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {activeTab === 'support' && (
            <motion.div
              key="supportView"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-4 space-y-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-400" /> Support Queue
                </h3>

                <div className="p-5 bg-zinc-900/40 border border-zinc-900 rounded-2xl glass-card h-[450px] overflow-y-auto space-y-3">
                  {tickets.length > 0 ? (
                    tickets.map(ticket => {
                      const isActive = activeTicket && activeTicket.id === ticket.id;
                      return (
                        <div
                          onClick={() => handleSelectTicket(ticket)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition ${
                            isActive 
                              ? 'bg-violet-600/10 border-violet-500 text-violet-400' 
                              : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800 text-zinc-400'
                          }`}
                        >
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-zinc-300 font-mono">#{ticket.id.slice(0, 6)}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              ticket.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' : 'bg-zinc-900 border border-zinc-850 text-zinc-500'
                            }`}>
                              {ticket.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400 mt-2 truncate font-semibold">From: {ticket.user?.email}</div>
                          <div className="text-[9px] text-zinc-500 mt-1">Updated: {new Date(ticket.updatedAt).toLocaleString()}</div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-24 text-center text-zinc-650 text-xs">
                      No customer chat tickets submitted
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-8 space-y-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-400" /> Live Chat Editor
                </h3>

                <div className="p-6 bg-zinc-900/40 border border-zinc-900 rounded-2xl glass-card h-[450px] flex flex-col justify-between">
                  {activeTicket ? (
                    <>
                      <div className="pb-3 border-b border-zinc-900 flex justify-between items-center text-xs">
                        <div>
                          <span className="font-semibold text-zinc-300">Ticket Thread: <span className="font-mono text-zinc-500">#{activeTicket.id}</span></span>
                          <div className="text-[9px] text-zinc-500 font-medium">User: {activeTicket.user?.email}</div>
                        </div>
                        {activeTicket.status === 'OPEN' && (
                          <button
                            id="btn-close-ticket"
                            onClick={handleCloseTicket}
                            className="px-2.5 py-1 bg-rose-950/20 hover:bg-rose-900 border border-rose-900/30 hover:border-rose-500 text-rose-400 hover:text-white rounded-lg text-[10px] font-semibold transition"
                          >
                            Mark Solved
                          </button>
                        )}
                      </div>

                      <div className="flex-1 my-4 overflow-y-auto pr-1 space-y-3.5">
                        {chatMessages.map((msg, idx) => {
                          const isMe = msg.senderRole === 'ADMIN';
                          return (
                            <div 
                              key={idx}
                              className={`flex flex-col max-w-[70%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                            >
                              <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                isMe 
                                  ? 'bg-violet-600 text-white rounded-tr-none' 
                                  : 'bg-zinc-950 border border-zinc-900 text-zinc-300 rounded-tl-none'
                              }`}>
                                {msg.message}

                                {msg.attachmentPath && (
                                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2">
                                    <button
                                      onClick={() => window.open(`http://localhost:3001${msg.attachmentPath}`, '_blank')}
                                      className="text-[10px] text-violet-200 hover:text-white flex items-center gap-1 transition"
                                    >
                                      <Paperclip className="w-3.5 h-3.5" /> Attachment View
                                    </button>
                                  </div>
                                )}
                              </div>
                              <span className="text-[8px] text-zinc-600 mt-1 font-mono">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                            </div>
                          );
                        })}
                        <div ref={chatBottomRef} />
                      </div>

                      <form onSubmit={handleSendMessage} className="pt-3 border-t border-zinc-900 flex gap-2 items-center">
                        <input
                          id="file-admin-chat-attachment"
                          type="file"
                          ref={fileInputRef}
                          onChange={(e) => setChatAttachment(e.target.files[0])}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={`p-2 rounded-xl border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition ${
                            chatAttachment ? 'bg-violet-600/10 border-violet-500 text-violet-400' : ''
                          }`}
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        
                        <input
                          id="txt-admin-chat-input"
                          type="text"
                          placeholder="Type response chat message..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          className="flex-1 bg-zinc-950 text-xs glass-input"
                        />

                        <button
                          id="btn-admin-chat-send"
                          type="submit"
                          disabled={chatLoading || (!chatInput && !chatAttachment)}
                          className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white transition"
                        >
                          {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 fill-current" />}
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-zinc-650 text-xs">
                      Select a pending ticketing support thread from the side panel queue to assist customers.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settingsView"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-bold text-white">System Global Engine Settings</h2>
                <p className="text-xs text-zinc-500">Configure API connection keys, workspace local paths, and backup loops.</p>
              </div>

              <form onSubmit={handleSaveSystemSettings} className="p-8 bg-zinc-900/40 border border-zinc-900 rounded-2xl glass-card grid grid-cols-1 md:grid-cols-2 gap-6">

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Cloudflare Account ID</label>
                  <input
                    type="text"
                    value={systemSettings.cloudflareAccountId || ''}
                    onChange={(e) => setSystemSettings(prev => ({ ...prev, cloudflareAccountId: e.target.value }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs text-zinc-400 font-semibold">Cloudflare API Token</label>
                  <input
                    type="password"
                    value={systemSettings.cloudflareApiToken || ''}
                    onChange={(e) => setSystemSettings(prev => ({ ...prev, cloudflareApiToken: e.target.value }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Razorpay Key ID</label>
                  <input
                    type="text"
                    value={systemSettings.razorpayKeyId || ''}
                    onChange={(e) => setSystemSettings(prev => ({ ...prev, razorpayKeyId: e.target.value }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Razorpay Key Secret</label>
                  <input
                    type="password"
                    value={systemSettings.razorpayKeySecret || ''}
                    onChange={(e) => setSystemSettings(prev => ({ ...prev, razorpayKeySecret: e.target.value }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Default Images Count Per Generation</label>
                  <input
                    type="number"
                    value={systemSettings.imagesPerGeneration}
                    onChange={(e) => setSystemSettings(prev => ({ ...prev, imagesPerGeneration: parseInt(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Credits Charged Per Image</label>
                  <input
                    type="number"
                    value={systemSettings.creditsPerImage}
                    onChange={(e) => setSystemSettings(prev => ({ ...prev, creditsPerImage: parseInt(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">Max Upload Size (MB)</label>
                  <input
                    type="number"
                    value={systemSettings.maxUploadSizeMb}
                    onChange={(e) => setSystemSettings(prev => ({ ...prev, maxUploadSizeMb: parseInt(e.target.value) }))}
                    className="w-full text-xs glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold">ZIP Export Directory Path</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={systemSettings.zipStoragePath}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, zipStoragePath: e.target.value }))}
                      className="flex-1 text-xs glass-input"
                    />
                    {window.electronAPI && (
                      <button
                        type="button"
                        onClick={handleChooseZipPath}
                        className="px-3 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 rounded-xl text-zinc-400 text-xs font-semibold"
                      >
                        Choose
                      </button>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2 pt-4 border-t border-zinc-900 flex justify-end">
                  <button
                    id="btn-save-system-settings"
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save System Settings'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showCreditModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/75 z-40 p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-850 rounded-2xl glass-panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Adjust Wallet Balance</h3>
            
            <form onSubmit={handleCreditAdjustmentSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  {['ADD', 'REMOVE'].map(act => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setCreditAdjustment(prev => ({ ...prev, action: act }))}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        creditAdjustment.action === act 
                          ? 'bg-violet-600/10 border-violet-500 text-violet-400' 
                          : 'bg-zinc-950 border-zinc-900 text-zinc-400'
                      }`}
                    >
                      {act === 'ADD' ? 'Add Credits' : 'Deduct Credits'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Credits Amount</label>
                <input
                  id="txt-credits-adjustment-amount"
                  type="number"
                  placeholder="e.g. 500"
                  value={creditAdjustment.amount}
                  onChange={(e) => setCreditAdjustment(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full text-xs glass-input"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="flex-1 py-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 rounded-xl text-xs text-zinc-400 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-credits-adjustment-submit"
                  type="submit"
                  disabled={loading || !creditAdjustment.amount}
                  className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-semibold text-white transition flex items-center justify-center"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/75 z-40 p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-850 rounded-2xl glass-panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {editingPlan ? 'Edit Pricing Package' : 'Create Pricing Package'}
            </h3>
            
            <form onSubmit={handlePlanSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Plan Name</label>
                <input
                  id="txt-plan-name"
                  type="text"
                  placeholder="e.g. Bronze Package"
                  value={planForm.name}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs glass-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Price (INR)</label>
                <input
                  id="txt-plan-price"
                  type="number"
                  placeholder="e.g. 250"
                  value={planForm.price}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full text-xs glass-input"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Credits Included</label>
                <input
                  id="txt-plan-credits"
                  type="number"
                  placeholder="e.g. 3000"
                  value={planForm.credits}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, credits: e.target.value }))}
                  className="w-full text-xs glass-input"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="flex-1 py-2 bg-zinc-950 border border-zinc-850 hover:bg-zinc-900 rounded-xl text-xs text-zinc-400 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  id="btn-plan-submit"
                  type="submit"
                  disabled={loading || !planForm.name || !planForm.price || !planForm.credits}
                  className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-semibold text-white transition flex items-center justify-center"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
