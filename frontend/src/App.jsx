import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Radio, ClipboardList, Settings, Archive, ChevronLeft, ChevronRight, LogOut, User, FileText, Sun, Moon } from 'lucide-react';

import Scanner from './pages/Scanner';
import Projects from './pages/Projects';
import ProjectLogs from './pages/ProjectLogs';
import PMStation from './pages/PMStation';
import ProjectDetails from './pages/ProjectDetails';
import Archives from './pages/Archives';
import Login from './pages/Login';
import SettingsPage from './pages/Settings';
import Reports from './pages/Reports';
import AiChat from './components/ui/AiChat';

import { ToastProvider } from './context/ToastContext';
import { ProjectsProvider } from './context/ProjectsContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

// Protected Route Component
function ProtectedRoute({ children, requiredRole }) {
  const { isLoggedIn, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400 font-mono">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return children;
}

function NavLink({ to, icon: Icon, label, isCollapsed }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  return (
    <Link to={to} title={isCollapsed ? label : ""} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-bold text-sm ${isActive ? 'bg-gray-100 text-black' : 'text-gray-500 hover:bg-gray-50 hover:text-black'} ${isCollapsed ? 'justify-center px-2' : ''}`}>
      <Icon size={20} className={isActive ? "text-black" : "text-gray-400"} />
      {!isCollapsed && <span>{label}</span>}
    </Link>
  );
}

function AppLayout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user, logout, canAccessSettings } = useAuth();

  // Auto-collapse sidebar on narrow screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    handleResize(); // Run on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-100 text-purple-700';
      case 'internal': return 'bg-blue-100 text-blue-700';
      case 'shopline': return 'bg-green-100 text-green-700';
      case 'merchant': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-white border-r border-gray-200 flex flex-col fixed h-full z-10 transition-all duration-300 ease-in-out`}>
        <div className="p-6 border-b border-gray-100 flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold shrink-0">A</div>
          {!isCollapsed && <span className="font-black text-xl tracking-tight whitespace-nowrap">Alien Portal</span>}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavLink to="/projects" icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} />
          <NavLink to="/pm" icon={ClipboardList} label="PM Station" isCollapsed={isCollapsed} />
          <NavLink to="/scanner" icon={Radio} label="Scanner" isCollapsed={isCollapsed} />
          {canAccessSettings() && (
            <NavLink to="/reports" icon={FileText} label="Reports" isCollapsed={isCollapsed} />
          )}
          <div className="pt-4 mt-4 border-t border-gray-100">
            <NavLink to="/archives" icon={Archive} label="Archives" isCollapsed={isCollapsed} />
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100">
          {/* Settings - Only for superadmin */}
          {canAccessSettings() && (
            <NavLink to="/settings" icon={Settings} label="Settings" isCollapsed={isCollapsed} />
          )}

          {/* User Info */}
          {user && !isCollapsed && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <User size={14} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{user.display_name || 'User'}</div>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:text-red-600 py-2 transition"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}

          {isCollapsed && user && (
            <button onClick={logout} title="Sign Out" className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-red-500 transition mt-2">
              <LogOut size={18} />
            </button>
          )}

          {/* Theme Toggle */}
          <ThemeToggle isCollapsed={isCollapsed} />

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="mt-2 w-full flex items-center justify-center p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-black transition"
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      <main className={`flex-1 transition-all duration-300 ease-in-out ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        {children}
      </main>

      {/* AI Chat Assistant - only for internal users */}
      <AiChat userRole={user?.role} />
    </div>
  );
}

function AppRoutes() {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-pulse text-gray-400 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={isLoggedIn ? <Navigate to="/projects" replace /> : <Login />} />

      {/* Protected Routes */}
      <Route path="/" element={<ProtectedRoute><AppLayout><Projects /></AppLayout></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><AppLayout><Projects /></AppLayout></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><AppLayout><ProjectDetails /></AppLayout></ProtectedRoute>} />
      <Route path="/projects/:id/logs" element={<ProtectedRoute><AppLayout><ProjectLogs /></AppLayout></ProtectedRoute>} />
      <Route path="/pm" element={<ProtectedRoute><AppLayout><PMStation /></AppLayout></ProtectedRoute>} />
      <Route path="/scanner" element={<ProtectedRoute><AppLayout><Scanner /></AppLayout></ProtectedRoute>} />
      <Route path="/archives" element={<ProtectedRoute><AppLayout><Archives /></AppLayout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute requiredRole="superadmin"><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />

      {/* Catch all - redirect to projects */}
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}

function ThemeToggle({ isCollapsed }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`mt-2 w-full flex items-center p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-black transition ${isCollapsed ? 'justify-center' : 'gap-2 px-4'}`}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      {!isCollapsed && <span className="text-sm font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
    </button>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <ProjectsProvider>
              <AppRoutes />
            </ProjectsProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}