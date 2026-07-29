import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, Lock, User, AlertCircle, ArrowLeft,
  Mail, KeyRound, Check, LogIn,
} from 'lucide-react';
import { api, saveAuth } from '../api';
import { authCardSpring, prefersReducedMotion } from '../motion';

type View = 'login' | 'forgotEmail' | 'forgotCode';

export default function Login({ onLogin }: { onLogin: (t: string, r: string, u: string) => void }) {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);
  const [view, setView] = useState<View>('login');
  const [mailConfigured, setMailConfigured] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  const reduceMotion = prefersReducedMotion();
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.checkSetup()
      .then((res) => setIsSetup(res.setupDone))
      .catch((err) => {
        console.error('Failed to check setup:', err);
        setIsSetup(false);
      });

    api.getMailStatus()
      .then((res) => setMailConfigured(Boolean(res.configured)))
      .catch(() => setMailConfigured(false));
  }, []);

  const clearMessages = () => {
    setError('');
    setInfo('');
  };

  const goTo = (nextView: View) => {
    clearMessages();
    setView(nextView);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const res = isSetup === false
        ? await api.setup(username, password, email || undefined)
        : await api.login(username, password);

      if (res?.token) {
        saveAuth(res.token, res.role, res.username);
        onLogin(res.token, res.role, res.username);
      } else {
        setError('Login failed. Server returned an invalid response.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    if (!resetEmail.trim()) {
      setError('Enter your admin email.');
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(resetEmail.trim().toLowerCase());
      setInfo('If an active admin account exists with that email, a 6-digit reset code has been sent.');
      setResetCode('');
      setResetPassword('');
      setView('forgotCode');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    clearMessages();
    const cleanCode = resetCode.replace(/\D/g, '');
    if (cleanCode.length !== 6 || !resetPassword) {
      setError('Enter the 6-digit code and a new password.');
      return;
    }
    if (resetPassword.length < 4) {
      setError('New password must be at least 4 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(resetEmail.trim().toLowerCase(), cleanCode, resetPassword);
      setInfo('Password reset successfully. You can now sign in.');
      setPassword('');
      setUsername(resetEmail.trim().toLowerCase());
      setResetCode('');
      setResetPassword('');
      setView('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (isSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  const isFirstSetup = isSetup === false;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-teal-50 via-slate-50 to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, rotate: 0 }}
          animate={{ opacity: 1, rotate: 12 }}
          transition={{ duration: 1, delay: 0.1 }}
          className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-teal-300/20 dark:bg-teal-600/10 blur-3xl"
        />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, rotate: 0 }}
          animate={{ opacity: 1, rotate: -12 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute bottom-8 -right-16 w-72 h-72 rounded-full bg-emerald-300/20 dark:bg-emerald-600/10 blur-3xl"
        />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, rotate: 0 }}
          animate={{ opacity: 0.3, rotate: 45 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="absolute top-1/4 right-10 text-6xl"
        >
          🐄
        </motion.div>
      </div>

      <motion.header
        initial={reduceMotion ? false : { y: -14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm flex items-center px-4 z-10"
      >
        <div className="flex items-center gap-3">
          <img
  src="/dairy-farm-logo-round-512.png"
  alt="Usman Dairy Farm logo"
  className="w-9 h-9 rounded-full object-cover border border-emerald-100 dark:border-emerald-900 bg-white shadow-inner"
/>
          <div>
            <h1 className="text-sm font-bold leading-tight">Usman Dairy Farm</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight uppercase tracking-wider font-medium">Management System</p>
          </div>
        </div>
      </motion.header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 pt-20">
        <motion.div
          initial={reduceMotion ? false : { y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={authCardSpring}
          className="w-full max-w-sm relative z-10"
        >
          <div className="mb-6 text-center">
            <motion.h2
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut', delay: 0.3 }}
              className="text-xl font-bold mb-1"
            >
              {isFirstSetup ? 'Initial Setup' : view === 'login' ? 'Welcome back' : view === 'forgotEmail' ? 'Reset password' : 'Enter verification code'}
            </motion.h2>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.4 }}
              className="text-sm text-slate-500 dark:text-slate-400"
            >
              {isFirstSetup
                ? 'Create the first administrator account to get started.'
                : view === 'login'
                  ? 'Please enter your details to sign in.'
                  : view === 'forgotEmail'
                    ? 'Enter your admin email to receive a 6-digit code.'
                    : `A reset code was sent to ${resetEmail}.`}
            </motion.p>
          </div>

          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl shadow-emerald-900/10 overflow-hidden">
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-600 p-7 text-center text-white">
              <motion.div
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.1 }}
                className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-xl"
              />
              <motion.div
                initial={reduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                className="relative mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 p-1.5 shadow-lg"
              >
  <img
    src="/dairy-farm-logo-round-512.png"
    alt="Usman Dairy Farm logo"
    className="h-full w-full rounded-full object-cover bg-white"
  />
</motion.div>
              <h1 className="relative font-display text-2xl font-bold tracking-tight">Usman Dairy Farm</h1>
              <p className="relative mt-1 text-sm text-emerald-50">Dairy Management</p>
            </div>
            <div className="p-6">
            {error && <Message type="error" text={error} />}
            {info && <Message type="success" text={info} />}

            <AnimatePresence mode="wait" initial={false}>
            {view === 'login' && (
              <motion.form
                key="login"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
                onSubmit={handleSubmit}
              >
                <Field label={isFirstSetup ? 'Username' : 'Username or email'}>
                  <IconInput icon={<User className="h-4 w-4" />}>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder={isFirstSetup ? 'Enter your username' : 'Username or email'}
                      autoComplete="username"
                      className="input-shell pl-9 pr-3"
                    />
                  </IconInput>
                </Field>

                {isFirstSetup && (
                  <Field label="Admin email for password reset">
                    <IconInput icon={<Mail className="h-4 w-4" />}>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="admin@farm.com"
                        autoComplete="email"
                        className="input-shell pl-9 pr-3"
                      />
                    </IconInput>
                  </Field>
                )}

                <Field label="Password" right={!isFirstSetup ? (
                  <button
                    type="button"
                    onClick={() => goTo('forgotEmail')}
                    title={mailConfigured ? 'Reset password by email' : 'SMTP is not configured yet'}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 font-semibold inline-flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Forgot password?
                  </button>
                ) : null}>
                  <IconInput icon={<Lock className="h-4 w-4" />}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      autoComplete={isFirstSetup ? 'new-password' : 'current-password'}
                      className="input-shell pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </IconInput>
                </Field>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-semibold mt-2 transition shadow-lg shadow-teal-500/20 active:scale-[0.98] inline-flex items-center justify-center gap-2"
                >
                  {loading ? 'Processing...' : <><LogIn className="w-4 h-4" />{isFirstSetup ? 'Complete Setup' : 'Sign In'}</>}
                </button>
              </motion.form>
            )}

            {view === 'forgotEmail' && (
              <motion.form
                key="forgotEmail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
                onSubmit={handleForgotRequest}
              >
                <BackButton onClick={() => goTo('login')} />
                {!mailConfigured && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs p-3">
                    SMTP email is not configured yet. Add SMTP settings in backend/.env to send reset codes.
                  </div>
                )}
                <Field label="Admin email">
                  <IconInput icon={<Mail className="h-4 w-4" />}>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      placeholder="admin@farm.com"
                      className="input-shell pl-9 pr-3"
                    />
                  </IconInput>
                </Field>
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2">
                  {loading ? 'Sending...' : <><Mail className="w-4 h-4" /> Send reset code</>}
                </button>
              </motion.form>
            )}

            {view === 'forgotCode' && (
              <motion.form
                key="forgotCode"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
                onSubmit={handleResetPassword}
              >
                <BackButton onClick={() => goTo('forgotEmail')} />
                <Field label="6-digit code">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoFocus
                    value={resetCode}
                    onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="input-shell text-center tracking-[0.45em] font-mono text-lg"
                  />
                </Field>
                <Field label="New password">
                  <IconInput icon={<Lock className="h-4 w-4" />}>
                    <input
                      type="password"
                      required
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                      placeholder="New password"
                      autoComplete="new-password"
                      className="input-shell pl-9 pr-3"
                    />
                  </IconInput>
                </Field>
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2">
                  {loading ? 'Resetting...' : <><Check className="w-4 h-4" /> Reset password</>}
                </button>
              </motion.form>
            )}
            </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </main>

      <footer className="py-6 text-center relative z-10">
        <p className="text-xs text-slate-500 dark:text-slate-500">&copy; {new Date().getFullYear()} Usman Dairy Farm. All rights reserved.</p>
      </footer>
    </div>
  );
}

function Field({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">{label}</label>
        {right}
      </div>
      {children}
    </div>
  );
}

function IconInput({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">{icon}</div>
      {children}
    </div>
  );
}

function Message({ type, text }: { type: 'error' | 'success'; text: string }) {
  const isError = type === 'error';
  return (
    <div className={`mb-4 rounded-xl p-3 flex items-start gap-2 text-sm border ${
      isError
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
        : 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300'
    }`}>
      {isError ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <Check className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{text}</span>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-300">
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );
}
