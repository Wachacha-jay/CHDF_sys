import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings, User, LogOut, Sun, Moon, Bell, Menu, Package, Heart, Info, CheckCircle } from 'lucide-react';
import { useAuthContext } from '../../contexts/useAuthContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { NotificationService, Notification } from '../../services/notificationService';
import { formatDistanceToNow } from 'date-fns';

interface TopBarProps {
  onMenuClick: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuthContext();
  const { settings } = useSettingsContext();
  const navigate = useNavigate();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [time, setTime] = useState(new Date());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    loadNotifications();
    const notifTimer = setInterval(loadNotifications, 5 * 60 * 1000);
    return () => {
      clearInterval(timer);
      clearInterval(notifTimer);
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await NotificationService.getNotifications();
      setNotifications(data);
      setUnread(data.length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notifRef.current && !notifRef.current.contains(event.target as Node) &&
        userRef.current && !userRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNotificationsClick = () => {
    setShowNotifications((s) => !s);
    setUnread(0);
  };

  return (
    <header className="w-full h-18 flex items-center justify-between px-4 lg:px-6 bg-slate-800 border-b border-slate-900 shadow-sm z-10 sticky top-0" style={{height: '72px'}}>
      <div className="flex items-center space-x-2 lg:space-x-4">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 lg:hidden transition-colors"
          aria-label="Toggle Menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="flex items-center space-x-2">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={settings.business_name} className="h-8 w-auto lg:h-10 select-none rounded" />
          ) : (
            <div className="h-8 w-8 lg:h-10 lg:w-10 bg-indigo-600 rounded flex items-center justify-center font-bold text-white">
              {settings?.business_name?.charAt(0) || 'B'}
            </div>
          )}
          <span className="hidden sm:inline text-base lg:text-lg font-bold text-slate-100 truncate max-w-[120px] lg:max-w-[200px]">
            {settings?.business_name || 'BizManager'}
          </span>
        </div>
        
        <Link to="/settings" className="text-gray-400 hover:text-indigo-400 transition-colors hidden sm:block">
          <Settings className="w-5 h-5" />
        </Link>
      </div>

      <div className="flex items-center space-x-6">
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleNotificationsClick}
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-6 h-6 text-gray-300" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full animate-pulse">
                {unread}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-5 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                <span className="font-bold text-gray-100">Notifications</span>
                <button 
                  onClick={() => setUnread(0)}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
                >
                  Mark all as read
                </button>
              </div>
              <ul className="max-h-[400px] overflow-y-auto divide-y divide-gray-800">
                {notifications.length === 0 ? (
                  <li className="px-6 py-8 text-center">
                    <CheckCircle className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">All caught up!</p>
                  </li>
                ) : (
                  notifications.map((n) => (
                    <li 
                      key={n.id} 
                      onClick={() => {
                        if (n.link) navigate(n.link);
                        setShowNotifications(false);
                      }}
                      className="px-5 py-4 hover:bg-gray-800/50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 p-2 rounded-lg ${
                          n.type === 'warning' ? 'bg-orange-500/10 text-orange-500' :
                          n.type === 'error' ? 'bg-red-500/10 text-red-500' :
                          'bg-indigo-500/10 text-indigo-500'
                        }`}>
                          {n.title.includes('Stock') ? <Package className="w-4 h-4" /> : 
                           n.title.includes('Sponsorship') ? <Heart className="w-4 h-4" /> :
                           <Info className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="text-gray-100 text-sm font-bold group-hover:text-white transition-colors">{n.title}</div>
                          <div className="text-gray-400 text-xs mt-1 leading-relaxed">{n.message}</div>
                          <div className="text-[10px] text-gray-600 font-bold uppercase mt-2">
                            {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        <span className="text-gray-200 font-mono text-sm hidden sm:block">
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>

        <button
          onClick={() => setDarkMode((d) => !d)}
          className={`p-2.5 rounded-xl transition-all duration-300 ${
            darkMode 
              ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.1)]' 
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="relative" ref={userRef}>
          <button
            onClick={() => setShowDropdown((s) => !s)}
            className="flex items-center space-x-2 p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors focus:outline-none"
            aria-label="User menu"
          >
            <User className="w-6 h-6 text-gray-300" />
            <span className="hidden md:inline text-gray-200 text-sm font-medium">{user?.name || user?.email}</span>
          </button>
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-lg z-20">
              <div className="px-4 py-3 border-b border-gray-800">
                <div className="font-semibold text-gray-100">{user?.name || 'User'}</div>
                <div className="text-xs text-gray-400">{user?.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-gray-200 hover:bg-gray-800 transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;