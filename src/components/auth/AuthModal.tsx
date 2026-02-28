'use client';

import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useExtendedKyroStore } from '@/store/extendedStore';
import { X, Mail, Lock, User, Github, Chrome } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login, register } = useExtendedKyroStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'github' | 'google') => {
    try {
      const url = await invoke<string>('get_oauth_url', { provider });
      window.open(url, '_blank');
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[#c9d1d9]">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <button onClick={onClose} className="text-[#8b949e] hover:text-[#c9d1d9]">
            <X size={20} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[#f85149]/10 border border-[#f85149] text-[#f85149] px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm text-[#8b949e] mb-1">Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" size={18} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded pl-10 pr-4 py-2 text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-[#8b949e] mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded pl-10 pr-4 py-2 text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#8b949e] mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e]" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded pl-10 pr-4 py-2 text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#238636] hover:bg-[#2ea043] text-white py-2 rounded font-medium disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-[#30363d]"></div>
          <span className="px-4 text-sm text-[#8b949e]">or continue with</span>
          <div className="flex-1 border-t border-[#30363d]"></div>
        </div>

        {/* OAuth Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleOAuth('github')}
            className="flex-1 flex items-center justify-center gap-2 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] py-2 rounded hover:bg-[#30363d]"
          >
            <Github size={18} />
            GitHub
          </button>
          <button
            onClick={() => handleOAuth('google')}
            className="flex-1 flex items-center justify-center gap-2 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] py-2 rounded hover:bg-[#30363d]"
          >
            <Chrome size={18} />
            Google
          </button>
        </div>

        {/* Switch Mode */}
        <p className="text-center text-sm text-[#8b949e] mt-4">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-[#58a6ff] hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

// User Avatar Component
export function UserAvatar() {
  const { user, isAuthenticated, logout } = useExtendedKyroStore();
  const [showMenu, setShowMenu] = useState(false);

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#21262d]"
      >
        <div
          className="w-8 h-8 rounded-full bg-gradient-to-br from-[#58a6ff] to-[#a371f7] flex items-center justify-center text-white text-sm font-medium"
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm text-[#c9d1d9]">{user.name}</span>
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-1 bg-[#161b22] border border-[#30363d] rounded shadow-lg py-1 w-48 z-50">
          <div className="px-4 py-2 border-b border-[#30363d]">
            <p className="text-sm text-[#c9d1d9]">{user.name}</p>
            <p className="text-xs text-[#8b949e]">{user.email}</p>
          </div>
          <button
            onClick={() => {
              setShowMenu(false);
              logout();
            }}
            className="w-full text-left px-4 py-2 text-sm text-[#c9d1d9] hover:bg-[#21262d]"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
