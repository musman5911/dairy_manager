import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';
import { api, saveAuth } from '../api';

export default function Login({ onLogin }: { onLogin: (t: string, r: string, u: string) => void }) {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.checkSetup()
      .then((res) => {
        setIsSetup(res.setupDone);
      })
      .catch((err) => {
        console.error('Failed to check setup:', err);
        // Fallback to setup mode (false) if check fails or DB is fresh
        setIsSetup(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let res;
      if (isSetup === false) {
        res = await api.setup(username, password);
      } else {
        res = await api.login(username, password);
      }

      // Check if res and res.token exist before proceeding
      if (res && res.token) {
        saveAuth(res.token, res.role, res.username);
        onLogin(res.token, res.role, res.username);
      } else {
        setError('Login failed. Server returned an invalid response.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm flex items-center px-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center text-white text-sm shadow-inner">
            🐄
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">Usman Dairy Farm</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight uppercase tracking-wider font-medium">Management System</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 pt-20">
        <div className="w-full max-w-sm">
          {/* Welcome Text */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold mb-1">
              {isSetup === false ? 'Initial Setup' : 'Welcome back'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isSetup === false 
                ? 'Create the first administrator account to get started.' 
                : 'Please enter your details to sign in.'}
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Username Field */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-shadow dark:text-white"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Password</label>
                  {isSetup !== false && (
                  <span className="text-xs text-slate-400">Contact your admin to reset your password</span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-shadow dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-semibold mt-2 transition-colors active:scale-[0.98]"
              >
                {loading ? 'Processing...' : (isSetup === false ? 'Complete Setup' : 'Sign In')}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-xs text-slate-500 dark:text-slate-500">
          &copy; {new Date().getFullYear()} Usman Dairy Farm. All rights reserved.
        </p>
      </footer>
    </div>
  );
}