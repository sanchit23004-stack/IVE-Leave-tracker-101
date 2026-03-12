
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { LeaveEntry, LeaveType, Holiday } from '@/types';
import { ADMIN_PASSWORD } from '@/constants';
import { DBService } from '@/database';

interface AdminPanelProps {
  leaves: LeaveEntry[];
  onRefresh: () => void;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  onLogout: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ leaves, onRefresh, isAdmin, setIsAdmin, onLogout }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSyncingId, setIsSyncingId] = useState<string | number | null>(null);
  const [teamSize, setTeamSize] = useState<number>(() => {
    const saved = localStorage.getItem('ive_team_size');
    return saved ? parseInt(saved, 10) : 15;
  });

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return nextMonth.toISOString().split('T')[0];
  });

  const [auditAlias, setAuditAlias] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');

  // Roster Filters
  const [rFilterFromDate, setRFilterFromDate] = useState('');
  const [rFilterToDate, setRFilterToDate] = useState('');
  const [rFilterAlias, setRFilterAlias] = useState('');
  const [rFilterCategory, setRFilterCategory] = useState('All Categories');
  const [rFilterLogMode, setRFilterLogMode] = useState('All Modes');
  const [rFilterUnits, setRFilterUnits] = useState('All Units');
  const [rFilterAudit, setRFilterAudit] = useState('All Status');

  useEffect(() => {
    localStorage.setItem('ive_team_size', teamSize.toString());
  }, [teamSize]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) { setIsAdmin(true); setError(''); }
    else { setError('Authorization Failed'); }
  };

  const handleMarkCoded = async (entry: LeaveEntry) => {
    if (!entry.id) return;
    setIsSyncingId(entry.id);
    try {
      await DBService.updateLeaveStatus(entry.id, !entry.isCoded, entry.alias, entry.date);
      setTimeout(() => {
        setIsSyncingId(null);
        onRefresh();
      }, 2000);
    } catch (err) {
      setIsSyncingId(null);
      alert('Cloud Sync Error');
    }
  };

  const stats = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const capacity = teamSize * days;
    
    const rangeLeaves = leaves.filter(l => l.date >= startDate && l.date <= endDate);
    
    const getCatStats = (filterFunc: (l: LeaveEntry) => boolean) => {
      const items = rangeLeaves.filter(filterFunc);
      const units = items.reduce((s, l) => s + l.duration, 0);
      const logs = items.length;
      return {
        units,
        logs,
        percent: capacity > 0 ? (logs / capacity) * 100 : 0
      };
    };

    const isUnplannedUncoded = (l: LeaveEntry) => l.type.toString().includes('Unplanned Uncoded');
    const isUnplannedCoded = (l: LeaveEntry) => (l.type.toString().startsWith('Unplanned Coded') || l.type.toString().startsWith('Regular Unplanned') || !!l.isRegularUnplanned) && !l.isUncoded;
    const isUncodedOverride = (l: LeaveEntry) => l.isUncoded && !l.type.toString().includes('Unplanned Uncoded');
    
    const isAL = (l: LeaveEntry) => l.type.toString().includes('Annual Leave');
    const isSL = (l: LeaveEntry) => l.type.toString().includes('Sick Leave');
    const isCL = (l: LeaveEntry) => l.type.toString().includes('Casual Leave');
    const isOH = (l: LeaveEntry) => l.type.toString().includes('Optional Holiday');
    const isMandatory = (l: LeaveEntry) => l.type.toString().toLowerCase().includes('mandatory holiday') || l.type.toString().toLowerCase().includes('other coded leave') || l.type.toString().toLowerCase().includes('other coded holidays');

    const categories = {
      AL: getCatStats(l => isAL(l) && !l.isUncoded && !isUnplannedCoded(l)),
      SL: getCatStats(l => isSL(l) && !l.isUncoded && !isUnplannedCoded(l)),
      CL: getCatStats(l => isCL(l) && !l.isUncoded && !isUnplannedCoded(l)),
      OH: getCatStats(l => isOH(l) && !l.isUncoded && !isUnplannedCoded(l)),
      OTHER: getCatStats(l => isMandatory(l) && !l.isUncoded && !isUnplannedCoded(l)),
      UNPLANNED_CODED: getCatStats(l => isUnplannedCoded(l)),
      UNCODED_OVERRIDE: getCatStats(l => isUncodedOverride(l)),
      UNPLANNED_UNCODED: getCatStats(l => isUnplannedUncoded(l)),
      MISC: getCatStats(l => !isAL(l) && !isSL(l) && !isCL(l) && !isOH(l) && !isMandatory(l) && !isUnplannedCoded(l) && !isUncodedOverride(l) && !isUnplannedUncoded(l) && !l.isUncoded)
    };

    const globalLogs = rangeLeaves.length;
    const globalIDs = new Set(rangeLeaves.map(l => l.alias.toLowerCase())).size;

    const uncodedItems = rangeLeaves.filter(l => l.isUncoded);
    const uncodedLogs = uncodedItems.length;
    const uncodedIDs = new Set(uncodedItems.map(l => l.alias.toLowerCase())).size;

    const unplannedItems = rangeLeaves.filter(l => l.type.toString().startsWith('Unplanned Coded') || l.type.toString().startsWith('Regular Unplanned') || (l.type.toString().includes('Unplanned Uncoded')));
    const unplannedLogs = unplannedItems.length;
    const unplannedIDs = new Set(unplannedItems.map(l => l.alias.toLowerCase())).size;

    return {
      capacity,
      days,
      global: {
        percent: capacity > 0 ? (globalLogs / capacity) * 100 : 0,
        units: globalLogs,
        ids: globalIDs,
        logs: globalLogs,
        breakdown: categories
      },
      uncoded: {
        percent: capacity > 0 ? (uncodedLogs / capacity) * 100 : 0,
        units: uncodedLogs,
        ids: uncodedIDs,
        logs: uncodedLogs
      },
      unplanned: {
        percent: capacity > 0 ? (unplannedLogs / capacity) * 100 : 0,
        units: unplannedLogs,
        ids: unplannedIDs,
        logs: unplannedLogs
      }
    };
  }, [leaves, startDate, endDate, teamSize]);

  const filteredRoster = useMemo(() => {
    return leaves
      .filter(l => {
        const typeStr = l.type.toString();
        const aliasLower = l.alias.toLowerCase();
        const searchLower = globalSearch.toLowerCase();
        
        // Log Mode Detection (Must match bubble display logic exactly)
        const isUnplannedUncoded = typeStr.includes('Unplanned Uncoded');
        const isUnplannedCoded = typeStr.startsWith('Unplanned Coded') || typeStr.startsWith('Regular Unplanned') || !!l.isRegularUnplanned;
        const isUncodedOverride = l.isUncoded && !isUnplannedUncoded && !isUnplannedCoded;
        const isStandard = !isUnplannedUncoded && !isUnplannedCoded && !isUncodedOverride;

        // 1. Global Search
        const matchesGlobal = !globalSearch || aliasLower.includes(searchLower) || typeStr.toLowerCase().includes(searchLower);
        if (!matchesGlobal) return false;

        // 2. Date Range
        const matchesFromDate = !rFilterFromDate || l.date >= rFilterFromDate;
        const matchesToDate = !rFilterToDate || l.date <= rFilterToDate;
        if (!matchesFromDate || !matchesToDate) return false;

        // 3. Personnel Alias
        const matchesAlias = !rFilterAlias || aliasLower.includes(rFilterAlias.toLowerCase());
        if (!matchesAlias) return false;
        
        // 4. Category (The Fix: Use Case-Insensitive partial match for unplanned prefixes)
        if (rFilterCategory !== 'All Categories') {
          const filterCatLower = rFilterCategory.toLowerCase();
          const recordTypeLower = typeStr.toLowerCase();
          
          let catMatch = false;
          if (rFilterCategory === LeaveType.OTHER) {
            // Handle multiple "Other" variants
            catMatch = recordTypeLower.includes('mandatory holiday') || recordTypeLower.includes('other coded leave');
          } else {
            catMatch = recordTypeLower.includes(filterCatLower);
          }
          if (!catMatch) return false;
        }
        
        // 5. Units
        const matchesUnits = rFilterUnits === 'All Units' || l.duration.toString() === rFilterUnits.replace(/[Uu]/g, '');
        if (!matchesUnits) return false;

        // 6. Audit Status
        const matchesAudit = rFilterAudit === 'All Status' || (rFilterAudit === 'COMPLETED' ? l.isCoded : !l.isCoded);
        if (!matchesAudit) return false;
        
        // 7. Log Mode
        if (rFilterLogMode !== 'All Modes') {
          let modeMatch = false;
          if (rFilterLogMode === 'UNPLANNED_UNCODED') modeMatch = isUnplannedUncoded;
          else if (rFilterLogMode === 'UNPLANNED_CODED') modeMatch = isUnplannedCoded;
          else if (rFilterLogMode === 'UNCODED') modeMatch = isUncodedOverride;
          else if (rFilterLogMode === 'STANDARD') modeMatch = isStandard;
          if (!modeMatch) return false;
        }

        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [leaves, globalSearch, rFilterFromDate, rFilterToDate, rFilterAlias, rFilterCategory, rFilterUnits, rFilterAudit, rFilterLogMode]);

  const auditStats = useMemo(() => {
    if (!auditAlias.trim()) return null;
    const cleanAlias = auditAlias.trim().toLowerCase();
    const rangeLeaves = leaves.filter(l => l.alias.trim().toLowerCase() === cleanAlias && l.date >= startDate && l.date <= endDate);
    const units = rangeLeaves.reduce((sum, l) => sum + l.duration, 0);
    
    const unplannedLeaves = rangeLeaves.filter(l => {
      const typeStr = l.type.toString();
      return typeStr.startsWith('Unplanned Coded') || 
             typeStr.startsWith('Regular Unplanned') || 
             !!l.isRegularUnplanned || 
             typeStr.includes('Unplanned Uncoded');
    });
    const unplannedUnits = unplannedLeaves.reduce((sum, l) => sum + l.duration, 0);

    let workDays = 0;
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) workDays++;
      cur.setDate(cur.getDate() + 1);
    }
    
    return {
      units, 
      shrinkage: workDays > 0 ? (units / workDays) * 100 : 0, 
      unplannedShrinkage: workDays > 0 ? (unplannedUnits / workDays) * 100 : 0,
      logs: rangeLeaves.length, 
      workDays 
    };
  }, [leaves, auditAlias, startDate, endDate]);

  const aliasStats = useMemo(() => {
    const rangeLeaves = leaves.filter(l => l.date >= startDate && l.date <= endDate);
    const statsMap: Record<string, number> = {};
    
    rangeLeaves.forEach(l => {
      const alias = l.alias;
      statsMap[alias] = (statsMap[alias] || 0) + l.duration;
    });

    return Object.entries(statsMap)
      .map(([alias, count]) => ({ alias, count }))
      .sort((a, b) => b.count - a.count);
  }, [leaves, startDate, endDate]);

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-12 text-center border">
          <h2 className="text-2xl font-black mb-8 text-slate-900 uppercase tracking-tight">Admin Authentication</h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-8 py-5 rounded-2xl border-2 text-center text-2xl font-black focus:border-blue-600 outline-none text-slate-900" placeholder="••••" required />
            <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg">Access Command Center</button>
          </form>
          {error && <p className="text-red-600 text-[10px] font-black uppercase mt-4 tracking-widest">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      {/* 1. COMMAND CENTER HEADER */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 bg-white rounded-3xl p-8 border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-6">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Command Center</h2>
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-1">Global Database Management</p>
              </div>
              <button onClick={onLogout} className="px-6 py-2.5 bg-slate-950 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-red-600 transition-all">Logout</button>
           </div>
           <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Start Date</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-3 bg-slate-50 border rounded-xl font-black text-xs outline-none focus:border-blue-500 text-slate-900" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">End Date</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-3 bg-slate-50 border rounded-xl font-black text-xs outline-none focus:border-blue-500 text-slate-900" />
              </div>
              <div className="h-12 w-px bg-slate-100 hidden md:block"></div>
              <div className="text-center px-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Range Capacity</p>
                 <p className="text-xl font-black text-slate-900">{stats.capacity.toFixed(1)} U</p>
              </div>
           </div>
        </div>
        <div className="w-full xl:w-96 bg-white rounded-3xl p-8 border shadow-sm text-slate-900 font-black">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Team Size Baseline</p>
           <input type="number" value={teamSize} onChange={(e) => setTeamSize(parseInt(e.target.value) || 1)} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 text-3xl font-black text-slate-900 focus:ring-2 focus:ring-blue-100 outline-none" />
        </div>
      </div>

      {/* 2. AGGREGATED SHRINKAGE CONTROL PANEL */}
      <div className="bg-[#0f172a] rounded-[2.5rem] shadow-2xl overflow-hidden border-4 border-slate-800">
        <div className="p-10 pb-4">
          <h3 className="text-3xl font-black text-white tracking-tight">Aggregated Shrinkage Control Panel</h3>
          <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest mt-1">Operational Loss Analysis Breakdown</p>
        </div>
        
        <div className="flex flex-col lg:flex-row border-t border-slate-800">
          <div className="lg:w-1/3 p-12 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-800 bg-[#1e293b]/20">
             <p className="text-slate-400 font-black text-[11px] uppercase tracking-widest mb-4">Total Net Shrinkage</p>
             <div className="text-8xl font-black text-blue-500 mb-4">{stats.global.percent.toFixed(1)}<span className="text-4xl text-blue-900">%</span></div>
             <p className="text-slate-500 font-black text-xs uppercase tracking-widest">{stats.global.units.toFixed(1)} Units / {stats.capacity.toFixed(1)} Max</p>
             <div className="mt-8 flex gap-4">
                <div className="px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5">
                   <p className="text-[8px] font-black text-slate-500 uppercase mb-1">IDs Involved</p>
                   <p className="text-lg font-black text-white">{stats.global.ids}</p>
                </div>
                <div className="px-4 py-2 bg-slate-800/50 rounded-xl border border-white/5">
                   <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Total Logs</p>
                   <p className="text-lg font-black text-white">{stats.global.logs}</p>
                </div>
             </div>
          </div>

          <div className="flex-1 p-10 space-y-4">
             <div className="flex text-[10px] font-black text-slate-600 uppercase tracking-widest px-4 mb-2">
                <span className="w-48">Category</span>
                <span className="flex-1">Impact Metrics</span>
                <span className="w-24 text-right">Status</span>
             </div>
             <div className="space-y-1">
                <BreakdownRow label="Annual Leave" stats={stats.global.breakdown.AL} color="bg-blue-600" />
                <BreakdownRow label="Sick Leave" stats={stats.global.breakdown.SL} color="bg-blue-400" />
                <BreakdownRow label="Casual Leave" stats={stats.global.breakdown.CL} color="bg-blue-300" />
                <BreakdownRow label="Optional Holiday" stats={stats.global.breakdown.OH} color="bg-indigo-400" />
                <BreakdownRow label="Mandatory Holiday" stats={stats.global.breakdown.OTHER} color="bg-slate-500" />
                <BreakdownRow label="Unplanned Coded" stats={stats.global.breakdown.UNPLANNED_CODED} color="bg-purple-500" />
                <BreakdownRow label="Uncoded (Override)" stats={stats.global.breakdown.UNCODED_OVERRIDE} color="bg-orange-500" status="ACTIVE" highlight />
                <BreakdownRow label="Unplanned Uncoded" stats={stats.global.breakdown.UNPLANNED_UNCODED} color="bg-red-500" status="HIGH IMPACT" highlight />
                {stats.global.breakdown.MISC.logs > 0 && <BreakdownRow label="Misc Coded" stats={stats.global.breakdown.MISC} color="bg-slate-400" />}
             </div>
          </div>
        </div>
      </div>

      {/* 3. UNPLANNED DASHBOARD SECTION */}
      <div className="max-w-4xl mx-auto w-full">
         <div className="bg-red-600 rounded-[3rem] p-1 shadow-2xl border-4 border-white">
            <div className="p-8 pb-12 flex items-center justify-between text-white">
               <div className="flex items-center gap-5">
                  <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                     <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <div>
                     <h3 className="text-3xl font-black tracking-tighter">Unplanned Dashboard</h3>
                     <p className="text-red-200 font-black text-[10px] uppercase tracking-[0.2em]">Urgent Absence Tracking</p>
                  </div>
               </div>
               <div className="px-5 py-2.5 bg-white/10 border border-white/20 rounded-full text-[9px] font-black tracking-widest uppercase backdrop-blur-sm">Reactive Leave</div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-4 grid grid-cols-2 gap-4">
               <DashboardMetric label="Impact Percent" value={`${stats.unplanned.percent.toFixed(2)}%`} theme="red" />
               <DashboardMetric label="Total Units" value={`${stats.unplanned.units.toFixed(1)}u`} theme="red" />
               <DashboardMetric label="Personnel Usage" value={`${stats.unplanned.ids} IDs`} theme="red" />
               <DashboardMetric label="Entry Frequency" value={`${stats.unplanned.logs} Logs`} theme="red" />
            </div>
         </div>
      </div>

      {/* 3.5 PERSONNEL LEAVE DISTRIBUTION DASHBOARD */}
      <div className="bg-white rounded-[2.5rem] border shadow-sm p-10">
        <div className="mb-8">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">Personnel Leave Distribution</h3>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-1">Leave Volume by Alias (Sorted High to Low)</p>
        </div>
        
        <div className="w-full overflow-x-auto pb-4">
          <div style={{ minWidth: `${Math.max(800, aliasStats.length * 60)}px`, height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aliasStats} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="alias" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '1rem', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  itemStyle={{ fontWeight: 900, fontSize: '12px', color: '#0f172a' }}
                  labelStyle={{ fontWeight: 900, fontSize: '10px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={30}>
                  {aliasStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#2563eb' : '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. INDIVIDUAL PERSONNEL AUDIT */}
      <div className="bg-white rounded-[2.5rem] border shadow-sm p-10">
          <div className="flex items-center justify-between mb-10">
             <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Individual Personnel Audit</h3>
                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-1">Frequency & Impact Lookup</p>
             </div>
             <input type="text" placeholder="Alias Search..." value={auditAlias} onChange={(e) => setAuditAlias(e.target.value)} className="pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm w-80 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner text-slate-900" />
          </div>
          {auditStats ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 animate-in slide-in-from-bottom-4">
               <AuditMetric label="Total Shrinkage" value={`${auditStats.shrinkage.toFixed(1)}%`} color="text-blue-600" />
               <AuditMetric label="Unplanned Shrinkage" value={`${auditStats.unplannedShrinkage.toFixed(1)}%`} color="text-red-600" />
               <AuditMetric label="Logged Units" value={`${auditStats.units.toFixed(1)}U`} color="text-slate-900" />
               <AuditMetric label="Entry Frequency" value={`${auditStats.logs} Logs`} color="text-slate-900" />
               <AuditMetric label="Work Capacity" value={`${auditStats.workDays} Days`} color="text-slate-400" />
            </div>
          ) : (
            <div className="py-12 text-center border-2 border-dashed rounded-3xl">
               <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">Awaiting Alias Input for Database Query...</p>
            </div>
          )}
      </div>

      {/* 5. ROSTER HISTORY TABLE */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
        <div className="p-10 border-b">
           <div className="flex items-center justify-between gap-6 mb-10">
              <div>
                 <h4 className="text-2xl font-black tracking-tight text-slate-900">Roster History</h4>
                 <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-1">Advanced Roster Management & Multi-Filtering</p>
              </div>
              <div className="relative">
                 <input type="text" placeholder="Global Search..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} className="pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm w-96 outline-none focus:border-blue-500 transition-all text-slate-900" />
                 <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
           </div>

           {/* Filter Controls Row */}
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From Date</label>
                 <input type="date" value={rFilterFromDate} onChange={(e) => setRFilterFromDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs text-slate-900 outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To Date</label>
                 <input type="date" value={rFilterToDate} onChange={(e) => setRFilterToDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs text-slate-900 outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Personnel</label>
                 <input type="text" placeholder="Filter Alias..." value={rFilterAlias} onChange={(e) => setRFilterAlias(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs text-slate-900 outline-none focus:border-blue-500" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                 <select value={rFilterCategory} onChange={(e) => setRFilterCategory(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs text-slate-900 outline-none focus:border-blue-500 appearance-none cursor-pointer">
                    <option>All Categories</option>
                    <option value={LeaveType.AL}>{LeaveType.AL}</option>
                    <option value={LeaveType.SL}>{LeaveType.SL}</option>
                    <option value={LeaveType.CL}>{LeaveType.CL}</option>
                    <option value={LeaveType.OH}>{LeaveType.OH}</option>
                    <option value={LeaveType.OTHER}>{LeaveType.OTHER}</option>
                 </select>
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Log Mode</label>
                 <select value={rFilterLogMode} onChange={(e) => setRFilterLogMode(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs text-slate-900 outline-none focus:border-blue-500 appearance-none cursor-pointer">
                    <option>All Modes</option>
                    <option value="STANDARD">Standard</option>
                    <option value="UNCODED">Uncoded</option>
                    <option value="UNPLANNED_CODED">Unplanned Coded</option>
                    <option value="UNPLANNED_UNCODED">Unplanned Uncoded</option>
                 </select>
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Audit Status</label>
                 <select value={rFilterAudit} onChange={(e) => setRFilterAudit(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs text-slate-900 outline-none focus:border-blue-500 appearance-none cursor-pointer">
                    <option>All Status</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="PENDING">PENDING</option>
                 </select>
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Units</label>
                 <select value={rFilterUnits} onChange={(e) => setRFilterUnits(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-black text-xs text-slate-900 outline-none focus:border-blue-500 appearance-none cursor-pointer">
                    <option>All Units</option>
                    <option value="1.0U">1.0U</option>
                    <option value="0.5U">0.5U</option>
                 </select>
              </div>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-10 py-6">Date</th>
                <th className="px-10 py-6">Personnel</th>
                <th className="px-10 py-6">Category</th>
                <th className="px-10 py-6">Log Mode</th>
                <th className="px-10 py-6 text-center">Audit Status</th>
                <th className="px-10 py-6 text-right">Units</th>
                <th className="px-10 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-900 font-black">
              {filteredRoster.map(l => {
                const typeStr = l.type.toString();
                const isUnplannedUncoded = typeStr.includes('Unplanned Uncoded');
                const isUnplannedCoded = typeStr.startsWith('Unplanned Coded') || typeStr.startsWith('Regular Unplanned') || !!l.isRegularUnplanned;
                const isUncodedOverride = l.isUncoded && !isUnplannedUncoded && !isUnplannedCoded;
                
                const initials = l.alias.substring(0, 2).toUpperCase();
                const needsAudit = isUnplannedUncoded || isUncodedOverride;
                const showPending = needsAudit && !l.isCoded;
                const isBusy = isSyncingId === l.id;
                
                // Normalizing legacy labels to "Mandatory Holiday" for UI consistency
                let displayType = typeStr;
                if (typeStr.toLowerCase().includes('other coded leave')) {
                  displayType = typeStr.replace(/other coded leave/gi, 'Mandatory Holiday');
                } else if (typeStr.toLowerCase().includes('other coded holidays')) {
                  displayType = typeStr.replace(/other coded holidays/gi, 'Mandatory Holiday');
                }

                return (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-10 py-6 text-sm">{l.date}</td>
                    <td className="px-10 py-6">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 text-[10px] font-black">{initials}</div>
                          <span className="text-slate-900 font-black">{l.alias}</span>
                       </div>
                    </td>
                    <td className="px-10 py-6">
                      <span className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase">
                        {displayType}
                      </span>
                    </td>
                    <td className="px-10 py-6">
                       <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${isUnplannedUncoded ? 'bg-red-500' : isUnplannedCoded ? 'bg-purple-500' : isUncodedOverride ? 'bg-orange-500' : 'bg-blue-600'}`}></div>
                          <span className="text-[10px] font-black uppercase text-slate-600">
                             {isUnplannedUncoded ? 'UNPLANNED_UNCODED' : isUnplannedCoded ? 'UNPLANNED_CODED' : isUncodedOverride ? 'UNCODED' : 'STANDARD'}
                          </span>
                       </div>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <span className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        showPending 
                          ? 'bg-amber-100 text-amber-600 border border-amber-200 shadow-sm' 
                          : 'bg-green-100 text-green-700 border border-green-200'
                      }`}>
                        {showPending ? 'PENDING' : 'CODED'}
                      </span>
                    </td>
                    <td className="px-10 py-6 text-right font-black text-blue-600 text-lg">{l.duration.toFixed(1)}U</td>
                    <td className="px-10 py-6 text-right">
                       {needsAudit && (
                         <button 
                            disabled={isBusy}
                            onClick={() => handleMarkCoded(l)}
                            className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${
                              l.isCoded 
                                ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' 
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                            }`}
                         >
                           {isBusy ? '...' : l.isCoded ? 'Revoke Audit' : 'Complete Audit'}
                         </button>
                       )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRoster.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-black uppercase text-xs">No records found matching filters</div>
          )}
        </div>
      </div>

      {/* 6. ADVANCED SETTINGS */}
      <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white mt-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <h3 className="text-2xl font-black tracking-tight">Advanced Settings</h3>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-1">Database & System Utilities</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-800">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Team Capacity Configuration</p>
            <div className="flex items-center gap-6">
              <input 
                type="number" 
                value={teamSize} 
                onChange={(e) => setTeamSize(parseInt(e.target.value) || 0)}
                className="w-32 px-6 py-4 bg-slate-900 border border-slate-700 rounded-2xl font-black text-xl outline-none focus:border-blue-500 transition-all"
              />
              <div>
                <p className="text-sm font-black text-white">Total Team Size</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Used for shrinkage calculations</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-white">Admin Session</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logout to clear administrative access</p>
            </div>
            <button onClick={onLogout} className="px-8 py-4 bg-red-600/10 hover:bg-red-600/20 border border-red-900/50 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const BreakdownRow = ({ label, stats, color, highlight, status = "CLEAR" }: any) => {
  const isZero = stats.units === 0;
  return (
    <div className={`flex items-center p-3 rounded-xl transition-all ${highlight && !isZero ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'}`}>
      <div className="w-48 flex items-center gap-3">
         <div className={`w-2 h-2 rounded-full ${color}`}></div>
         <span className={`text-[11px] font-black ${isZero ? 'text-slate-600' : 'text-slate-300'}`}>{label}</span>
      </div>
      <div className="flex-1 flex items-center gap-6 mr-8">
         <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${stats.percent}%` }}></div>
         </div>
         <div className="w-24 text-right">
            <span className={`text-[11px] font-black ${isZero ? 'text-slate-700' : 'text-white'}`}>
              {stats.percent.toFixed(1)}% <span className="text-[9px] text-slate-600 ml-1">({stats.logs.toFixed(1)}u)</span>
            </span>
         </div>
      </div>
      <div className="w-24 text-right">
         <span className={`text-[8px] font-black px-2 py-1 rounded-md border tracking-widest ${
           isZero 
            ? 'text-slate-800 border-slate-800' 
            : status === 'HIGH IMPACT'
              ? 'bg-red-950/40 text-red-500 border-red-900'
              : status === 'ACTIVE'
                ? 'bg-orange-950/40 text-orange-500 border-orange-900'
                : 'bg-blue-950/40 text-blue-400 border-blue-900'
         }`}>
            {isZero ? 'CLEAR' : status}
         </span>
      </div>
    </div>
  );
};

const DashboardMetric = ({ label, value, theme }: { label: string, value: string, theme: 'orange' | 'red' | 'slate' }) => (
  <div className="bg-slate-50/80 p-6 rounded-[1.8rem] flex flex-col justify-center border border-slate-100/50">
    <p className={`text-[9px] font-black uppercase tracking-widest mb-3 ${
      theme === 'orange' ? 'text-orange-700/60' : 
      theme === 'red' ? 'text-red-700/60' : 
      'text-slate-700/60'
    }`}>{label}</p>
    <p className={`text-4xl font-black tracking-tighter ${
      theme === 'orange' ? 'text-orange-900' : 
      theme === 'red' ? 'text-red-900' : 
      'text-slate-900'
    }`}>{value}</p>
  </div>
);

const AuditMetric = ({ label, value, color }: any) => (
  <div className="bg-slate-50 p-8 rounded-3xl border shadow-inner">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{label}</p>
    <p className={`text-4xl font-black ${color} tracking-tighter`}>{value}</p>
  </div>
);

export default AdminPanel;
