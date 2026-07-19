'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, FolderOpen, ArrowRight, ShieldCheck, Check, Settings2, Loader2, AlertCircle } from 'lucide-react';

export default function Wizard({ onFinished }) {
  const [step, setStep] = useState(1); // 1: Welcome, 2: License, 3: Paths & Disk Check, 4: Installing, 5: Finish
  const [licenseAccepted, setLicenseAccepted] = useState(false);
  const [installPath, setInstallPath] = useState('');
  const [zipPath, setZipPath] = useState('D:\\VEXEL ZIPs');
  
  const [diskSpace, setDiskSpace] = useState(null);
  const [checkingDisk, setCheckingDisk] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatus, setInstallStatus] = useState('Preparing setup files...');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch initial paths
  useEffect(() => {
    async function loadPaths() {
      if (window.electronAPI) {
        const settings = await window.electronAPI.loadSettings();
        if (settings) {
          setInstallPath(settings.softwarePath || 'C:\\Program Files\\Vexel AI');
          setZipPath(settings.zipStoragePath || 'D:\\VEXEL ZIPs');
        }
      } else {
        setInstallPath('C:\\Program Files\\Vexel AI');
        setZipPath('C:\\VEXEL ZIPs'); // fallback
      }
    }
    loadPaths();
  }, []);

  // Check Disk Space
  const handleCheckDisk = async () => {
    setCheckingDisk(true);
    setErrorMsg('');
    try {
      if (window.electronAPI) {
        const space = await window.electronAPI.checkDiskSpace({
          softwarePath: installPath,
          zipPath: zipPath
        });
        setDiskSpace(space);
      } else {
        // Mock disk check for browser development fallback
        setTimeout(() => {
          setDiskSpace({
            software: { drive: 'C:', freeBytes: 15 * 1024 * 1024 * 1024, isSufficient: true },
            zip: { drive: 'D:', freeBytes: 8 * 1024 * 1024 * 1024, isSufficient: true }
          });
        }, 1000);
      }
    } catch (err) {
      setErrorMsg('Failed to check disk volumes. Please verify paths.');
    } finally {
      setCheckingDisk(false);
    }
  };

  useEffect(() => {
    if (step === 3) {
      handleCheckDisk();
    }
  }, [step]);

  // Browse Install Path
  const browseInstallPath = async () => {
    if (!window.electronAPI) return;
    const folder = await window.electronAPI.selectFolder(installPath);
    if (folder) {
      setInstallPath(folder);
      setDiskSpace(null); // re-verify
    }
  };

  // Browse ZIP Path
  const browseZipPath = async () => {
    if (!window.electronAPI) return;
    const folder = await window.electronAPI.selectFolder(zipPath);
    if (folder) {
      setZipPath(folder);
      setDiskSpace(null); // re-verify
    }
  };

  // Run Install Simulation
  const startInstallation = () => {
    setStep(4);
    const statuses = [
      { progress: 10, status: 'Copying application binaries...' },
      { progress: 30, status: 'Extracting libraries & models...' },
      { progress: 50, status: 'Initializing localized SQLite configurations...' },
      { progress: 70, status: 'Connecting local databases & dependencies...' },
      { progress: 85, status: 'Setting up system paths and folders...' },
      { progress: 95, status: 'Finalizing installation workspace...' },
      { progress: 100, status: 'Installation completed!' }
    ];

    let currentIdx = 0;
    const timer = setInterval(() => {
      if (currentIdx < statuses.length) {
        setInstallProgress(statuses[currentIdx].progress);
        setInstallStatus(statuses[currentIdx].status);
        currentIdx++;
      } else {
        clearInterval(timer);
        setStep(5);
      }
    }, 1200);
  };

  // Finish installation
  const handleFinish = async () => {
    const finalSettings = {
      softwarePath: installPath,
      zipStoragePath: zipPath,
      isInstalled: true
    };

    if (window.electronAPI) {
      await window.electronAPI.saveSettings(finalSettings);
    }

    // Hit server settings update API to ensure the server knows the ZIP path
    try {
      const { API_BASE_URL } = require('../utils/api');
      await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipStoragePath: zipPath })
      });
    } catch (e) {
      console.warn('Could not update backend zip path settings directly:', e);
    }

    onFinished();
  };

  const formattedGb = (bytes) => (bytes / (1024 * 1024 * 1024)).toFixed(2);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm z-50 p-4">
      <div 
        id="wizard-container" 
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl glass-panel flex flex-col min-h-[500px]"
      >
        {/* Top Header */}
        <div className="bg-gradient-to-r from-violet-900/40 to-indigo-900/40 p-6 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">Vexel AI Setup</h2>
              <p className="text-xs text-zinc-400">Desktop SaaS Installation Assistant</p>
            </div>
          </div>
          <div className="text-xs font-mono px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-violet-400">
            v1.0.0
          </div>
        </div>

        {/* Wizard View Body */}
        <div className="flex-1 p-8 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Welcome to VEXEL AI</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Vexel AI is a state-of-the-art Windows Desktop SaaS application built for eCommerce sellers. Generate premium advertising background images for your products in seconds.
                  </p>
                </div>
                <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl space-y-3">
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Prerequisites</h4>
                  <ul className="text-xs text-zinc-400 space-y-2">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500" /> Active Internet Connection (API Access)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500" /> Secure Access Key (configured with administrator)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500" /> Transparent PNG product images (1000x1000 pixels preferred)
                    </li>
                  </ul>
                </div>
                <div className="flex justify-end pt-4">
                  <button
                    id="btn-welcome-next"
                    onClick={() => setStep(2)}
                    className="px-6 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 active:bg-violet-700 transition flex items-center gap-2 shadow-lg shadow-violet-600/30"
                  >
                    Get Started <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-xl font-bold text-white">License Agreement</h3>
                <div className="h-48 overflow-y-auto p-4 bg-zinc-950 border border-zinc-850 rounded-xl text-xs text-zinc-400 space-y-3 leading-relaxed">
                  <p className="font-semibold text-zinc-300">END USER LICENSE AGREEMENT (EULA)</p>
                  <p>
                    Please read this End User License Agreement carefully before clicking the Accept button. By downloading, installing, or using Vexel AI, you are agreeing to be bound by the terms and conditions of this Agreement.
                  </p>
                  <p>
                    1. <strong>License Grant</strong>: Vexel AI grants you a personal, non-transferable, non-exclusive license to use the Software solely for e-commerce advertising generation.
                  </p>
                  <p>
                    2. <strong>Credits Wallet</strong>: Each generated image deducts 2 Credits from your balance. Credits are purchased via Razorpay and are non-refundable.
                  </p>
                  <p>
                    3. <strong>Restrictions</strong>: You agree not to decompile, reverse engineer, modify, or distribute the binary files of the desktop framework.
                  </p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer py-2">
                  <input
                    id="chk-accept-license"
                    type="checkbox"
                    checked={licenseAccepted}
                    onChange={(e) => setLicenseAccepted(e.target.checked)}
                    className="w-4.5 h-4.5 accent-violet-600 rounded cursor-pointer"
                  />
                  <span className="text-sm text-zinc-300 select-none">I accept all terms and conditions of the license agreement</span>
                </label>
                <div className="flex justify-between pt-4 border-t border-zinc-900">
                  <button
                    onClick={() => setStep(1)}
                    className="px-5 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-900 transition"
                  >
                    Back
                  </button>
                  <button
                    id="btn-license-next"
                    disabled={!licenseAccepted}
                    onClick={() => setStep(3)}
                    className="px-6 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-2 shadow-lg shadow-violet-600/30"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="text-xl font-bold text-white">Configure Image Export Storage</h3>
                <div className="space-y-3">
                  {/* ZIP folder path */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 font-medium">ZIP Export Storage Directory</label>
                    <div className="flex gap-2">
                      <input
                        id="txt-zip-path"
                        type="text"
                        value={zipPath}
                        onChange={(e) => { setZipPath(e.target.value); setDiskSpace(null); }}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-600"
                      />
                      <button
                        onClick={browseZipPath}
                        className="px-3 py-2 bg-zinc-900 border border-zinc-850 hover:border-zinc-700 rounded-xl text-zinc-300 flex items-center gap-1.5 transition text-sm"
                      >
                        <FolderOpen className="w-4 h-4 text-violet-400" /> Browse
                      </button>
                    </div>
                  </div>
                </div>

                {/* Disk Space Check Status */}
                <div className="mt-4 p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-violet-400" /> Storage Verification
                    </span>
                    <button
                      onClick={handleCheckDisk}
                      disabled={checkingDisk}
                      className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1"
                    >
                      {checkingDisk && <Loader2 className="w-3 h-3 animate-spin" />} Re-Verify
                    </button>
                  </div>

                  {checkingDisk ? (
                    <div className="py-4 flex flex-col items-center justify-center gap-2 text-sm text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                      Scanning local volume capacities...
                    </div>
                  ) : diskSpace ? (
                    <div className="grid grid-cols-1 gap-4">
                      {/* ZIP location storage */}
                      <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-850 space-y-1">
                        <div className="text-xs text-zinc-400 font-semibold">ZIP Drive ({diskSpace.zip.drive})</div>
                        <div className="text-lg font-bold text-white">
                          {diskSpace.zip.freeBytes ? `${formattedGb(diskSpace.zip.freeBytes)} GB Free` : 'N/A'}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          {diskSpace.zip.isSufficient ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-[10px] text-emerald-400 font-medium">5GB Min Met</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 rounded-full bg-rose-500" />
                              <span className="text-[10px] text-rose-400 font-medium">Insufficient (Needs 5GB)</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : errorMsg ? (
                    <div className="p-3 bg-rose-950/20 border border-rose-900/50 rounded-lg flex items-center gap-2 text-rose-400 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-between pt-4 border-t border-zinc-900">
                  <button
                    onClick={() => setStep(2)}
                    className="px-5 py-2 rounded-xl border border-zinc-800 text-zinc-400 hover:bg-zinc-900 transition"
                  >
                    Back
                  </button>
                  <button
                    id="btn-paths-next"
                    disabled={!diskSpace || !diskSpace.zip.isSufficient}
                    onClick={startInstallation}
                    className="px-6 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 active:bg-violet-700 disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-2 shadow-lg shadow-violet-600/30"
                  >
                    Install Now <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 text-center py-6"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white">Installing Vexel AI...</h3>
                  <p className="text-xs text-zinc-400">{installStatus}</p>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50 p-0.5">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full shadow-inner"
                    style={{ width: `${installProgress}%` }}
                    layoutId="progress"
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                
                <div className="text-xs font-mono text-violet-400 font-bold">{installProgress}%</div>

                <div className="text-[10px] text-zinc-500">
                  Please do not close this installer assistant during this process.
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 text-center py-4"
              >
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-pulse-glow">
                  <ShieldCheck className="w-8 h-8 text-emerald-500 animate-bounce" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Setup Completed Successfully!</h3>
                  <p className="text-sm text-zinc-400">
                    Vexel AI is fully configured on your local drive and ready for use.
                  </p>
                </div>
                <div className="mx-auto max-w-sm p-4 bg-zinc-900/40 border border-zinc-850 rounded-xl text-left text-xs space-y-1.5">
                  <div className="text-zinc-500 uppercase tracking-wider font-semibold text-[9px]">Configuration Logs</div>
                  <div className="text-zinc-300">Software directory: <span className="font-mono text-zinc-400">{installPath}</span></div>
                  <div className="text-zinc-300">ZIP storage: <span className="font-mono text-zinc-400">{zipPath}</span></div>
                </div>
                <div className="pt-2">
                  <button
                    id="btn-wizard-finish"
                    onClick={handleFinish}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:from-violet-500 hover:to-indigo-500 active:scale-95 transition-all shadow-lg shadow-violet-600/30"
                  >
                    Launch Vexel AI
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
