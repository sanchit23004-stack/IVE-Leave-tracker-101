
import React, { useState, useMemo, useEffect } from 'react';
import { LeaveEntry } from '../types';
import { DBService } from '../database';

interface UncodedRecordsProps {
  leaves: LeaveEntry[];
  onRefresh: () => void;
  isAdmin: boolean;
}

const UncodedRecords: React.FC<UncodedRecordsProps> = ({ leaves, onRefresh, isAdmin }) => {
  const [localOverrides, setLocalOverrides] = useState<Record<string, { status: boolean, timestamp: number }>>(() => {
    const saved = localStorage.getItem('audit_queue_overrides_v2');
    return saved ? JSON.parse(saved) : {};
  });

  const [isSyncing, setIsSyncing] = useState<string | number | null>(null);
  const [successId, setSuccessId] = useState<string | number | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    localStorage.setItem('audit_queue_overrides_v2', JSON.stringify(localOverrides));
  }, [localOverrides]);

  useEffect(() => {
    setLocalOverrides(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach(id => {
        const cloudMatch = leaves.find(l => String(l.id) === String(id));
        if (cloudMatch && cloudMatch.isCoded === next[id].status) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [leaves]);

  const handleMarkCoded = async (entry: LeaveEntry) => {
    const id = entry.id;
    if (id === undefined) return;
    const idStr = String(id);

    if (!isAdmin) {
      alert("Manager Login Required. Please go to the 'Command Center' tab first.");
      return;
    }

    const nextStatus = !entry.isCoded;
    setIsSyncing(id);
    setSuccessId(null);
    
    setLocalOverrides(prev => ({
      ...prev,
      [idStr]: { status: nextStatus, timestamp: Date.now() }
    }));
    
    try {
      await DBService.updateLeaveStatus(id, nextStatus, entry.alias, entry.date);
      setTimeout(() => {
        setIsSyncing(null);
        setSuccessId(id);
        onRefresh();
        setTimeout(() => setSuccessId(null), 3000);
      }, 2000);
    } catch (err) { 
      setLocalOverrides(prev => {
        const next = { ...prev };
        delete next[idStr];
        return next;
      });
      setIsSyncing(null);
      alert('Network Error: Could not reach the cloud database.'); 
    }
  };

  const uncodedShrinkageData = useMemo(() => {
    return leaves
      .filter(l => {
        // COMBINED: Planned Uncoded AND Unplanned Uncoded
        const isUnplannedUncoded = l.type.toString().includes('Unplanned Uncoded');
        const isRegularUnplanned = !!l.isRegularUnplanned || l.type.toString().startsWith('Regular Unplanned');
        const isPlannedUncoded = !!l.isUncoded && !isRegularUnplanned && !isUnplannedUncoded;
        
        const matchesSearch = l.alias.toLowerCase().includes(search.toLowerCase());
        return (isUnplannedUncoded || isPlannedUncoded) && matchesSearch;
      })
      .map(l => {
        const idStr = String(l.id);
        const baseLeave = l.id !== undefined && localOverrides[idStr] 
          ? { ...l, isCoded: localOverrides[idStr].status } 
          : l;
        
        const isUnplannedUncoded = baseLeave.type.toString().includes('Unplanned Uncoded');
        let displayType = baseLeave.type.toString();
        
        // Ensure "Uncoded" prefix for planned entries
        if (!isUnplannedUncoded && baseLeave.isUncoded && !displayType.startsWith('Uncoded')) {
          displayType = `Uncoded ${displayType}`;
        }

        return { ...baseLeave, displayType };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [leaves, localOverrides, search]);

  const stats = useMemo(() => {
    const pendingCount = uncodedShrinkageData.filter(l => !l.isCoded).length;
    const completedCount = uncodedShrinkageData.filter(l => !!l.isCoded).length;
    return { pendingCount, completedCount };
  }, [uncodedShrinkageData]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-6xl mx-auto pb-20">
      <div className="bg-[#0f172a] rounded-[2.5rem] shadow-sm border p-10 flex flex-col md:flex-row items-center justify-between gap-8 text-white">
        <div>
          <h2 className="text-4xl font-black tracking-tighter">Uncoded Shrinkage</h2>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-1">Audit Queue: Planned Overrides + Urgent Uncoded</p>
        </div>
        <div className="flex gap-4">
           <div className="px-8 py-4 bg-orange-500/10 border border-orange-500/20 rounded-3xl text-center min-w-[140px]">
              <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-1">Pending Audit</p>
              <p className="text-3xl font-black text-orange-500">{stats.pendingCount}</p>
           </div>
           <div className="px-8 py-4 bg-green-500/10 border border-green-500/20 rounded-3xl text-center min-w-[140px]">
              <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mb-1">Coded / Verified</p>
              <p className="text-3xl font-black text-green-500">{stats.completedCount}</p>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
        <div className="p-10 border-b flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="relative flex-1 w-full max-w-md">
              <input 
                type="text" 
                placeholder="Search personnel alias..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900" 
              />
              <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
           <button onClick={onRefresh} className="px-6 py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg active:scale-95">Manual Refresh</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-10 py-8">Date</th>
                <th className="px-10 py-8">Personnel</th>
                <th className="px-10 py-8">Category</th>
                <th className="px-10 py-8 text-center">Audit Status</th>
                <th className="px-10 py-8 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {uncodedShrinkageData.map(l => {
                const isUnplannedUncoded = l.type.toString().includes('Unplanned Uncoded');
                const isCompleted = !!l.isCoded;
                const isBusy = String(isSyncing) === String(l.id);
                const isDone = String(successId) === String(l.id);
                const idStr = String(l.id);

                return (
                  <tr key={idStr} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-10 py-8 text-sm font-black text-slate-900">
                      <span className="bg-slate-100 px-3 py-1 rounded-lg text-slate-600">{l.date}</span>
                    </td>
                    <td className="px-10 py-8">
                       <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl ${isUnplannedUncoded ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'} flex items-center justify-center font-black text-[10px] shadow-sm uppercase`}>{l.alias.substring(0,2)}</div>
                          <span className="text-sm font-black text-slate-900">{l.alias}</span>
                       </div>
                    </td>
                    <td className="px-10 py-8">
                       <span className={`text-[10px] font-black px-4 py-1.5 ${isUnplannedUncoded ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'} rounded-full inline-block`}>
                        {(l as any).displayType}
                       </span>
                    </td>
                    <td className="px-10 py-8 text-center">
                       <div className="flex flex-col items-center gap-1">
                          <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${isCompleted ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm'}`}>
                            {isCompleted ? 'COMPLETED' : 'PENDING'}
                          </span>
                       </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <button 
                         disabled={isBusy}
                         onClick={() => handleMarkCoded(l)}
                         className={`relative min-w-[140px] px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                           !isAdmin 
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                            : isCompleted 
                              ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' 
                              : 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                         } ${isBusy ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
                       >
                         {isBusy ? 'Syncing...' : isDone ? 'Done' : !isAdmin ? 'Login to Audit' : (isCompleted ? 'Revoke Audit' : 'Complete Audit')}
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {uncodedShrinkageData.length === 0 && (
            <div className="py-20 text-center text-slate-900 font-black uppercase text-xs">No pending uncoded records in queue</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UncodedRecords;
