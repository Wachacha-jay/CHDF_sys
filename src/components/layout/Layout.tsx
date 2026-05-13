import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const Layout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      <main className="flex-1 min-w-0 flex flex-col relative">
        <TopBar onMenuClick={toggleSidebar} />
        <div className="p-4 lg:p-8 flex-1 overflow-auto">
          <Outlet />
        </div>
        <footer className="py-4 px-6 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500 bg-white dark:bg-gray-900">
          <p>© {new Date().getFullYear()} Jaytech Inc. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
};

export default Layout;