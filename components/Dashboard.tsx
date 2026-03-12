
import React, { useState, useMemo, useEffect } from 'react';
import { LeaveEntry, Holiday } from '../types';
import { MAX_DAILY_UNITS } from '../constants';

interface DashboardProps {
  leaves: LeaveEntry[];
  holidays: Holiday[];
  onRefresh: () => void;
  onApplyLeave: (date: string) => void;
  initialViewDate?: Date;
  lastSync?: string;
  isAdmin?: boolean;
  onDeleteLeave?: (id: number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ leaves, holidays, onRefresh, onApplyLeave, initialViewDate, lastSync, isAdmin, onDeleteLeave }) => {
  const [currentDate, setCurrentDate] = useState(initialViewDate || new Date()); 
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (initialViewDate) setCurrentDate(initialViewDate);
  }, [initialViewDate]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const days = [];
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = new Date(year, month, 1).getDay();

    for (let i = 0; i < startOffset; i++) days.push(null);

    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayLeaves = leaves.filter(l => l.date === dateStr);
      const units = dayLeaves.reduce((sum, l) => sum + l.duration, 0);
      const holiday = holidays.find(h => h.date === dateStr);
      
      days.push({ date: dateStr, day: i, units, holiday, leaves: dayLeaves });
    }
    return days;
  }, [year, month, leaves, holidays]);

  const selectedDayInfo = useMemo(() => calendarDays.find(d => d?.date === selectedDate), [selectedDate, calendarDays]);

  const displayDateHeader = useMemo(() => {
    if (!selectedDate) return 'Select a Date';
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [selectedDate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-3xl shadow-sm border p-8">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">{monthNames[month]} {year}</h2>
            <div className="flex gap-3">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-3 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all text-slate-900"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg></button>
              <button onClick={onRefresh} className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 transition-all hover:scale-110 active:rotate-180" title="Sync Data"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-3 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all text-slate-900"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-3">{d}</div>
            ))}
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={idx} className="h-28 bg-slate-50/20 rounded-2xl border border-transparent"></div>;
              const isFull = day.units >= MAX_DAILY_UNITS;
              const isSelected = selectedDate === day.date;
              return (
                <div key={day.date} onClick={() => setSelectedDate(day.date)} className={`h-28 p-3 border-2 rounded-2xl cursor-pointer transition-all flex flex-col justify-between ${day.holiday ? 'bg-indigo-50 border-indigo-100' : isFull ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'} ${isSelected ? 'border-blue-500 scale-105 z-10 shadow-lg' : ''}`}>
                  <div className="flex justify-between items-start">
                    <span className={`text-base font-black ${day.holiday ? 'text-indigo-700' : 'text-slate-900'}`}>{day.day}</span>
                    {day.holiday && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></div>}
                  </div>
                  {day.units > 0 && <span className={`text-[9px] px-2 py-1 rounded-lg font-black text-white self-end ${isFull ? 'bg-red-600' : 'bg-blue-600'}`}>{day.units.toFixed(1)}u</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-xl border p-8 flex flex-col min-h-[500px]">
        <h3 className="text-xl font-black mb-8 border-b pb-6 flex items-center gap-3 text-slate-900">
          <div className="p-2 bg-blue-50 rounded-xl"><svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
          {displayDateHeader}
        </h3>
        {!selectedDayInfo ? (
          <div className="flex-grow flex items-center justify-center text-slate-300 font-black uppercase text-xs">Select a day</div>
        ) : (
          <div className="flex flex-grow flex-col">
            <div className="flex-grow space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
              {selectedDayInfo.holiday && <div className="p-5 bg-indigo-50 text-indigo-700 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest border border-indigo-100">Official Holiday: {selectedDayInfo.holiday.name}</div>}
              {selectedDayInfo.leaves.map(l => (
                <div key={l.id} className="p-5 border-2 rounded-[1.5rem] border-slate-50 hover:border-blue-100 group transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-slate-800">{l.alias}</span>
                    <span className="text-[8px] font-black uppercase bg-slate-100 px-2.5 py-1 rounded-full text-slate-600">{l.duration === 1 ? 'Full Day' : 'Half Day'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{l.type}</p>
                    {isAdmin && <button onClick={() => onDeleteLeave?.(l.id!)} className="text-[9px] text-red-500 font-black uppercase hover:underline">Revoke</button>}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => onApplyLeave(selectedDate!)} disabled={selectedDayInfo.units >= MAX_DAILY_UNITS && !isAdmin} className="mt-8 w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs disabled:bg-slate-50 disabled:text-slate-300">Apply for Leave</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
