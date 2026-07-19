'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, KeyRound, Sparkles, UserPlus, RefreshCw, LogIn, Clock, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

export default function Auth({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // States for registration progression
  const [regStep, setRegStep] = useState(1); // 1: Email, 2: Scan QR, 3: Pending Approval
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  // State for Admin TOTP Setup
  const [adminSetupQr, setAdminSetupQr] = useState('');
  const [adminSetupEmail, setAdminSetupEmail] = useState('');
  const [isAdminSetup, setIsAdminSetup] = useState(false);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !code) {
      setErrorMsg('Please fill in both email and authenticator code');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: code })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.requiresSetup) {
        // Admin first time setup required
        setAdminSetupQr(data.qrCode);
        setAdminSetupEmail(email);
        setIsAdminSetup(true);
        setCode('');
        setLoading(false);
        return;
      }

      // Success
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration Step 1: Submit Email
  const handleRegisterEmail = async (e) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Success, show QR code setup step
      setQrCodeUrl(data.qrCode);
      setRegStep(2);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin TOTP Setup Verification
  const handleAdminSetupVerify = async (e) => {
    e.preventDefault();
    if (!code) {
      setErrorMsg('Please input the code to verify');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/admin/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminSetupEmail, token: code })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Admin verification failed');
      }

      // Login success
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4 relative overflow-hidden">
      {/* Background ambient glowing shapes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900/80 rounded-2xl overflow-hidden shadow-2xl glass-panel relative z-10">
        
        {/* Main Header */}
        <div className="p-8 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25 mb-4 animate-pulse-glow">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">VEXEL AI</h1>
          <p className="text-xs text-zinc-400 mt-1">E-Commerce Product Ad Image Creator</p>
        </div>

        {/* Dynamic Navigation Panels */}
        {!isAdminSetup && regStep === 1 && (
          <div className="flex border-b border-zinc-900 px-6">
            <button
              id="tab-login"
              onClick={() => { setActiveTab('login'); setErrorMsg(''); }}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 ${
                activeTab === 'login'
                  ? 'border-violet-500 text-white font-bold'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
            <button
              id="tab-register"
              onClick={() => { setActiveTab('register'); setErrorMsg(''); }}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-2 ${
                activeTab === 'register'
                  ? 'border-violet-500 text-white font-bold'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Request Access
            </button>
          </div>
        )}

        <div className="p-8">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 bg-rose-950/20 border border-rose-900/50 rounded-xl text-rose-400 text-xs flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* ADMIN FIRST-TIME TOTP SETUP SCREEN */}
            {isAdminSetup && (
              <motion.div
                key="adminSetup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-5 text-center"
              >
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Setup Admin Authenticator</h3>
                  <p className="text-xs text-zinc-400">Scan this QR code with Google Authenticator to secure your Admin account.</p>
                </div>

                {adminSetupQr && (
                  <div className="mx-auto w-44 h-44 p-2 bg-white rounded-xl shadow-inner border border-zinc-200 flex items-center justify-center">
                    <img src={adminSetupQr} alt="Admin Setup QR Code" className="w-40 h-40" />
                  </div>
                )}

                <form onSubmit={handleAdminSetupVerify} className="space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 font-semibold flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-violet-400" /> Verify 6-Digit Code
                    </label>
                    <input
                      id="txt-admin-setup-code"
                      type="text"
                      maxLength={6}
                      placeholder="000 000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-widest text-lg font-mono glass-input py-2.5 focus:border-violet-500"
                    />
                  </div>

                  <button
                    id="btn-admin-setup-submit"
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 font-semibold text-white transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Lock Code & Login'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* LOGIN SCREEN */}
            {!isAdminSetup && activeTab === 'login' && (
              <motion.form
                key="loginForm"
                onSubmit={handleLogin}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-violet-400" /> Email Address
                  </label>
                  <input
                    id="txt-login-email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full glass-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-violet-400" /> 6-Digit Authenticator Code
                  </label>
                  <input
                    id="txt-login-code"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full tracking-widest text-center font-mono text-lg glass-input py-2.5 focus:border-violet-500"
                  />
                </div>

                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={loading || !email || code.length !== 6}
                  className="w-full mt-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 font-semibold text-white transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Log In'}
                </button>
              </motion.form>
            )}

            {/* REGISTER SCREEN - Progressing Steps */}
            {!isAdminSetup && activeTab === 'register' && (
              <motion.div
                key="registerForm"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                {regStep === 1 && (
                  <form onSubmit={handleRegisterEmail} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-400 font-semibold flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-violet-400" /> Enter Email Address
                      </label>
                      <input
                        id="txt-register-email"
                        type="email"
                        placeholder="name@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full glass-input"
                      />
                    </div>
                    <button
                      id="btn-register-submit"
                      type="submit"
                      disabled={loading || !email}
                      className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 font-semibold text-white transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Generate Authenticator Link'}
                    </button>
                  </form>
                )}

                {regStep === 2 && (
                  <div className="space-y-5 text-center">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-white">Scan Authenticator QR</h3>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Scan this QR code with Google Authenticator or Microsoft Authenticator, then click submit to register.
                      </p>
                    </div>

                    {qrCodeUrl && (
                      <div className="mx-auto w-40 h-40 p-2 bg-white rounded-xl shadow-inner border border-zinc-200 flex items-center justify-center">
                        <img src={qrCodeUrl} alt="Authenticator QR Code" className="w-36 h-36" />
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <button
                        id="btn-register-scanned"
                        onClick={() => setRegStep(3)}
                        className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 font-semibold text-white transition flex items-center justify-center gap-2"
                      >
                        I Have Scanned the Code
                      </button>
                      <button
                        onClick={() => { setRegStep(1); setQrCodeUrl(''); }}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition underline"
                      >
                        Back to edit email
                      </button>
                    </div>
                  </div>
                )}

                {regStep === 3 && (
                  <div className="space-y-5 text-center py-4">
                    <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                      <Clock className="w-7 h-7 text-amber-500 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-white">Registration Submitted!</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                        Your account request is currently **PENDING APPROVAL** by the Vexel AI administrator.
                      </p>
                    </div>
                    <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl text-left text-[11px] text-zinc-400">
                      Once the admin approves your account, you will be able to log in using the email <span className="font-semibold text-zinc-300 font-mono">{email}</span> and the 6-digit code from your authenticator.
                    </div>
                    <button
                      id="btn-registration-pending-ok"
                      onClick={() => {
                        setActiveTab('login');
                        setRegStep(1);
                        setEmail('');
                        setCode('');
                        setQrCodeUrl('');
                      }}
                      className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 text-xs font-semibold transition"
                    >
                      Back to Sign In
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
