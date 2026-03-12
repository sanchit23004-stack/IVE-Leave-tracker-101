
import { LeaveEntry, Holiday } from './types';

// Updated URL provided by the user
const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbyCBaGJwzH6YAr7_YGdgMDlHY_T_Wzrq3H96uX_RgvENyndsETA6bKEPlouuYsjn-ws/exec';

export class DBService {
  static async addLeave(entry: LeaveEntry): Promise<void> {
    try {
      const payload = { 
        action: 'add', 
        data: { 
          ...entry, 
          isCoded: false,
          'Audit status': 'no'
        } 
      };

      await fetch(SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to save leave entry:', err);
      throw err;
    }
  }

  static async getAllLeaves(): Promise<LeaveEntry[]> {
    try {
      const response = await fetch(`${SHEET_API_URL}?action=get&t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!response.ok) throw new Error('Failed to fetch from cloud');
      const result = await response.json();
      if (!Array.isArray(result)) return [];

      return result.map((row: any) => {
        // Robust check for various possible header names for audit status
        const auditRaw = row['Audit status'] ?? row['Audit Status'] ?? row['auditStatus'] ?? row['isCoded'] ?? row['status'];
        const isCoded = String(auditRaw).toLowerCase() === 'yes' || 
                        String(auditRaw).toLowerCase() === 'true' || 
                        auditRaw === true;

        // CRITICAL: Keep ID as string to preserve precision for long numeric IDs (e.g. 1768...)
        const recordId = (row.id !== undefined && row.id !== "") ? String(row.id) : String(row.createdAt);
        const typeStr = String(row.type || "");

        // Detection for Regular Unplanned using legacy prefix OR new naming
        const isUnplannedCoded = typeStr.startsWith('Unplanned Coded') || typeStr.startsWith('Regular Unplanned');

        return {
          ...row,
          date: String(row.date).substring(0, 10),
          id: recordId, 
          duration: Number(row.duration),
          isUncoded: String(row.isUncoded).toLowerCase() === 'true',
          isRegularUnplanned: String(row.isRegularUnplanned).toLowerCase() === 'true' || isUnplannedCoded,
          isCoded: isCoded,
          createdAt: Number(row.createdAt) || Date.now()
        };
      });
    } catch (err) {
      console.error('Cloud Sync Error:', err);
      return [];
    }
  }

  static async updateLeaveStatus(id: string | number, isCoded: boolean, alias: string, date: string): Promise<void> {
    const statusValue = isCoded ? 'yes' : 'no';
    const idStr = String(id);
    
    console.log(`CloudSync: Dispatching update for ID ${idStr} to ${statusValue}`);
    
    try {
      const payload = { 
        action: 'updateStatus', 
        id: idStr,
        status: statusValue,
        'Audit status': statusValue
      };

      await fetch(SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });
      console.log('CloudSync: Dispatch complete.');
    } catch (err) {
      console.error('CloudSync Error:', err);
      throw err;
    }
  }

  static async deleteLeave(id: string | number): Promise<void> {
    try {
      await fetch(SHEET_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'delete', id: String(id) }),
      });
    } catch (err) {
      console.error('Failed to delete entry:', err);
      throw err;
    }
  }

  static getHolidays(): Holiday[] {
    const saved = localStorage.getItem('ive_holidays_dynamic');
    return saved ? JSON.parse(saved) : [];
  }

  static saveHolidays(holidays: Holiday[]): void {
    localStorage.setItem('ive_holidays_dynamic', JSON.stringify(holidays));
  }
}
