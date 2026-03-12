
import React, { useState, useMemo } from 'react';
import { LeaveEntry, LeaveType } from '@/types';

interface UnplannedDashboardProps {
  leaves: LeaveEntry[];
  onRefresh: () => void;
}

const UnplannedDashboard: React.FC<UnplannedDashboardProps> = ({ leaves, onRefresh }) => {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [teamSize] = useState(() => {
    const saved = localStorage.getItem('ive_team_size');
    return saved ? parseInt(saved, 10) : 15;
  });

  const stats = useMemo(() => {
    const filtered = leaves.filter(l => {
      const isDateInRange = l.date >= fromDate && l.date <= toDate;
      const typeStr = l.type.toString();
      const isRegularUnplanned = typeStr.startsWith('Regular Unplanned') || !!l.isRegularUnplanned;
      const isUnplannedUncoded = typeStr.includes('Unplanned Uncoded') && !isRegularUnplanned;
      return isDateInRange && (isUnplannedUncoded || isRegularUnplanned);
    });

    const start = new Date(fromDate);
    const end = new Date(toDate);
    const days = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const capacity = teamSize * days;
    const units = filtered.reduce((s, l) => s + l.duration, 0);
    const ids = new Set(filtered.map(l => l.alias.toLowerCase())).size;

    const personnelMap: Record<string, { count: number, units: number }> = {};
    filtered.forEach(l => {
      if (!personnelMap[l.alias]) personnelMap[l.alias] = { count: 0, units: 0 };
      personnelMap[l.alias].count++;
      personnelMap[l.alias].units += l.duration;
    });

    const topAbsentees = Object.entries(personnelMap)
      .sort((a, b) => b[1].units - a[1].units)
      .slice(0, 5);

    return { 
      filtered, 
      units, 
      percent: capacity > 0 ? (units / capacity) * 100 : 0, 
      ids, 
      logs: filtered.length,
      topAbsentees,
      capacity 
    };
  }, [leaves, fromDate, toDate, teamSize]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      {/* HEADER CONTROLS */}
      <div className="bg-white rounded-3xl p-8 border shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
         <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Unplanned Analysis</h2>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mt-1">Range Query: Regular + Unplanned Uncoded</p>
         </div>
         <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border">
            <div className="flex flex-col">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">From</span>
               <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-white border rounded-xl px-4 py-2 text-xs font-black outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <div className="flex flex-col">
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">To</span>
               <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-white border rounded-xl px-4 py-2 text-xs font-black outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            <button onClick={onRefresh} className="p-4 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
         </div>
      </div>

      {/* THE RED DASHBOARD CARD FROM IMAGE */}
      <div className="bg-red-600 rounded-[3rem] p-1 shadow-2xl border-4 border-white max-w-4xl mx-auto">
         <div className="p-8 pb-12 flex items-center justify-between text-white">
            <div className="flex items-center gap-5">
               <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
               </div>
               <div>
                  <h3 className="text-3xl font-black tracking-tighter">Unplanned Uncoded</h3>
                  <p className="text-red-200 font-black text-[10px] uppercase tracking-[0.2em]">Urgent Absence Tracking</p>
               </div>
            </div>
            <div className="px-5 py-2.5 bg-white/10 border border-white/20 rounded-full text-[9px] font-black tracking-widest uppercase backdrop-blur-sm">Reactive Leave</div>
         </div>
         <div className="bg-white rounded-[2.5rem] p-4 grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-8 rounded-[2rem] flex flex-col justify-center">
               <p className="text-[9px] font-black text-red-700/60 uppercase tracking-widest mb-3">Impact Percent</p>
               <p className="text-5xl font-black text-red-900 tracking-tighter">{stats.percent.toFixed(2)}%</p>
            </div>
            <div className="bg-slate-50 p-8 rounded-[2rem] flex flex-col justify-center">
               <p className="text-[9px] font-black text-red-700/60 uppercase tracking-widest mb-3">Total Units</p>
               <p className="text-5xl font-black text-red-900 tracking-tighter">{stats.units.toFixed(1)}u</p>
            </div>
            <div className="bg-slate-50 p-8 rounded-[2rem] flex flex-col justify-center">
               <p className="text-[9px] font-black text-red-700/60 uppercase tracking-widest mb-3">Personnel Usage</p>
               <p className="text-5xl font-black text-red-900 tracking-tighter">{stats.ids} IDs</p>
            </div>
            <div className="bg-slate-50 p-8 rounded-[2rem] flex flex-col justify-center">
               <p className="text-[9px] font-black text-red-700/60 uppercase tracking-widest mb-3">Entry Frequency</p>
               <p className="text-5xl font-black text-red-900 tracking-tighter">{stats.logs} Logs</p>
            </div>
         </div>
      </div>

      {/* FREQUENCY LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white rounded-[3rem] p-10 shadow-sm border">
            <h3 className="text-2xl font-black mb-8 text-slate-900">Top Frequency Personnel</h3>
            <div className="space-y-4">
               {stats.topAbsentees.map(([alias, data], idx) => (
                  <div key={alias} className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border group transition-all">
                     <div className="flex items-center gap-6">
                        <span className="text-2xl font-black text-slate-200 group-hover:text-red-100 transition-colors">#{idx + 1}</span>
                        <div>
                           <p className="text-lg font-black text-slate-900">{alias}</p>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{data.count} Occurrences</p>
                        </div>
                     </div>
                     <p className="text-2xl font-black text-red-600">{data.units.toFixed(1)}U</p>
                  </div>
               ))}
            </div>
         </div>

         <div className="bg-white rounded-[3rem] p-10 shadow-sm border">
            <h3 className="text-2xl font-black mb-8 text-slate-900">Recent Reactive Logs</h3>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
               {stats.filtered.slice(0, 15).map(l => (
                  <div key={l.id} className="p-5 border-b flex items-center justify-between">
                     <div>
                        <p className="text-sm font-black text-slate-900">{l.alias}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{l.date} • {l.type}</p>
                     </div>
                     <span className="text-xs font-black text-red-600">-{l.duration.toFixed(1)}U</span>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default UnplannedDashboard;
