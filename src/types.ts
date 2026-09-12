export interface Employee {
  id: string;
  name: string;
  nip: string;
  department: string;
  position: string;
  avatarUrl: string;
  shift: {
    name: string;
    startTime: string; // "08:00"
    endTime: string;   // "17:00"
    lateToleranceMinutes: number; // 15
  };
}

export interface OfficeLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isCustom?: boolean;
}

export type AttendanceType = 'MASUK' | 'PULANG' | 'DINAS_LUAR' | 'IZIN_SAKIT' | 'ALPHA';

export type AttendanceStatus = 'TEPAT_WAKTU' | 'TERLAMBAT' | 'PULANG_CEPAT' | 'PULANG_NORMAL' | 'DISETUJUI' | 'TIDAK_HADIR' | 'IZIN';

export type SyncStatus = 'ONLINE_SYNCED' | 'OFFLINE_PENDING' | 'SYNCING';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  nip: string;
  department: string;
  timestamp: string; // ISO string
  dateFormatted: string;
  timeFormatted: string;
  type: AttendanceType;
  status: AttendanceStatus;
  photoUrl: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    address: string;
    distanceToOffice: number; // in meters
    isWithinRadius: boolean;
    officeName: string;
  };
  notes?: string;
  deviceInfo: string;
  syncStatus?: SyncStatus;
  offlineQueuedAt?: string;
  syncedAt?: string;
  biometricVerification?: {
    verified: boolean;
    method: 'WEBAUTHN_BIOMETRIC' | 'BIOMETRIC_SIMULATION';
    credentialId?: string;
    verifiedAt: string;
    authenticatorLabel?: string;
  };
}

export interface WebAuthnCredentialRecord {
  credentialId: string;
  rawIdBase64: string;
  employeeId: string;
  employeeNip: string;
  employeeName: string;
  registeredAt: string;
  transports?: string[];
  deviceLabel?: string;
}

export interface QueuedAttendanceItem {
  queueId: string;
  record: AttendanceRecord;
  queuedAt: string;
  retryAttempts: number;
}

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string;
  timestamp: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';
