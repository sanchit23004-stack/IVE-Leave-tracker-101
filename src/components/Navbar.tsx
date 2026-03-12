
import React from 'react';
import { ViewMode } from '@/types';

interface NavbarProps {
  view: ViewMode;
  setView: (view: ViewMode) => void;
  isAdmin: boolean;
  isSyncing: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ view, setView, isAdmin, isSyncing }) => {
  return (
    <nav className="bg-white border-b sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => setView('DASHBOARD')}
        >
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">L</div>
          <span className="text-xl font-bold text-slate-800 tracking-tight hidden sm:inline">IVE LeaveTracker</span>
          {isSyncing && (
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping ml-2"></div>
          )}
        </div>

        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          <NavItem 
            active={view === 'DASHBOARD'} 
            onClick={() => setView('DASHBOARD')} 
            label="Dashboard" 
          />
          <NavItem 
            active={view === 'APPLY'} 
            onClick={() => setView('APPLY')} 
            label="Apply" 
          />
          <NavItem 
            active={view === 'UNCODED'} 
            onClick={() => setView('UNCODED')} 
            label="Planned Uncoded" 
            highlight={true}
          />
          <NavItem 
            active={view === 'REGULAR_UNPLANNED'} 
            onClick={() => setView('REGULAR_UNPLANNED')} 
            label="Unplanned Coded" 
            special={true}
          />
          <NavItem 
            active={view === 'UNPLANNED_UNCODED'} 
            onClick={() => setView('UNPLANNED_UNCODED')} 
            label="Unplanned Uncoded" 
            urgent={true}
          />
          <NavItem 
            active={view === 'AUDIT_QUEUE'} 
            onClick={() => setView('AUDIT_QUEUE')} 
            label="Audit Queue" 
            audit={true}
          />
          <NavItem 
            active={view === 'ADMIN'} 
            onClick={() => setView('ADMIN')} 
            label={isAdmin ? "Command Center" : "Admin"} 
            highlight={isAdmin}
          />
        </div>
      </div>
    </nav>
  );
};

const NavItem: React.FC<{ active: boolean; onClick: () => void; label: string; highlight?: boolean; urgent?: boolean; audit?: boolean; special?: boolean }> = ({ active, onClick, label, highlight, urgent, audit, special }) => (
  <button
    onClick={onClick}
    className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-black uppercase tracking-tight transition-all duration-200 whitespace-nowrap ${
      active 
        ? 'bg-slate-100 text-blue-600 font-black' 
        : audit
          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 px-5'
          : urgent
            ? 'text-red-600 hover:bg-red-50'
            : special
              ? 'text-purple-600 hover:bg-purple-50'
              : highlight 
                ? 'text-orange-600 hover:bg-orange-50' 
                : 'text-slate-600 hover:bg-slate-50'
    }`}
  >
    {label}
  </button>
);

export default Navbar;
