'use client';

import React, { useState, useEffect } from 'react';
import Wizard from '../components/Wizard';
import Auth from '../components/Auth';
import UserApp from '../components/UserApp';
import AdminApp from '../components/AdminApp';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  // Check initial app settings and login token
  useEffect(() => {
    async function initApp() {
      try {
        // 1. Check if Electron settings indicate installation
        if (window.electronAPI) {
          const settings = await window.electronAPI.loadSettings();
          if (settings && settings.isInstalled) {
            setIsInstalled(true);
          } else {
            setIsInstalled(false);
          }
        } else {
          // Browser environment fallback (defaults to installed for local dev preview)
          const localInstalled = localStorage.getItem('vexel_installed');
          if (localInstalled === 'true') {
            setIsInstalled(true);
          } else {
            setIsInstalled(false);
          }
        }

        // 2. Check if user is already logged in
        const storedToken = localStorage.getItem('vexel_auth_token');
        const storedUser = localStorage.getItem('vexel_auth_user');

        if (storedToken && storedUser) {
          // Validate structure
          const parsedUser = JSON.parse(storedUser);
          
          // Verify if token is still valid with a simple ping to the profile endpoint
          const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          
          if (res.ok) {
            setToken(storedToken);
            setUser(parsedUser);
          } else {
            // Token expired, clear
            localStorage.removeItem('vexel_auth_token');
            localStorage.removeItem('vexel_auth_user');
          }
        }
      } catch (err) {
        console.error('Failed to initialize Vexel workspace setup:', err);
      } finally {
        setLoading(false);
      }
    }

    initApp();
  }, []);

  const handleInstallationFinished = () => {
    setIsInstalled(true);
    localStorage.setItem('vexel_installed', 'true');
  };

  const handleLoginSuccess = (userToken, userInfo) => {
    setToken(userToken);
    setUser(userInfo);
    localStorage.setItem('vexel_auth_token', userToken);
    localStorage.setItem('vexel_auth_user', JSON.stringify(userInfo));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('vexel_auth_token');
    localStorage.removeItem('vexel_auth_user');
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-violet-600" />
        <div className="text-zinc-500 text-xs font-mono">Initializing workspace panel...</div>
      </div>
    );
  }

  // 1. Show Installation Wizard if not installed
  if (!isInstalled) {
    return <Wizard onFinished={handleInstallationFinished} />;
  }

  // 2. Show Auth screen if not authenticated
  if (!token || !user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. Admin App Panel
  if (user.role === 'ADMIN') {
    return <AdminApp token={token} user={user} onLogout={handleLogout} />;
  }

  // 4. Default User Panel
  return <UserApp token={token} user={user} onLogout={handleLogout} />;
}
