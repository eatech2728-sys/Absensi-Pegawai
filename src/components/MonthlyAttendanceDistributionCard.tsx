import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  UserX,
  Briefcase,
  PieChart as PieChartIcon,
  BarChart2,
  Calendar,
  Sparkles,
  Award,
  FileDown,
  Check,
  Timer,
} from 'lucide-react';
import { AttendanceRecord, Employee } from '../types';
import { generateMonthlyAttendancePdf, calculateMonthlySummary } from '../utils/pdfGenerator';

interface MonthlyAttendanceDistributionCardProps {
  currentEmployee: Employee;
  records: AttendanceRecord[];
  className?: string;
}

type ChartViewType = 'donut' | 'bar';

interface DistributionItem {
  id: string;
  name: string;
  shortLabel: string;
  count: number;
  percentage: number;
  color: string;
  bgLight: string;
  textColor: string;
  borderColor: string;
  icon: React.ReactNode;
  description: string;
}

// Available months for filtering
const AVAILABLE_MONTHS = [
  { key: '2026-09', label: 'September 2026', totalWorkDays: 22, passedWorkDays: 9 },
  { key: '2026-08', label: 'Agustus 2026', totalWorkDays: 21, passedWorkDays: 21 },
  { key: '2026-07', label: 'Juli 2026', totalWorkDays: 23, passedWorkDays: 23 },
];

export const MonthlyAttendanceDistributionCard: React.FC<MonthlyAttendanceDistributionCardProps> = ({
  currentEmployee,
  records,
  className = '',
}) => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('2026-09');
  const [chartView, setChartView] = useState<ChartViewType>('donut');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfSuccess, setPdfSuccess] = useState<boolean>(false);

  const selectedMonthInfo = useMemo(() => {
    return (
      AVAILABLE_MONTHS.find((m) => m.key === selectedMonthKey) || AVAILABLE_MONTHS[0]
    );
  }, [selectedMonthKey]);

  // Compute monthly hours and detailed summary
  const monthlySummary = useMemo(() => {
    return calculateMonthlySummary(currentEmployee, records, selectedMonthKey);
  }, [currentEmployee, records, selectedMonthKey]);

  const handleGeneratePdf = async () => {
    try {
      setIsGeneratingPdf(true);
      await generateMonthlyAttendancePdf(currentEmployee, records, selectedMonthKey);
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3500);
    } catch (err) {
      console.error('Error generating PDF report:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Compute stats for current employee for the selected month
  const distributionData = useMemo(() => {
    // Filter records for this employee and month
    const employeeRecords = records.filter((r) => {
      if (r.employeeId !== currentEmployee.id) return false;
      // Check timestamp or dateFormatted
      const recordYearMonth = r.timestamp?.slice(0, 7);
      if (recordYearMonth === selectedMonthKey) return true;

      // Fallback matching dateFormatted (e.g., "Sep 2026" or "Agu 2026")
      if (selectedMonthKey === '2026-09' && (r.dateFormatted.includes('Sep 2026') || r.dateFormatted.includes('Sep'))) {
        return true;
      }
      if (selectedMonthKey === '2026-08' && (r.dateFormatted.includes('Agu 2026') || r.dateFormatted.includes('Aug'))) {
        return true;
      }
      if (selectedMonthKey === '2026-07' && (r.dateFormatted.includes('Jul 2026') || r.dateFormatted.includes('Jul'))) {
        return true;
      }
      return false;
    });

    let onTimeCount = 0;
    let lateCount = 0;
    let fieldDutyCount = 0;
    let explicitLeaveCount = 0;

    // Dedup by date so 1 work day = 1 primary status (prefer MASUK / DINAS_LUAR)
    const dayMap = new Map<string, AttendanceRecord>();
    for (const rec of employeeRecords) {
      const dateKey = rec.dateFormatted || rec.timestamp.slice(0, 10);
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, rec);
      } else if (rec.type === 'MASUK' || rec.type === 'DINAS_LUAR') {
        dayMap.set(dateKey, rec);
      }
    }

    dayMap.forEach((rec) => {
      if (rec.type === 'DINAS_LUAR' || rec.status === 'DISETUJUI') {
        fieldDutyCount += 1;
      } else if (rec.status === 'TERLAMBAT') {
        lateCount += 1;
      } else if (rec.type === 'IZIN_SAKIT' || rec.status === 'IZIN' || rec.status === 'TIDAK_HADIR') {
        explicitLeaveCount += 1;
      } else if (rec.status === 'TEPAT_WAKTU') {
        onTimeCount += 1;
      } else {
        onTimeCount += 1;
      }
    });

    // Calculate absent days based on passed workdays in month vs recorded days
    const totalRecordedDays = onTimeCount + lateCount + fieldDutyCount + explicitLeaveCount;
    const estimatedAbsent = Math.max(0, selectedMonthInfo.passedWorkDays - totalRecordedDays);
    const absentCount = explicitLeaveCount + estimatedAbsent;

    const totalDays = onTimeCount + lateCount + fieldDutyCount + absentCount;
    const safeTotal = totalDays > 0 ? totalDays : 1;

    const items: DistributionItem[] = [
      {
        id: 'on-time',
        name: 'Tepat Waktu (On-Time)',
        shortLabel: 'Tepat Waktu',
        count: onTimeCount,
        percentage: Math.round((onTimeCount / safeTotal) * 100),
        color: '#10B981', // emerald-500
        bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
        textColor: 'text-emerald-700 dark:text-emerald-400',
        borderColor: 'border-emerald-200 dark:border-emerald-800/60',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        description: 'Hadir sesuai jadwal kantor (<08.15 WIB)',
      },
      {
        id: 'late',
        name: 'Terlambat (Late)',
        shortLabel: 'Terlambat',
        count: lateCount,
        percentage: Math.round((lateCount / safeTotal) * 100),
        color: '#F59E0B', // amber-500
        bgLight: 'bg-amber-50 dark:bg-amber-950/30',
        textColor: 'text-amber-700 dark:text-amber-400',
        borderColor: 'border-amber-200 dark:border-amber-800/60',
        icon: <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
        description: 'Presensi melewati batas toleransi keterlambatan',
      },
      {
        id: 'field-duty',
        name: 'Dinas Luar (Field Duty)',
        shortLabel: 'Dinas Luar',
        count: fieldDutyCount,
        percentage: Math.round((fieldDutyCount / safeTotal) * 100),
        color: '#3B82F6', // blue-500
        bgLight: 'bg-blue-50 dark:bg-blue-950/30',
        textColor: 'text-blue-700 dark:text-blue-400',
        borderColor: 'border-blue-200 dark:border-blue-800/60',
        icon: <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
        description: 'Tugas operasional resmi di luar kantor',
      },
      {
        id: 'absent',
        name: 'Tidak Hadir / Izin (Absent)',
        shortLabel: 'Tidak Hadir',
        count: absentCount,
        percentage: Math.round((absentCount / safeTotal) * 100),
        color: '#F43F5E', // rose-500
        bgLight: 'bg-rose-50 dark:bg-rose-950/30',
        textColor: 'text-rose-700 dark:text-rose-400',
        borderColor: 'border-rose-200 dark:border-rose-800/60',
        icon: <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
        description: 'Izin sakit, cuti resmi, atau tanpa keterangan',
      },
    ];

    // Score / On-Time Rate: On-Time / (Total recorded days or total days)
    const onTimeRate = totalDays > 0 ? Math.round((onTimeCount / totalDays) * 100) : 0;
    const attendanceRate = totalDays > 0 ? Math.round(((totalDays - absentCount) / totalDays) * 100) : 0;

    return {
      items,
      totalDays,
      onTimeCount,
      lateCount,
      fieldDutyCount,
      absentCount,
      onTimeRate,
      attendanceRate,
    };
  }, [records, currentEmployee.id, selectedMonthKey, selectedMonthInfo]);

  // Data formatted for Recharts
  const chartData = useMemo(() => {
    return distributionData.items.map((item) => ({
      name: item.shortLabel,
      fullName: item.name,
      value: item.count,
      percentage: item.percentage,
      color: item.color,
      description: item.description,
    }));
  }, [distributionData]);

  // Performance Assessment
  const performanceBadge = useMemo(() => {
    const rate = distributionData.onTimeRate;
    if (rate >= 85) {
      return {
        label: 'Disiplin Sangat Baik',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: <Award className="w-3.5 h-3.5 text-emerald-600" />,
      };
    }
    if (rate >= 70) {
      return {
        label: 'Disiplin Standar',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        icon: <Sparkles className="w-3.5 h-3.5 text-blue-600" />,
      };
    }
    return {
      label: 'Perlu Perhatian',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
    };
  }, [distributionData.onTimeRate]);

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 backdrop-blur-xs text-white text-xs p-3 rounded-xl shadow-xl border border-slate-700 space-y-1 z-50">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: data.color }}
            />
            <span className="font-bold text-slate-100">{data.fullName || data.name}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-300 pt-1 border-t border-slate-800 text-[11px]">
            <span>Total Hari:</span>
            <span className="font-bold text-white text-xs">{data.value} Hari</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-300 text-[11px]">
            <span>Proporsi Bulanan:</span>
            <span className="font-bold text-emerald-400">{data.percentage}%</span>
          </div>
          {data.description && (
            <p className="text-[10px] text-slate-400 italic pt-1 max-w-[180px]">
              {data.description}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="monthly-attendance-distribution-card"
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-200 ${className}`}
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50/70 to-white dark:from-slate-900 dark:to-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <PieChartIcon className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Distribusi Presensi Bulanan
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visualisasi tingkat kehadiran <span className="font-semibold text-slate-700 dark:text-slate-200">{currentEmployee.name}</span>
          </p>
        </div>

        {/* Controls: Month Filter, Chart Type Switch, and PDF Export Button */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Month selector */}
          <div className="relative">
            <select
              id="attendance-month-selector"
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="pl-2.5 pr-7 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {AVAILABLE_MONTHS.map((m) => (
                <option key={m.key} value={m.key} className="dark:bg-slate-800 dark:text-slate-200">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chart View Toggle */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              id="view-donut-toggle"
              onClick={() => setChartView('donut')}
              title="Tampilan Donut Chart"
              className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                chartView === 'donut'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              id="view-bar-toggle"
              onClick={() => setChartView('bar')}
              title="Tampilan Bar Chart"
              className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                chartView === 'bar'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* PDF Report Export Button */}
          <button
            type="button"
            id="download-monthly-pdf-btn"
            onClick={handleGeneratePdf}
            disabled={isGeneratingPdf}
            title="Unduh Rekap Presensi & Jam Kerja Bulanan (PDF)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer ${
              pdfSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 text-white'
            }`}
          >
            {isGeneratingPdf ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Membuat PDF...</span>
              </>
            ) : pdfSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>PDF Terunduh!</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5" />
                <span>Unduh PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5 space-y-5">
        {/* KPI Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {/* Total Jam Kerja */}
          <div className="bg-blue-50/70 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-100/80 dark:border-blue-900/50">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-blue-800 dark:text-blue-300 block font-bold">
                Total Jam Kerja
              </span>
              <Timer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-blue-700 dark:text-blue-300">
                {monthlySummary.totalWorkHours}
              </span>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Jam</span>
            </div>
            <span className="text-[10px] text-blue-600/90 dark:text-blue-400/90 block mt-0.5 font-medium">
              Rata-rata {monthlySummary.averageDailyHours} j/hari
            </span>
          </div>

          <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
              Ketepatan Waktu
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                {distributionData.onTimeRate}%
              </span>
              <span className="text-[10px] text-slate-400">on-time</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {monthlySummary.statusCounts.onTime} hari tepat waktu
            </span>
          </div>

          <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
              Tingkat Hadir
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                {distributionData.attendanceRate}%
              </span>
              <span className="text-[10px] text-slate-400">hadir</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Efektif kehadiran
            </span>
          </div>

          <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
              Hari Terverifikasi
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
                {distributionData.totalDays - distributionData.absentCount}
              </span>
              <span className="text-[10px] text-slate-400">/ {selectedMonthInfo.passedWorkDays} hari</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Terdata di GPS
            </span>
          </div>

          <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
              Target Bulan Ini
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-extrabold text-slate-700 dark:text-slate-200">
                {selectedMonthInfo.totalWorkDays}
              </span>
              <span className="text-[10px] text-slate-400">hari kerja</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Target {monthlySummary.targetMonthlyHours} jam
            </span>
          </div>
        </div>

        {/* Recharts Chart Visualization */}
        <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/60">
          <div className="h-[210px] w-full flex items-center justify-center">
            {chartView === 'donut' ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={82}
                      paddingAngle={4}
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}-${index}`}
                          fill={entry.color}
                          stroke="#0f172a"
                          strokeWidth={1.5}
                          opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
                          className="transition-all duration-200 cursor-pointer outline-hidden"
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Centered Donut Stat Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-slate-800 dark:text-slate-100 leading-none">
                    {distributionData.onTimeRate}%
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-400 mt-0.5 uppercase tracking-wider">
                    On-Time
                  </span>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 12, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={{ stroke: '#475569' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`bar-${entry.name}-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Quick legend with direct count & % breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-750 mt-2">
            {distributionData.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800/80 transition"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {item.shortLabel}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {item.count} hari ({item.percentage}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Category Distribution Cards */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
            <span>Rincian Komponen Kehadiran</span>
            <span>Kontribusi</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {distributionData.items.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl border ${item.borderColor} ${item.bgLight} transition-all duration-150 flex items-start justify-between gap-3`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5 p-1 rounded-lg bg-white dark:bg-slate-800 shadow-2xs shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {item.shortLabel}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-sm font-black ${item.textColor}`}>
                    {item.count}{' '}
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">hari</span>
                  </span>
                  <div className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    {item.percentage}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evaluation & Status Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${performanceBadge.bg}`}
            >
              {performanceBadge.icon}
              {performanceBadge.label}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Berdasarkan akumulasi jadwal {selectedMonthInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Calendar className="w-3.5 h-3.5" />
            <span>Diperbarui otomatis secara real-time</span>
          </div>
        </div>
      </div>
    </div>
  );
};
