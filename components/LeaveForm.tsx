
import React, { useState, useEffect } from 'react';
import { LeaveType, Duration, LeaveEntry } from '../types';
import { DBService } from '../database';
import { MAX_DAILY_UNITS, ALLOWED_ALIASES } from '../constants';

interface LeaveFormProps {
  leaves: LeaveEntry[];
  onSuccess: (date: string) => void;
  isUncoded: boolean;
  isUnplanned?: boolean;
  isRegularUnplanned?: boolean;
  isAdmin: boolean;
  initialDate: string;
}

const LeaveForm: React.FC<LeaveFormProps> = ({ leaves, onSuccess, isUncoded, isUnplanned, isRegularUnplanned, isAdmin, initialDate }) => {
  const [alias, setAlias] = useState('');
  const [type, setType] = useState<LeaveType>(isUnplanned ? LeaveType.U_SL : LeaveType.AL);
  const [duration, setDuration] = useState<Duration>(Duration.FULL);
  const [date, setDate] = useState(initialDate);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  useEffect(() => {
    setType(isUnplanned ? LeaveType.U_SL : LeaveType.AL);
  }, [isUnplanned]);

  const validate = () => {
    const trimmedAlias = alias.trim().toLowerCase();
    if (!trimmedAlias) return "Alias is required";

    // Enforce whitelist restriction
    if (!ALLOWED_ALIASES.includes(trimmedAlias)) {
      return `Unauthorized Alias: "${alias}" is not permitted to submit leave requests.`;
    }

    if (!date) return "Please select a date";

    // Prevent duplicate entries for the same alias on the same day
    const hasDuplicate = leaves.some(
      (l) => l.alias.toLowerCase() === trimmedAlias && l.date === date
    );
    if (hasDuplicate) {
      return `Duplicate Entry Detected: "${alias}" already has a logged absence for ${date}. Double entries are not permitted.`;
    }

    if (isAdmin) return null;

    // Helper functions for type detection
    const isCasual = (t: string) => t.includes('Casual Leave') || t.endsWith('CL');
    const isSick = (t: string) => t.includes('Sick Leave') || t.endsWith('SL');
    const isAnnual = (t: string) => t.includes('Annual Leave') || t.endsWith('AL');
    const isSickOrAnnual = (t: string) => isSick(t) || isAnnual(t);
    const isCLorSL = (t: string) => isCasual(t) || isSick(t);

    const currentTypeStr = type.toString();

    // Same-day Sick Leave restriction: Must use Unplanned Dashboard for today's sick leave
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (!isUnplanned && !isRegularUnplanned && isSick(currentTypeStr) && date === todayStr) {
      return "Policy Restriction: Sick Leave for today must be submitted via the Unplanned Dashboard (Coded or Uncoded). Standard submission is not permitted for same-day sick leave.";
    }

    // Date math helpers
    const getDateAtOffset = (baseDateStr: string, offset: number) => {
      const [y, m, d] = baseDateStr.split('-').map(Number);
      const obj = new Date(y, m - 1, d + offset);
      const year = obj.getFullYear();
      const month = String(obj.getMonth() + 1).padStart(2, '0');
      const day = String(obj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Rule: No Sick Leave (SL) or Annual Leave (AL) adjacent to Casual Leave (CL)
    if (isCasual(currentTypeStr) || isSickOrAnnual(currentTypeStr)) {
      const prevStr = getDateAtOffset(date, -1);
      const nextStr = getDateAtOffset(date, 1);

      const adjacentLeaves = leaves.filter(l => 
        l.alias.toLowerCase() === trimmedAlias && 
        (l.date === prevStr || l.date === nextStr)
      );

      for (const adj of adjacentLeaves) {
        const adjTypeStr = adj.type.toString();
        if (isCasual(currentTypeStr) && isSickOrAnnual(adjTypeStr)) {
          return `Leave Policy Violation: Casual Leave (CL) cannot be adjacent to Sick or Annual Leave. Found a record on ${adj.date}.`;
        }
        if (isSickOrAnnual(currentTypeStr) && isCasual(adjTypeStr)) {
          return `Leave Policy Violation: Sick or Annual Leave cannot be adjacent to Casual Leave (CL). Found CL record on ${adj.date}.`;
        }
      }
    }

    // Rule: Max 2 consecutive days of CL or SL
    if (isCLorSL(currentTypeStr)) {
      const dMinus1 = getDateAtOffset(date, -1);
      const dMinus2 = getDateAtOffset(date, -2);
      const dPlus1 = getDateAtOffset(date, 1);
      const dPlus2 = getDateAtOffset(date, 2);

      const checkEntry = (dateStr: string) => 
        leaves.find(l => l.alias.toLowerCase() === trimmedAlias && l.date === dateStr && isCLorSL(l.type.toString()));

      const hasM1 = checkEntry(dMinus1);
      const hasM2 = checkEntry(dMinus2);
      const hasP1 = checkEntry(dPlus1);
      const hasP2 = checkEntry(dPlus2);

      // Case 1: [M2, M1, Current]
      if (hasM1 && hasM2) {
        return `Consecutive Limit Violated: You cannot take more than 2 consecutive days of CL/SL. Records found on ${dMinus2} and ${dMinus1}.`;
      }
      // Case 2: [Current, P1, P2]
      if (hasP1 && hasP2) {
        return `Consecutive Limit Violated: You cannot take more than 2 consecutive days of CL/SL. Records found on ${dPlus1} and ${dPlus2}.`;
      }
      // Case 3: [M1, Current, P1]
      if (hasM1 && hasP1) {
        return `Consecutive Limit Violated: Adding this entry creates a 3-day streak of CL/SL (${dMinus1} to ${dPlus1}). Max allowed is 2 days.`;
      }
    }

    if (!isUncoded && !isUnplanned && !isRegularUnplanned && !type.toString().startsWith('U_')) {
      const [y, m, d] = date.split('-').map(Number);
      const selectedDateObj = new Date(y, m - 1, d);
      const today = new Date();
      today.setHours(0,0,0,0);
      const diffDays = Math.ceil((selectedDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (type === LeaveType.AL && diffDays < 15) {
        return "Annual Leave (AL) requires at least 15 days advance notice.";
      }
      if ((type === LeaveType.CL || type === LeaveType.OH) && diffDays < 5) {
        return `${type} requires at least 5 days advance notice.`;
      }
      if (type === LeaveType.OTHER && diffDays < 5) {
        return "Mandatory Holiday requires at least 5 days advance notice.";
      }

      const currentUnitsOnDate = leaves
        .filter(l => l.date === date)
        .reduce((sum, l) => sum + l.duration, 0);
      
      if (currentUnitsOnDate + duration > MAX_DAILY_UNITS) {
        return `Daily capacity limit of ${MAX_DAILY_UNITS} units reached for this date.`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setIsSubmitting(true);
    try {
      const isActuallyUnplanned = isUnplanned || type.toString().startsWith('U_');
      
      // Prepend prefix for Unplanned Coded (formerly Regular Unplanned) entries
      let finalType: string = type;
      if (isRegularUnplanned) {
        finalType = `Unplanned Coded ${type}`;
      }

      await DBService.addLeave({
        alias: alias.trim(),
        type: finalType,
        date,
        duration,
        isUncoded: isUncoded || isActuallyUnplanned,
        isRegularUnplanned: isRegularUnplanned || false,
        isCoded: false,
        createdAt: Date.now()
      });
      onSuccess(date);
    } catch (err) {
      setError("Sync error. Please check your connection.");
      setIsSubmitting(false);
    }
  };

  const options = Object.entries(LeaveType).filter(([key]) => {
    const isU = key.startsWith('U_');
    return isUnplanned ? isU : !isU;
  });

  const theme = isUnplanned ? 'red' : isRegularUnplanned ? 'purple' : isUncoded ? 'orange' : 'blue';

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-6 duration-500">
      <div className={`bg-white rounded-[2.5rem] shadow-2xl border-4 p-12 transition-all ${isUnplanned ? 'border-red-50' : isRegularUnplanned ? 'border-purple-50' : isUncoded ? 'border-orange-50' : 'border-blue-50'}`}>
        <div className="mb-10">
          <div className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 ${isUnplanned ? 'bg-red-100 text-red-700' : isRegularUnplanned ? 'bg-purple-100 text-purple-700' : isUncoded ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
            {isUnplanned ? 'Urgent Unplanned Uncoded Protocol' : isRegularUnplanned ? 'Unplanned Authorized Coded Entry' : isUncoded ? 'Manual Audit Mode (Override)' : 'Standard Leave Request'}
          </div>
          <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tighter">
            {isUnplanned ? 'Report Unplanned' : isRegularUnplanned ? 'Log Unplanned Coded' : isUncoded ? 'Log Planned Uncoded' : 'Schedule Leave'}
          </h2>
          <p className="text-slate-400 text-sm font-medium">
            {isUnplanned 
              ? 'Use this for immediate, unexpected absences requiring audit.' 
              : isRegularUnplanned
                ? 'Authorized unplanned leave using standard categories.'
                : isUncoded 
                  ? 'Standard types logged for manual coding/audit.' 
                  : 'Plan your upcoming time off with standard verification.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-3 tracking-widest ml-1">Employee Alias</label>
              <input type="text" value={alias} onChange={(e) => setAlias(e.target.value)} className={`w-full px-8 py-5 rounded-2xl border-2 border-slate-50 bg-slate-50 text-slate-900 font-black outline-none focus:bg-white focus:border-${theme}-600 shadow-inner`} placeholder="Enter authorized alias" required />
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-3 tracking-widest ml-1">Leave Category</label>
              <select value={type} onChange={(e) => setType(e.target.value as LeaveType)} className={`w-full px-8 py-5 rounded-2xl border-2 border-slate-50 bg-slate-50 text-slate-900 font-black outline-none focus:bg-white focus:border-${theme}-600 appearance-none shadow-inner`}>
                {options.map(([key, val]) => <option key={key} value={val}>{val}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-3 tracking-widest ml-1">Absence Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`w-full px-8 py-5 rounded-2xl border-2 border-slate-50 bg-slate-50 text-slate-900 font-black outline-none focus:bg-white focus:border-${theme}-600 block h-[68px] shadow-inner`} required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-3 tracking-widest ml-1">Duration Weight</label>
              <div className="flex gap-6">
                {[Duration.FULL, Duration.HALF].map(d => (
                  <button key={d} type="button" onClick={() => setDuration(d)} className={`flex-1 py-5 rounded-2xl border-2 font-black transition-all text-xs tracking-widest uppercase ${duration === d ? (isUnplanned ? 'bg-red-600 border-red-600 text-white' : isRegularUnplanned ? 'bg-purple-600 border-purple-600 text-white' : isUncoded ? 'bg-orange-600 border-orange-600 text-white' : 'bg-slate-900 text-white border-slate-900') : 'bg-slate-50 text-slate-400 border-slate-50'}`}>
                    {d === 1 ? 'Full Day (1.0u)' : 'Half Day (0.5u)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error && <div className="p-6 bg-red-50 border-2 border-red-100 rounded-3xl text-xs text-red-700 font-black uppercase tracking-widest leading-loose">{error}</div>}
          <button type="submit" disabled={isSubmitting} className={`w-full py-6 rounded-3xl font-black text-white shadow-2xl transition-all uppercase tracking-[0.3em] text-xs ${isUnplanned ? 'bg-red-600 hover:bg-red-700' : isRegularUnplanned ? 'bg-purple-600 hover:bg-purple-700' : isUncoded ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isSubmitting ? 'Processing...' : 'Confirm Entry'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LeaveForm;
