'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, KeyRound, Sparkles, UserPlus, RefreshCw, LogIn, Clock, AlertTriangle, QrCode } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

export default function Auth({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // States for registration progression
  const [regStep, setRegStep] = useState(1); // 1: Email Request, 2: Scan QR, 3: Pending Approval
  const [tempSecret, setTempSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !code) {
      setErrorMsg('Please enter both email and your 6-digit Authenticator code');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Success
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration Step 1: Submit Email to get TOTP Secret
  const handleRegisterInit = async (e) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your email address');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize registration');
      }

      setTempSecret(data.secret);
      setQrCodeUrl(data.qrCodeUrl);
      setRegStep(2); // Go to Scan QR step
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration Step 2: Verify TOTP Code and complete signup
  const handleRegisterVerify = async (e) => {
    e.preventDefault();
    if (!code) {
      setErrorMsg('Please enter the 6-digit code from Google Authenticator');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, secret: tempSecret, code })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify Authenticator code');
      }

      setRegStep(3); // Go to Pending Approval step
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
        {regStep === 1 && (
          <div className="flex border-b border-zinc-900 px-6">
            <button
              id="tab-login"
              onClick={() => { setActiveTab('login'); setErrorMsg(''); setCode(''); }}
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
              onClick={() => { setActiveTab('register'); setErrorMsg(''); setCode(''); }}
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
            {/* LOGIN SCREEN */}
            {activeTab === 'login' && (
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
                    <KeyRound className="w-3.5 h-3.5 text-violet-400" /> 6-Digit Authentication Code
                  </label>
                  <input
                    id="txt-login-code"
                    type="text"
                    placeholder="000000"
                    value={code}
                    maxLength={6}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full glass-input tracking-widest text-center text-lg font-mono font-bold"
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
            {activeTab === 'register' && (
              <motion.div
                key="registerForm"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                {regStep === 1 && (
                  <form onSubmit={handleRegisterInit} className="space-y-4">
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
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Request Access'}
                    </button>
                  </form>
                )}

                {regStep === 2 && (
                  <form onSubmit={handleRegisterVerify} className="space-y-5 text-center">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                        <QrCode className="w-4 h-4 text-violet-400" /> Setup Authenticator
                      </h3>
                      <p className="text-[10px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                        Scan the QR code below inside your Google Authenticator app to connect your Vexel account.
                      </p>
                    </div>

                    <div className="relative inline-block mx-auto rounded-2xl overflow-hidden border border-zinc-800 bg-white p-2">
                      <img src={qrCodeUrl} className="w-44 h-44" alt="Google Authenticator Setup QR" />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-xs text-zinc-400 font-semibold flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-violet-400" /> Enter Setup 6-Digit Code
                      </label>
                      <input
                        id="txt-register-code"
                        type="text"
                        placeholder="000000"
                        value={code}
                        maxLength={6}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full glass-input tracking-widest text-center text-lg font-mono font-bold"
                      />
                    </div>

                    <button
                      id="btn-verify-setup"
                      type="submit"
                      disabled={loading || code.length !== 6}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 font-semibold text-white transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify and Submit'}
                    </button>
                  </form>
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
                      Once the admin approves your account, you will be able to log in using the email <span className="font-semibold text-zinc-300 font-mono">{email}</span> and your Google Authenticator code.
                    </div>
                    <button
                      id="btn-registration-pending-ok"
                      onClick={() => {
                        setActiveTab('login');
                        setRegStep(1);
                        setEmail('');
                        setCode('');
                        setTempSecret('');
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
