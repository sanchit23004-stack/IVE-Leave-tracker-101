
export enum LeaveType {
  // Planned / Standard Types
  AL = 'Annual Leave',
  SL = 'Sick Leave',
  CL = 'Casual Leave',
  OH = 'Optional Holiday',
  OTHER = 'Mandatory Holiday',
  
  // Unplanned Uncoded Variants
  U_AL = 'Unplanned Uncoded AL',
  U_SL = 'Unplanned Uncoded SL',
  U_CL = 'Unplanned Uncoded CL',
  U_OH = 'Unplanned Uncoded OH',
  U_OTHER = 'Unplanned Uncoded Mandatory'
}

export enum Duration {
  FULL = 1,
  HALF = 0.5
}

export interface LeaveEntry {
  id?: number | string;
  alias: string;
  type: LeaveType | string; 
  date: string; 
  duration: Duration;
  isUncoded: boolean;
  isRegularUnplanned?: boolean; 
  isCoded?: boolean; 
  createdAt: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export type ViewMode = 'DASHBOARD' | 'APPLY' | 'UNCODED' | 'ADMIN' | 'UNPLANNED_UNCODED' | 'REGULAR_UNPLANNED' | 'AUDIT_QUEUE';
