
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ViewMode, LeaveEntry, Holiday } from '@/types';
import { DBService } from '@/database';
import Dashboard from '@/components/Dashboard';
import LeaveForm from '@/components/LeaveForm';
import AdminPanel from '@/components/AdminPanel';
import Navbar from '@/components/Navbar';
import UncodedRecords from '@/components/UncodedRecords';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('DASHBOARD');
  const [leaves, setLeaves] = useState<LeaveEntry[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [preselectedDate, setPreselectedDate] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());
  
  const dashboardDateRef = useRef<Date>(new Date());

  const fetchData = useCallback(async (showSync = false) => {
    if (showSync) setIsSyncing(true);
    try {
      const leaveData = await DBService.getAllLeaves();
      const holidayData = DBService.getHolidays();
      setLeaves(leaveData);
      setHolidays(holidayData);
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Fetch Failed:', err);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleApplyFromDashboard = (date: string) => {
    setPreselectedDate(date);
    setView('APPLY');
  };

  const handleLeaveAdded = async (appliedDate?: string) => {
    setIsSyncing(true);
    if (appliedDate) {
      const [y, m, d] = appliedDate.split('-').map(Number);
      dashboardDateRef.current = new Date(y, m - 1, d);
    }
    setPreselectedDate(null);
    setTimeout(async () => {
      await fetchData(true);
      setView('DASHBOARD');
    }, 2500);
  };

  const handleDeleteLeave = async (id: number | string) => {
    setLeaves(prev => prev.filter(l => l.id !== id));
    setIsSyncing(true);
    try {
      await DBService.deleteLeave(id);
      setTimeout(() => fetchData(true), 3000);
    } catch (err) {
      setIsSyncing(false);
      fetchData();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 font-black text-slate-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        SECURE CONNECTING...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar view={view} setView={setView} isAdmin={isAdmin} isSyncing={isSyncing} />
      
      {isSyncing && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 z-[100] border border-slate-800">
          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping"></div>
          Syncing to Cloud
        </div>
      )}

      <main className="flex-grow container mx-auto px-4 py-8 text-slate-900">
        {view === 'DASHBOARD' && (
          <Dashboard 
            leaves={leaves} 
            holidays={holidays}
            onRefresh={() => fetchData(true)} 
            onApplyLeave={handleApplyFromDashboard}
            initialViewDate={dashboardDateRef.current}
            lastSync={lastSyncTime}
            isAdmin={isAdmin}
            onDeleteLeave={handleDeleteLeave}
          />
        )}
        {(view === 'APPLY' || view === 'UNCODED' || view === 'UNPLANNED_UNCODED' || view === 'REGULAR_UNPLANNED') && (
          <LeaveForm 
            leaves={leaves} 
            onSuccess={handleLeaveAdded} 
            isUncoded={view === 'UNCODED'}
            isUnplanned={view === 'UNPLANNED_UNCODED'}
            isRegularUnplanned={view === 'REGULAR_UNPLANNED'}
            isAdmin={isAdmin}
            initialDate={preselectedDate || ''}
          />
        )}
        {view === 'AUDIT_QUEUE' && (
          <UncodedRecords 
            leaves={leaves} 
            onRefresh={() => fetchData(true)} 
            isAdmin={isAdmin}
          />
        )}
        {view === 'ADMIN' && (
          <AdminPanel 
            leaves={leaves} 
            onRefresh={() => fetchData(true)} 
            isAdmin={isAdmin} 
            setIsAdmin={setIsAdmin}
            onLogout={() => { setIsAdmin(false); setView('DASHBOARD'); }}
          />
        )}
      </main>

      <footer className="bg-white border-t py-6 text-center text-slate-400 text-[10px] uppercase tracking-widest font-bold flex flex-col items-center gap-1">
        <span>IVE Operations • Node Secure</span>
        <span className="text-blue-500 opacity-60">Last Successful Connection: {lastSyncTime}</span>
      </footer>
    </div>
  );
};

export default App;
