import { AttendanceRecord, Employee } from '../types';

export interface CsvExportOptions {
  employeeOnly?: boolean;
  currentEmployee?: Employee;
  filteredOnly?: boolean;
}

/**
 * Clean and escape CSV cells to prevent delimiter conflicts and formula injection
 */
function escapeCsvCell(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Neutralize formula injection in Excel/Calc if starts with =, +, -, @
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  // Escape inner double quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Formats attendance records into standard RFC 4180 CSV with UTF-8 BOM for Microsoft Excel compatibility
 */
export function exportAttendanceToCsv(
  records: AttendanceRecord[],
  options?: CsvExportOptions
): { filename: string; count: number } {
  let targetRecords = [...records];

  // If filtered for personal tracking of the active employee
  if (options?.employeeOnly && options.currentEmployee) {
    targetRecords = targetRecords.filter(
      (r) => r.employeeId === options.currentEmployee?.id || r.nip === options.currentEmployee?.nip
    );
  }

  if (targetRecords.length === 0) {
    return { filename: '', count: 0 };
  }

  const headers = [
    'ID Presensi',
    'Nama Pegawai',
    'NIP',
    'Departemen',
    'Tanggal',
    'Waktu Presensi',
    'Tipe Presensi',
    'Status Presensi',
    'Status Sinkronisasi',
    'Kantor Target',
    'Jarak ke Kantor (m)',
    'Status Radius',
    'Latitude',
    'Longitude',
    'Akurasi GPS (m)',
    'Alamat Lokasi',
    'Perangkat',
    'Verifikasi Biometrik',
    'Catatan / Alasan',
  ];

  const rows = targetRecords.map((r) => [
    escapeCsvCell(r.id),
    escapeCsvCell(r.employeeName),
    escapeCsvCell(r.nip),
    escapeCsvCell(r.department),
    escapeCsvCell(r.dateFormatted),
    escapeCsvCell(r.timeFormatted),
    escapeCsvCell(r.type),
    escapeCsvCell(r.status.replace(/_/g, ' ')),
    escapeCsvCell(r.syncStatus === 'OFFLINE_PENDING' ? 'Antrian Offline (Pending)' : 'Tersinkronisasi Server'),
    escapeCsvCell(r.location.officeName),
    escapeCsvCell(r.location.distanceToOffice),
    escapeCsvCell(r.location.isWithinRadius ? 'Dalam Radius' : 'Luar Radius'),
    escapeCsvCell(r.location.latitude),
    escapeCsvCell(r.location.longitude),
    escapeCsvCell(r.location.accuracy),
    escapeCsvCell(r.location.address || '-'),
    escapeCsvCell(r.deviceInfo || '-'),
    escapeCsvCell(
      r.biometricVerification?.verified
        ? r.biometricVerification.method === 'WEBAUTHN_BIOMETRIC'
          ? `WebAuthn (${r.biometricVerification.authenticatorLabel || 'Perangkat'})`
          : 'Simulasi Biometrik'
        : 'Tidak Ada'
    ),
    escapeCsvCell(r.notes || '-'),
  ]);

  // Include UTF-8 BOM (\uFEFF) so Excel on Windows & Mac automatically opens with proper Indonesian accented characters
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const todayStr = new Date().toISOString().slice(0, 10);
  const employeeTag = options?.currentEmployee ? `_${options.currentEmployee.name.replace(/\s+/g, '_')}` : '';
  const filename = `Catatan_Presensi${employeeTag}_${todayStr}.csv`;

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { filename, count: targetRecords.length };
}
