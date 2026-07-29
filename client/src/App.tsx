import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Cat,
  Droplets,
  Receipt,
  HeartPulse,
  BarChart2,
  Moon,
  Sun,
  LogOut,
  BookOpen,
  Shield,
} from "lucide-react";
import { getToken, getRole, getUsername, clearAuth } from "./api";
import { logoSpring, pillSpring, prefersReducedMotion } from "./motion";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import CowsTab from "./components/CowsTab";
import MilkTab from "./components/MilkTab";
import ExpensesTab from "./components/ExpensesTab";
import HealthTab from "./components/HealthTab";
import ReportsTab from "./components/ReportsTab";
import DiaryTab from "./components/DiaryTab";
import AdminPanel from "./components/AdminPanel";

type Tab =
  | "dashboard"
  | "cows"
  | "milk"
  | "expenses"
  | "health"
  | "diary"
  | "reports";

const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "cows", label: "Cows", icon: Cat },
  { id: "milk", label: "Milk", icon: Droplets },
  { id: "expenses", label: "Expenses", icon: Receipt },
  { id: "health", label: "Health", icon: HeartPulse },
  { id: "diary", label: "Diary", icon: BookOpen },
  { id: "reports", label: "Reports", icon: BarChart2 },
];

export default function App() {
  const [token, setToken] = useState<string | null>(getToken);
  const [role, setRole] = useState<string | null>(getRole);
  const [username, setUsername] = useState<string | null>(getUsername);
  const [dark, setDark] = useState(
    () => localStorage.getItem("dm_dark") === "true",
  );
  const [tab, setTab] = useState<Tab>("dashboard");
  const [showAdmin, setShowAdmin] = useState(false);
  const reduceMotion = prefersReducedMotion();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dm_dark", String(dark));
  }, [dark]);

  function handleLogin(t: string, r: string, u: string) {
    setToken(t);
    setRole(r);
    setUsername(u);
  }

  function handleLogout() {
    clearAuth();
    setToken(null);
    setRole(null);
    setUsername(null);
  }

  if (!token) return <Login onLogin={handleLogin} />;

  const isAdmin = role === "admin";
  const canLogDaily = isAdmin || role === "worker";
  const today = new Date().toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200 overflow-x-hidden relative"
      id="app-root"
    >
      {/* Decorative background — one-shot fade-in, no loops */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.1 }}
          className="absolute -top-28 left-1/4 w-72 h-72 rounded-full bg-teal-300/20 dark:bg-teal-600/10 blur-3xl"
        />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-emerald-300/20 dark:bg-emerald-600/10 blur-3xl"
        />
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, rotate: 0 }}
          animate={{ opacity: 1, rotate: -12 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="absolute bottom-16 left-8 text-7xl opacity-[0.06] dark:opacity-[0.08]"
        >
          🐄
        </motion.div>
      </div>

      {/* Header */}
      <motion.header
        initial={reduceMotion ? false : { y: -14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="sticky top-0 z-40 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm flex items-center px-4 sm:px-6 gap-3"
      >
        <div className="max-w-7xl w-full mx-auto flex items-center gap-2 flex-1 min-w-0">
          <motion.div
            initial={reduceMotion ? false : { x: -8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.22, ease: "easeOut", delay: 0.04 }}
            className="min-w-0"
          >
            <a
              href="https://dairyfarm--usman5911.replit.app/"
              target="_self"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <motion.img
                initial={
                  reduceMotion ? false : { rotate: -12, scale: 0.7, opacity: 0 }
                }
                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                whileHover={{ rotate: -6, scale: 1.08 }}
                transition={logoSpring}
                src="/dairy-farm-logo-round-512.png"
                alt="Usman Dairy Farm logo"
                className="w-9 h-9 rounded-full object-cover border border-emerald-100 dark:border-emerald-900 bg-white shrink-0 shadow-sm"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight truncate text-slate-900 dark:text-white">
                  Usman Dairy Farm
                </p>
                <p className="hidden sm:block text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Farm Management System
                </p>
              </div>
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={reduceMotion ? false : { x: 8, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.22, ease: "easeOut", delay: 0.08 }}
          className="flex items-center gap-2 shrink-0"
        >
          <span className="hidden md:flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
            📅 {today}
          </span>

          <motion.button
            whileHover={{ rotate: 12 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setDark((d) => !d)}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </motion.button>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            {/* Admin: clickable Admin button only */}
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowAdmin(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-700 text-white hover:bg-green-800 border border-green-800 transition shadow-sm"
                title="Admin panel"
              >
                <Shield className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold uppercase">Admin</span>
              </motion.button>
            )}
            {/* Worker: badge only, not clickable */}
            {!isAdmin && (
              <span className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-full capitalize">
                Worker
              </span>
            )}
            <motion.button
              whileHover={{ scale: 1.08, rotate: -6 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-500 transition"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </motion.div>
      </motion.header>

      {/* Tab Nav */}
      <motion.nav
        initial={reduceMotion ? false : { y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: "easeOut", delay: 0.06 }}
        className="sticky top-14 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-2 sm:px-4 flex gap-0.5 overflow-x-auto no-scrollbar">
          {NAV.map(({ id, label, icon: Icon }, index) => (
            <motion.button
              key={id}
              initial={reduceMotion ? false : { y: -4, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 0.18,
                ease: "easeOut",
                delay: 0.08 + index * 0.02,
              }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setTab(id)}
              className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 -mb-px transition-colors cursor-pointer ${
                tab === id
                  ? "border-transparent text-green-700 dark:text-green-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 transition-transform ${tab === id ? "scale-110" : ""}`}
              />
              <span>{label}</span>
              {tab === id && (
                <motion.span
                  layoutId="nav-active-pill"
                  transition={pillSpring}
                  className="absolute inset-x-2 -bottom-0.5 h-0.5 bg-gradient-to-r from-green-500 to-teal-500 rounded-full"
                />
              )}
            </motion.button>
          ))}
        </div>
      </motion.nav>

      {/* Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 relative z-10">
        <AnimatePresence mode="wait">
          <motion.main
            key={tab}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-3.5 sm:p-6 min-h-[60vh]"
          >
            {tab === "dashboard" && (
              <Dashboard
                isAdmin={isAdmin}
                onNavigate={setTab as (t: string) => void}
              />
            )}
            {tab === "cows" && <CowsTab isAdmin={isAdmin} />}
            {tab === "milk" && (
              <MilkTab isAdmin={canLogDaily} canDelete={isAdmin} />
            )}
            {tab === "expenses" && (
              <ExpensesTab isAdmin={canLogDaily} canDelete={isAdmin} />
            )}
            {tab === "health" && (
              <HealthTab isAdmin={canLogDaily} canDelete={isAdmin} />
            )}
            {tab === "diary" && <DiaryTab />}
            {tab === "reports" && <ReportsTab />}
          </motion.main>
        </AnimatePresence>
      </div>

      <footer className="bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 py-3 px-6 text-[11px] font-mono text-slate-400 flex justify-between items-center animate-fade-in relative z-10">
        <span>Usman Dairy Farm © {new Date().getFullYear()}</span>
        <span className="capitalize">{role} mode</span>
      </footer>

      {/* Admin Panel Popup */}
      <AnimatePresence>
        {showAdmin && (
          <AdminPanel username={username} onClose={() => setShowAdmin(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
