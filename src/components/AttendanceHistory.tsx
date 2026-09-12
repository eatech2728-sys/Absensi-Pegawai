import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AttendanceRecord, Employee } from '../types';
import { MonthlyAttendanceDistributionCard } from './MonthlyAttendanceDistributionCard';
import {
  Search,
  Download,
  Eye,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Briefcase,
  FileSpreadsheet,
  FileDown,
  CloudOff,
  User,
  ChevronDown,
  Check,
  Fingerprint,
  ShieldCheck,
  CalendarRange,
  X,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { generateMonthlyAttendancePdf } from '../utils/pdfGenerator';
import { exportAttendanceToCsv } from '../utils/csvExporter';

interface AttendanceHistoryProps {
  records: AttendanceRecord[];
  onSelectRecord: (record: AttendanceRecord) => void;
  currentEmployee?: Employee;
}

export const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ records, onSelectRecord, currentEmployee }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [datePreset, setDatePreset] = useState<
    'ALL' | 'TODAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM'
  >('ALL');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showCsvDropdown, setShowCsvDropdown] = useState(false);
  const [csvExportSuccess, setCsvExportSuccess] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCsvDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getRecordDateString = (timestamp: string): string => {
    if (!timestamp) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
      return timestamp.slice(0, 10);
    }
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return formatYMD(d);
    }
    return '';
  };

  const applyDatePreset = (
    preset: 'ALL' | 'TODAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH'
  ) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'TODAY') {
      const todayStr = formatYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'THIS_WEEK') {
      const day = now.getDay();
      const diffToMon = (day === 0 ? -6 : 1) - day;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setStartDate(formatYMD(mon));
      setEndDate(formatYMD(sun));
    } else if (preset === 'LAST_WEEK') {
      const day = now.getDay();
      const diffToMon = (day === 0 ? -6 : 1) - day - 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setStartDate(formatYMD(mon));
      setEndDate(formatYMD(sun));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    } else if (preset === 'LAST_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatYMD(firstDay));
      setEndDate(formatYMD(lastDay));
    }
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setDatePreset('CUSTOM');
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setDatePreset('CUSTOM');
  };

  const handleClearDateRange = () => {
    setStartDate('');
    setEndDate('');
    setDatePreset('ALL');
  };

  const handleExportPDF = async () => {
    if (!currentEmployee) return;
    try {
      setIsGeneratingPdf(true);
      const targetMonth = startDate ? startDate.slice(0, 7) : '2026-09';
      await generateMonthlyAttendancePdf(currentEmployee, filteredRecords, targetMonth);
    } catch (err) {
      console.error('Error exporting PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Filter records by search term, type, and date range
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchesSearch =
        rec.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.nip.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.location.address.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = filterType === 'ALL' || rec.type === filterType;

      let matchesDate = true;
      if (startDate || endDate) {
        const recDate = getRecordDateString(rec.timestamp);
        if (recDate) {
          if (startDate && recDate < startDate) matchesDate = false;
          if (endDate && recDate > endDate) matchesDate = false;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [records, searchTerm, filterType, startDate, endDate]);

  // Calculate statistics (scoped to active date/filter selection for insightful weekly/monthly metrics)
  const isDateFiltered = Boolean(startDate || endDate);
  const isAnyFilterActive = Boolean(searchTerm || filterType !== 'ALL' || isDateFiltered);
  const activeDataset = isAnyFilterActive ? filteredRecords : records;

  const totalPresensi = activeDataset.length;
  const tepatWaktuCount = activeDataset.filter((r) => r.status === 'TEPAT_WAKTU').length;
  const terlambatCount = activeDataset.filter((r) => r.status === 'TERLAMBAT').length;
  const dinasLuarCount = activeDataset.filter((r) => r.type === 'DINAS_LUAR').length;

  const handleExportCsvPersonal = () => {
    setShowCsvDropdown(false);
    const result = exportAttendanceToCsv(records, {
      employeeOnly: true,
      currentEmployee,
    });
    if (result.count > 0) {
      setCsvExportSuccess(`Berhasil mengunduh ${result.count} data presensi pribadi (${result.filename})`);
      setTimeout(() => setCsvExportSuccess(null), 4000);
    }
  };

  const handleExportCsvFiltered = () => {
    setShowCsvDropdown(false);
    const result = exportAttendanceToCsv(filteredRecords, {
      employeeOnly: false,
    });
    if (result.count > 0) {
      setCsvExportSuccess(`Berhasil mengunduh ${result.count} riwayat presensi CSV`);
      setTimeout(() => setCsvExportSuccess(null), 4000);
    }
  };

  const handleExportCsvAll = () => {
    setShowCsvDropdown(false);
    const result = exportAttendanceToCsv(records, {
      employeeOnly: false,
    });
    if (result.count > 0) {
      setCsvExportSuccess(`Berhasil mengunduh seluruh (${result.count}) data presensi CSV`);
      setTimeout(() => setCsvExportSuccess(null), 4000);
    }
  };

  return (
    <div id="attendance-history-section" className="space-y-5">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Presensi</p>
              {isAnyFilterActive && (
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
                  Sesuai Filter
                </span>
              )}
            </div>
            <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{totalPresensi}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tepat Waktu</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{tepatWaktuCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Terlambat</p>
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{terlambatCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between transition-colors">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Dinas Luar</p>
            <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">{dinasLuarCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Monthly Attendance Distribution Chart for current employee */}
      {currentEmployee && (
        <MonthlyAttendanceDistributionCard
          currentEmployee={currentEmployee}
          records={records}
        />
      )}

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        {/* Table Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Riwayat Presensi Pegawai</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Log kehadiran lengkap dengan foto selfie terverifikasi GPS</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama, NIP, departemen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="py-1.5 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="MASUK">Absen Masuk</option>
              <option value="PULANG">Absen Pulang</option>
              <option value="DINAS_LUAR">Dinas Luar</option>
            </select>

            {/* Export CSV Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div className="inline-flex rounded-xl shadow-2xs">
                <button
                  type="button"
                  id="btn-export-csv-personal"
                  onClick={handleExportCsvPersonal}
                  title={currentEmployee ? `Unduh Catatan Pribadi (${currentEmployee.name}) format CSV` : 'Ekspor Catatan Presensi CSV'}
                  className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-l-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Ekspor CSV</span>
                </button>
                <button
                  type="button"
                  id="btn-export-csv-menu"
                  onClick={() => setShowCsvDropdown((prev) => !prev)}
                  title="Pilihan ekspor data presensi CSV"
                  className="py-1.5 px-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-r-xl border-l border-emerald-500 text-xs transition cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Dropdown Menu */}
              {showCsvDropdown && (
                <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-30 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Opsi Ekspor File CSV
                  </div>

                  {currentEmployee && (
                    <button
                      type="button"
                      onClick={handleExportCsvPersonal}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 flex items-start gap-2.5 transition"
                    >
                      <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-300">Catatan Pribadi Pegawai</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          Hanya data presensi milik {currentEmployee.name} ({records.filter((r) => r.employeeId === currentEmployee.id || r.nip === currentEmployee.nip).length} data)
                        </p>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleExportCsvFiltered}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-start gap-2.5 transition"
                  >
                    <Search className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Hasil Filter & Pencarian Saat Ini</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Sesuai filter ({filteredRecords.length} data terpilih)
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCsvAll}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-start gap-2.5 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Seluruh Riwayat Presensi</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Total {records.length} rekaman presensi semua pegawai
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Export Monthly PDF Button */}
            {currentEmployee && (
              <button
                type="button"
                id="export-monthly-pdf-history-btn"
                onClick={handleExportPDF}
                disabled={isGeneratingPdf}
                title="Cetak & Unduh Rekap Presensi Bulanan (PDF)"
                className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              >
                {isGeneratingPdf ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Membuat PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Cetak PDF Bulanan</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Date-Range Filter Sub-bar */}
        <div className="px-4 sm:px-5 py-3 bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
          {/* Quick Preset Buttons for Weeks and Months */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
              <CalendarRange className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Rentang Waktu:
            </span>
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'TODAY', label: 'Hari Ini' },
              { id: 'THIS_WEEK', label: 'Minggu Ini' },
              { id: 'LAST_WEEK', label: 'Minggu Lalu' },
              { id: 'THIS_MONTH', label: 'Bulan Ini' },
              { id: 'LAST_MONTH', label: 'Bulan Lalu' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                id={`date-preset-${preset.id.toLowerCase()}`}
                onClick={() => applyDatePreset(preset.id as any)}
                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition cursor-pointer ${
                  datePreset === preset.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Date Pickers (Start Date & End Date) */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[11px] text-slate-400 font-medium">Dari:</span>
              <input
                type="date"
                id="attendance-filter-start-date"
                aria-label="Filter tanggal mulai"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="text-[11px] text-slate-700 dark:text-slate-200 bg-transparent focus:outline-hidden font-mono cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <span className="text-[11px] text-slate-400 font-medium">s/d:</span>
              <input
                type="date"
                id="attendance-filter-end-date"
                aria-label="Filter tanggal selesai"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="text-[11px] text-slate-700 dark:text-slate-200 bg-transparent focus:outline-hidden font-mono cursor-pointer"
              />
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                id="btn-clear-date-filter"
                onClick={handleClearDateRange}
                title="Hapus filter rentang tanggal"
                className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 transition cursor-pointer flex items-center gap-1 text-[11px] font-medium shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Tanggal</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Info Banner */}
        {isDateFiltered && (
          <div className="px-4 sm:px-5 py-2 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300">
            <div className="flex items-center gap-2 truncate">
              <Filter className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate">
                Menampilkan rekaman dari <strong>{startDate || 'Awal'}</strong> s/d{' '}
                <strong>{endDate || 'Sekarang'}</strong> ({filteredRecords.length} data ditemukan)
              </span>
            </div>
            <button
              type="button"
              id="btn-banner-clear-date"
              onClick={handleClearDateRange}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer shrink-0 ml-2"
            >
              Hapus Filter
            </button>
          </div>
        )}

        {/* CSV Export Success Toast/Banner */}
        {csvExportSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{csvExportSuccess}</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">File tersimpan lokal</span>
          </div>
        )}

        {/* Table of Records */}
        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Belum ada riwayat presensi yang cocok</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {isAnyFilterActive
                ? 'Tidak ada rekaman dalam rentang tanggal atau filter pencarian ini.'
                : 'Silakan lakukan absen masuk atau sesuaikan filter pencarian.'}
            </p>
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('ALL');
                  handleClearDateRange();
                }}
                className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Semua Filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Selfie Real-Time</th>
                  <th className="py-3 px-4">Pegawai</th>
                  <th className="py-3 px-4">Waktu Presensi</th>
                  <th className="py-3 px-4">Tipe & Status</th>
                  <th className="py-3 px-4">Lokasi & Radius</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredRecords.map((rec) => {
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition group">
                      {/* Selfie Thumbnail with watermark preview */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onSelectRecord(rec)}
                          className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 group-hover:ring-2 group-hover:ring-blue-500 transition shrink-0 block cursor-pointer"
                          title="Klik untuk memperbesar selfie & slip presensi"
                        >
                          <img
                            src={rec.photoUrl}
                            alt={rec.employeeName}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition flex items-center justify-center">
                            <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition drop-shadow-md" />
                          </div>
                        </button>
                      </td>

                      {/* Employee Info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100">{rec.employeeName}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{rec.nip}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">{rec.department}</div>
                      </td>

                      {/* Time */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{rec.timeFormatted}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{rec.dateFormatted}</div>
                      </td>

                      {/* Type & Status */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              rec.type === 'MASUK'
                                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                                : rec.type === 'PULANG'
                                ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                                : 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                            }`}
                          >
                            {rec.type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              rec.status === 'TEPAT_WAKTU' || rec.status === 'DISETUJUI'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                            }`}
                          >
                            {rec.status.replace('_', ' ')}
                          </span>
                          {rec.biometricVerification?.verified && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                              <Fingerprint className="w-2.5 h-2.5 text-emerald-600" />
                              {rec.biometricVerification.method === 'WEBAUTHN_BIOMETRIC' ? 'WebAuthn' : 'Biometrik'}
                            </span>
                          )}
                          {rec.syncStatus === 'OFFLINE_PENDING' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                              <CloudOff className="w-2.5 h-2.5" /> Antrian Offline
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Location & Radius info */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="truncate">{rec.location.officeName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {rec.location.address}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                          <span
                            className={`font-semibold ${
                              rec.location.isWithinRadius ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {rec.location.distanceToOffice}m
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 dark:text-slate-400 text-[10px]">
                            {rec.location.isWithinRadius ? 'Radius Valid' : 'Luar Radius'}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectRecord(rec)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Lihat Slip
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
