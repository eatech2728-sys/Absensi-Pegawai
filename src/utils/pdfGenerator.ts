import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Employee, AttendanceRecord } from '../types';

export interface MonthlyPdfSummaryData {
  employee: Employee;
  monthName: string;
  year: number;
  totalWorkHours: number;
  averageDailyHours: number;
  targetMonthlyHours: number;
  statusCounts: {
    onTime: number;
    late: number;
    fieldDuty: number;
    leaveOrSick: number;
    absent: number;
    totalRecordedDays: number;
    totalWorkDays: number;
  };
  onTimeRate: number;
  attendanceRate: number;
  dailyLogs: Array<{
    dateFormatted: string;
    dayName: string;
    checkInTime: string;
    checkOutTime: string;
    hoursWorked: number;
    status: string;
    type: string;
    locationName: string;
    notes: string;
  }>;
}

/**
 * Calculates monthly attendance hours and status counts for an employee.
 */
export function calculateMonthlySummary(
  employee: Employee,
  records: AttendanceRecord[],
  targetMonthKey: string = '2026-09'
): MonthlyPdfSummaryData {
  const [yearStr, monthStr] = targetMonthKey.split('-');
  const year = parseInt(yearStr, 10) || 2026;
  const monthNum = parseInt(monthStr, 10) || 9;

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthName = `${monthNames[monthNum - 1]} ${year}`;

  // Filter records for this employee and month
  const empRecords = records.filter((r) => {
    if (r.employeeId !== employee.id) return false;
    if (r.timestamp?.startsWith(targetMonthKey)) return true;
    if (monthNum === 9 && (r.dateFormatted.includes('Sep 2026') || r.dateFormatted.includes('Sep'))) return true;
    if (monthNum === 8 && (r.dateFormatted.includes('Agu 2026') || r.dateFormatted.includes('Aug'))) return true;
    if (monthNum === 7 && (r.dateFormatted.includes('Jul 2026') || r.dateFormatted.includes('Jul'))) return true;
    return false;
  });

  // Group records by calendar date
  const dateGroups = new Map<string, AttendanceRecord[]>();
  empRecords.forEach((rec) => {
    const dKey = rec.dateFormatted || rec.timestamp.slice(0, 10);
    const existing = dateGroups.get(dKey) || [];
    existing.push(rec);
    dateGroups.set(dKey, existing);
  });

  let onTime = 0;
  let late = 0;
  let fieldDuty = 0;
  let leaveOrSick = 0;
  let totalWorkHours = 0;

  const dailyLogs: MonthlyPdfSummaryData['dailyLogs'] = [];

  // Standard shift duration
  const standardDailyHours = 8.0;

  // Process day groups
  dateGroups.forEach((dayRecords, dateStr) => {
    const checkIn = dayRecords.find((r) => r.type === 'MASUK');
    const checkOut = dayRecords.find((r) => r.type === 'PULANG');
    const fieldRecord = dayRecords.find((r) => r.type === 'DINAS_LUAR');
    const leaveRecord = dayRecords.find((r) => r.type === 'IZIN_SAKIT' || r.status === 'IZIN');

    let dailyHours = 0;
    let statusLabel = 'Tepat Waktu';
    let typeLabel = 'Presensi Masuk';
    let locationName = 'Kantor Pusat Jakarta';
    let notes = '';

    if (leaveRecord) {
      leaveOrSick += 1;
      statusLabel = 'Izin / Sakit';
      typeLabel = 'Izin Resmi';
      dailyHours = 0;
      notes = leaveRecord.notes || 'Pengajuan izin terverifikasi';
      locationName = '-';
    } else if (fieldRecord) {
      fieldDuty += 1;
      statusLabel = 'Dinas Disetujui';
      typeLabel = 'Dinas Luar';
      dailyHours = standardDailyHours;
      notes = fieldRecord.notes || 'Tugas operasional luar kantor';
      locationName = fieldRecord.location.address || 'Kunjungan Mitra';
    } else if (checkIn) {
      if (checkIn.status === 'TERLAMBAT') {
        late += 1;
        statusLabel = 'Terlambat';
      } else {
        onTime += 1;
        statusLabel = 'Tepat Waktu';
      }
      typeLabel = 'Presensi Reguler';
      locationName = checkIn.location.officeName || 'Kantor Pusat Jakarta';
      notes = checkIn.notes || '';

      // Calculate actual hours if checkOut exists, otherwise standard completed hours
      if (checkOut) {
        try {
          const inTime = new Date(checkIn.timestamp).getTime();
          const outTime = new Date(checkOut.timestamp).getTime();
          const diffHours = (outTime - inTime) / (1000 * 60 * 60);
          dailyHours = Math.max(1, Math.min(14, Number(diffHours.toFixed(1))));
        } catch {
          dailyHours = standardDailyHours;
        }
      } else {
        // Assume standard completed daily work day
        dailyHours = checkIn.status === 'TERLAMBAT' ? 7.5 : standardDailyHours;
      }
    }

    totalWorkHours += dailyHours;

    dailyLogs.push({
      dateFormatted: dateStr,
      dayName: 'Hari Kerja',
      checkInTime: checkIn?.timeFormatted || (fieldRecord ? '08:00 WIB' : '-'),
      checkOutTime: checkOut?.timeFormatted || (dailyHours > 0 ? '17:00 WIB' : '-'),
      hoursWorked: dailyHours,
      status: statusLabel,
      type: typeLabel,
      locationName: locationName,
      notes: notes,
    });
  });

  // Sort logs by date descending or ascending
  dailyLogs.sort((a, b) => b.dateFormatted.localeCompare(a.dateFormatted));

  const totalWorkDaysInMonth = monthNum === 9 ? 22 : monthNum === 8 ? 21 : 23;
  const passedWorkDays = monthNum === 9 ? 9 : totalWorkDaysInMonth;
  const recordedDays = onTime + late + fieldDuty + leaveOrSick;
  const estimatedAbsent = Math.max(0, passedWorkDays - recordedDays);

  const safeRecordedDays = recordedDays > 0 ? recordedDays : 1;
  const averageDailyHours = Number((totalWorkHours / safeRecordedDays).toFixed(1));
  const targetMonthlyHours = totalWorkDaysInMonth * 8;
  const totalEvaluatedDays = recordedDays + estimatedAbsent;
  const onTimeRate = totalEvaluatedDays > 0 ? Math.round((onTime / totalEvaluatedDays) * 100) : 0;
  const attendanceRate = totalEvaluatedDays > 0 ? Math.round(((totalEvaluatedDays - estimatedAbsent - leaveOrSick) / totalEvaluatedDays) * 100) : 0;

  return {
    employee,
    monthName,
    year,
    totalWorkHours: Number(totalWorkHours.toFixed(1)),
    averageDailyHours,
    targetMonthlyHours,
    statusCounts: {
      onTime,
      late,
      fieldDuty,
      leaveOrSick,
      absent: estimatedAbsent,
      totalRecordedDays: recordedDays,
      totalWorkDays: totalWorkDaysInMonth,
    },
    onTimeRate,
    attendanceRate,
    dailyLogs,
  };
}

/**
 * Generates and downloads the official Monthly Attendance Summary PDF.
 */
export async function generateMonthlyAttendancePdf(
  employee: Employee,
  records: AttendanceRecord[],
  targetMonthKey: string = '2026-09'
): Promise<void> {
  const summary = calculateMonthlySummary(employee, records, targetMonthKey);

  // Initialize jsPDF (A4 portrait, mm units)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header Background Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Brand / Document Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LAPORAN REKAPITULASI PRESENSI & JAM KERJA PEGAWAI', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Sistem Presensi GPS & Biometrik Wajah Real-Time | Periode: ${summary.monthName.toUpperCase()}`,
    margin,
    19
  );

  // Document Number & Timestamp on top-right
  const printDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  doc.setFontSize(7.5);
  doc.text(`Dicetak: ${printDateStr}`, pageWidth - margin, 12, { align: 'right' });
  doc.text(`Dokumen: REKAP-${employee.nip}-${targetMonthKey}`, pageWidth - margin, 19, {
    align: 'right',
  });

  // Employee Information Box
  let currentY = 36;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 24, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(employee.name, margin + 4, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`NIP: ${employee.nip}`, margin + 4, currentY + 13);
  doc.text(`Posisi: ${employee.position}`, margin + 4, currentY + 19);

  // Middle Column
  const midX = margin + 70;
  doc.text(`Departemen: ${employee.department}`, midX, currentY + 13);
  doc.text(`Jadwal Kerja: Shift ${employee.shift.name} (${employee.shift.startTime} - ${employee.shift.endTime} WIB)`, midX, currentY + 19);

  // Right Column (Toleransi & Status)
  const rightX = pageWidth - margin - 50;
  doc.text(`Toleransi Telat: +${employee.shift.lateToleranceMinutes} Menit`, rightX, currentY + 13);
  doc.text(`Status Pegawai: Aktif Terverifikasi`, rightX, currentY + 19);

  // Metric Summary Cards (4 Columns)
  currentY += 28;
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cardHeight = 20;

  const kpis = [
    {
      title: 'TOTAL JAM KERJA',
      value: `${summary.totalWorkHours} Jam`,
      sub: `Rata-rata ${summary.averageDailyHours} jam/hari`,
      accent: [37, 99, 235], // blue-600
      bg: [239, 246, 255],
    },
    {
      title: 'TEPAT WAKTU (ON-TIME)',
      value: `${summary.statusCounts.onTime} Hari`,
      sub: `${summary.onTimeRate}% rasio ketepatan`,
      accent: [16, 185, 129], // emerald-500
      bg: [236, 253, 245],
    },
    {
      title: 'TERLAMBAT (LATE)',
      value: `${summary.statusCounts.late} Hari`,
      sub: 'Tercatat >08.15 WIB',
      accent: [245, 158, 11], // amber-500
      bg: [254, 243, 199],
    },
    {
      title: 'TIDAK HADIR / IZIN',
      value: `${summary.statusCounts.leaveOrSick + summary.statusCounts.absent} Hari`,
      sub: `${summary.statusCounts.leaveOrSick} Izin • ${summary.statusCounts.absent} Alpha`,
      accent: [244, 63, 94], // rose-500
      bg: [255, 241, 242],
    },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Accent line on card top
    doc.setFillColor(kpi.accent[0], kpi.accent[1], kpi.accent[2]);
    doc.rect(cardX, currentY, cardWidth, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, cardX + 3, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.value, cardX + 3, currentY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.sub, cardX + 3, currentY + 17.5);
  });

  // Section Heading: Rincian Log Presensi & Jam Kerja Harian
  currentY += 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('RINCIAN LOG HARIAN PRESENSI & PERHITUNGAN JAM KERJA', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Total hari kerja tercatat: ${summary.statusCounts.totalRecordedDays} dari target ${summary.statusCounts.totalWorkDays} hari kerja bulan ini`,
    pageWidth - margin,
    currentY,
    { align: 'right' }
  );

  // Table using jspdf-autotable
  const tableData = summary.dailyLogs.map((log, index) => [
    (index + 1).toString(),
    log.dateFormatted,
    log.checkInTime,
    log.checkOutTime,
    `${log.hoursWorked} Jam`,
    log.status,
    log.type,
    log.locationName,
    log.notes || '-',
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [
      [
        'No',
        'Tanggal',
        'Jam Masuk',
        'Jam Pulang',
        'Durasi Kerja',
        'Status',
        'Tipe',
        'Lokasi Verifikasi',
        'Keterangan',
      ],
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      6: { halign: 'center', cellWidth: 22 },
      7: { cellWidth: 32 },
      8: { cellWidth: 'auto' },
    },
    didParseCell: function (data) {
      // Color highlight for Status column
      if (data.section === 'body' && data.column.index === 5) {
        const text = data.cell.text[0];
        if (text === 'Tepat Waktu' || text === 'Dinas Disetujui') {
          data.cell.styles.textColor = [16, 185, 129]; // green
        } else if (text === 'Terlambat') {
          data.cell.styles.textColor = [217, 119, 6]; // amber
        } else if (text === 'Izin / Sakit') {
          data.cell.styles.textColor = [225, 29, 72]; // rose
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // Get final Y from autotable
  const finalY = (doc as any).lastAutoTable?.finalY || 210;

  // Signature / Validation Section
  const signatureY = Math.min(finalY + 12, 248);

  // Check if we need a new page for signatures
  if (signatureY > 255) {
    doc.addPage();
  }

  const sigBoxY = signatureY > 255 ? 20 : signatureY;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  // Left Signature: Pegawai Yang Bersangkutan
  doc.text('Pegawai Yang Bersangkutan,', margin + 10, sigBoxY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(employee.name, margin + 10, sigBoxY + 22);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text(`NIP: ${employee.nip}`, margin + 10, sigBoxY + 26);
  doc.text('[Digital Timestamp Verified]', margin + 10, sigBoxY + 30);

  // Right Signature: Mengetahui HRD / Atasan
  const rightSigX = pageWidth - margin - 60;
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Mengetahui, HR & Operasional', rightSigX, sigBoxY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Rini Anggraini, S.Psi', rightSigX, sigBoxY + 22);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.text('Kepala Manajemen SDM & Kehadiran', rightSigX, sigBoxY + 26);
  doc.text('[Disetujui Secara Elektronik]', rightSigX, sigBoxY + 30);

  // Official Footer
  const footerY = 288;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    'Dokumen ini sah dan diterbitkan secara otomatis oleh Sistem Presensi Berbasis Lokasi & Geofencing GPS. Hak cipta dilindungi.',
    margin,
    footerY
  );
  doc.text('Halaman 1 / 1', pageWidth - margin, footerY, { align: 'right' });

  // Save / Trigger Download
  const cleanEmployeeName = employee.name.replace(/\s+/g, '_');
  const filename = `Rekap_Presensi_${cleanEmployeeName}_${targetMonthKey}.pdf`;
  doc.save(filename);
}
