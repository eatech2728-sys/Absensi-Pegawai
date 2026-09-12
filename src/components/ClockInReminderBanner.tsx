import React, { useState, useEffect, useMemo } from 'react';
import { Employee, AttendanceRecord } from '../types';
import {
  AlarmClock,
  Clock,
  BellRing,
  Bell,
  LogIn,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  Send,
  Volume2,
} from 'lucide-react';
import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleShiftReminderInSW,
  triggerLocalShiftNotification,
  triggerOutsideRadiusNotification,
  calculateShiftReminderDelay,
  NotificationPermissionState,
  hasReminderBeenSentToday,
  markReminderSentToday,
} from '../utils/shiftNotificationService';

interface ClockInReminderBannerProps {
  currentEmployee: Employee;
  records: AttendanceRecord[];
  onClockInNow: () => void;
}

export const ClockInReminderBanner: React.FC<ClockInReminderBannerProps> = ({
  currentEmployee,
  records,
  onClockInNow,
}) => {
  // Real clock ticking every second
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  // Toggle for testing/simulating the 30-min shift window at any time of day
  const [isSimulatedShiftTime, setIsSimulatedShiftTime] = useState<boolean>(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);
  const [isToastVisible, setIsToastVisible] = useState<boolean>(true);
  const [hasPlayedChime, setHasPlayedChime] = useState<boolean>(false);

  // Service Worker Notification State
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission()
  );
  const [isTestingNotif, setIsTestingNotif] = useState<boolean>(false);
  const [notifFeedback, setNotifFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Reset dismissal and toast when employee changes
  useEffect(() => {
    setIsBannerDismissed(false);
    setIsToastVisible(true);
    setHasPlayedChime(false);
  }, [currentEmployee.id]);

  // Calculate reminder time (15 minutes before shift start)
  const reminderInfo = useMemo(() => {
    return calculateShiftReminderDelay(currentEmployee.shift.startTime);
  }, [currentEmployee.shift.startTime]);

  // Sync notification permission status on mount
  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  // Determine active reference time (either real clock or simulated 07:45 WIB before 08:00 shift)
  const activeTime = useMemo(() => {
    if (!isSimulatedShiftTime) return currentTime;
    // Construct a simulated Date at 07:45:00 on the current day
    const sim = new Date(currentTime);
    const [shiftH, shiftM] = currentEmployee.shift.startTime.split(':').map(Number);
    // 15 minutes before shift start
    let simH = shiftH;
    let simM = shiftM - 15;
    if (simM < 0) {
      simH -= 1;
      simM += 60;
    }
    sim.setHours(simH, simM, currentTime.getSeconds());
    return sim;
  }, [currentTime, isSimulatedShiftTime, currentEmployee.shift.startTime]);

  // Check if current employee has already clocked in today
  const todayCheckInRecord = useMemo(() => {
    return records.find((r) => {
      if (r.employeeId !== currentEmployee.id) return false;
      if (r.type !== 'MASUK' && r.type !== 'DINAS_LUAR') return false;

      // Check ISO date string match
      const recIsoDate = r.timestamp?.slice(0, 10);
      const activeIsoDate = activeTime.toISOString().slice(0, 10);
      if (recIsoDate && recIsoDate === activeIsoDate) return true;

      // Check formatted string match e.g. "11 Sep 2026"
      const activeDateFormatted = new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(activeTime);
      if (r.dateFormatted && r.dateFormatted.includes(activeDateFormatted)) return true;

      // Also match if mock record matches day 11 Sep
      if (r.dateFormatted?.includes('11 Sep 2026') && activeTime.getDate() === 11 && activeTime.getMonth() === 8) {
        return true;
      }

      return false;
    });
  }, [records, currentEmployee.id, activeTime]);

  const hasClockedInToday = !!todayCheckInRecord;

  // Calculate shift timing metrics
  const timingStats = useMemo(() => {
    const [startH, startM] = currentEmployee.shift.startTime.split(':').map(Number);
    const shiftStartTotalMinutes = startH * 60 + startM;
    const currentTotalMinutes =
      activeTime.getHours() * 60 + activeTime.getMinutes() + activeTime.getSeconds() / 60;

    // Difference in minutes (positive: before shift; negative: after shift start)
    const diffMinutes = shiftStartTotalMinutes - currentTotalMinutes;

    // "Within 30 minutes of their shift start time":
    // 30 minutes before shift start up to 30 minutes after shift start
    const isWithin30MinWindow = diffMinutes <= 30 && diffMinutes >= -30;
    const isBeforeShift = diffMinutes > 0;
    const isAfterShift = diffMinutes <= 0;

    // Seconds calculation for countdown
    const absDiffSec = Math.abs(Math.floor(diffMinutes * 60));
    const countdownMinutes = Math.floor(absDiffSec / 60);
    const countdownSeconds = absDiffSec % 60;

    // Late tolerance remaining
    const lateToleranceEnd = shiftStartTotalMinutes + currentEmployee.shift.lateToleranceMinutes;
    const minutesUntilLate = lateToleranceEnd - currentTotalMinutes;
    const isStillWithinTolerance = minutesUntilLate > 0;

    return {
      isWithin30MinWindow,
      isBeforeShift,
      isAfterShift,
      diffMinutes,
      countdownMinutes,
      countdownSeconds,
      isStillWithinTolerance,
      minutesUntilLate: Math.max(0, Math.floor(minutesUntilLate)),
    };
  }, [activeTime, currentEmployee.shift]);

  // Subtle web audio chime for toast
  useEffect(() => {
    if (timingStats.isWithin30MinWindow && !hasClockedInToday && !hasPlayedChime) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.42);
        }
      } catch {
        // Ignore audio policy restrictions
      }
      setHasPlayedChime(true);
    }
  }, [timingStats.isWithin30MinWindow, hasClockedInToday, hasPlayedChime]);

  // Formatting strings
  const formattedTimeNow = activeTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Schedule Shift Reminder in Service Worker whenever employee or records change
  useEffect(() => {
    if (notifPermission === 'granted') {
      scheduleShiftReminderInSW(currentEmployee, hasClockedInToday).then((res) => {
        console.log('[SW Shift Reminder]', res.message);
      });
    }
  }, [currentEmployee, hasClockedInToday, notifPermission]);

  // Request notification permission and activate SW reminder
  const handleEnableNotification = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      const res = await scheduleShiftReminderInSW(currentEmployee, hasClockedInToday);
      setNotifFeedback({
        type: 'success',
        message: `Izin notifikasi aktif! ${res.message}`,
      });
    } else if (perm === 'denied') {
      setNotifFeedback({
        type: 'error',
        message: 'Izin notifikasi diblokir oleh browser. Silakan izinkan pada setelan situs browser Anda.',
      });
    }
    setTimeout(() => setNotifFeedback(null), 6000);
  };

  // Test local push notification via Service Worker
  const handleTestNotification = async () => {
    setIsTestingNotif(true);
    setNotifFeedback(null);
    try {
      const res = await triggerLocalShiftNotification(
        currentEmployee,
        `⏰ Pengingat Presensi: Shift ${currentEmployee.shift.startTime} WIB`,
        `Halo ${currentEmployee.name}, waktu masuk kerja shift ${currentEmployee.shift.name} (${currentEmployee.shift.startTime} WIB) telah tiba. Toleransi keterlambatan ${currentEmployee.shift.lateToleranceMinutes} menit.`
      );
      if (res.success) {
        setNotifFeedback({
          type: 'success',
          message: 'Notifikasi push lokal Service Worker berhasil dikirim ke perangkat Anda!',
        });
      } else {
        setNotifFeedback({
          type: 'error',
          message: res.message,
        });
      }
    } catch {
      setNotifFeedback({
        type: 'error',
        message: 'Gagal mengirim notifikasi uji coba.',
      });
    } finally {
      setIsTestingNotif(false);
      setTimeout(() => setNotifFeedback(null), 7000);
    }
  };

  // Test outside radius browser notification
  const handleTestOutsideRadiusNotif = async () => {
    setIsTestingNotif(true);
    setNotifFeedback(null);
    try {
      const res = await triggerOutsideRadiusNotification({
        distanceMeters: 480,
        maxRadiusMeters: 150,
        officeName: 'Kantor Pusat Jakarta',
        employeeName: currentEmployee.name,
        attendanceType: 'MASUK',
      });
      if (res.success) {
        setNotifFeedback({
          type: 'success',
          message: 'Notifikasi browser peringatan luar radius berhasil dikirim ke perangkat Anda!',
        });
      } else {
        setNotifFeedback({
          type: 'error',
          message: res.message,
        });
      }
    } catch {
      setNotifFeedback({
        type: 'error',
        message: 'Gagal mengirim notifikasi luar radius.',
      });
    } finally {
      setIsTestingNotif(false);
      setTimeout(() => setNotifFeedback(null), 7000);
    }
  };

  return (
    <div className="space-y-3 mb-6" id="clock-in-reminder-container">
      {/* 1. If user already clocked in today */}
      {hasClockedInToday ? (
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-emerald-950">
                Presensi Masuk Hari Ini Sudah Selesai
              </p>
              <p className="text-emerald-700 mt-0.5">
                {currentEmployee.name} telah mencatat kehadiran masuk pukul{' '}
                <span className="font-semibold">{todayCheckInRecord?.timeFormatted || '08:00 WIB'}</span> ({todayCheckInRecord?.status === 'TEPAT_WAKTU' ? 'Tepat Waktu' : 'Tercatat'}).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSimulatedShiftTime(!isSimulatedShiftTime)}
            className="self-end sm:self-auto text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2 flex items-center gap-1"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{isSimulatedShiftTime ? 'Kembali ke Jam Nyata' : 'Simulasi Uji Pengingat Shift'}</span>
          </button>
        </div>
      ) : (
        /* 2. Employee HAS NOT clocked in today */
        <>
          {/* Main Visual Notification Banner (shown if within 30-min window and not dismissed) */}
          {timingStats.isWithin30MinWindow && !isBannerDismissed && (
            <div
              id="clock-in-reminder-banner"
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-0.5 shadow-lg shadow-amber-500/15 animate-in fade-in slide-in-from-top-3 duration-300"
            >
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-850 rounded-[14px] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left Side: Pulse Alarm Icon & Urgency Message */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30">
                      <BellRing className="w-6 h-6 animate-bounce" />
                    </div>
                    {/* Animated Ping Ring */}
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white dark:border-slate-800"></span>
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-amber-200/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        Pengingat Presensi Masuk
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-amber-200 dark:border-slate-700">
                        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        Shift {currentEmployee.shift.startTime} WIB
                      </span>
                      {isSimulatedShiftTime && (
                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                          Mode Simulasi Waktu
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      Halo {currentEmployee.name}, Anda belum melakukan presensi masuk!
                    </h3>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                      {timingStats.isBeforeShift ? (
                        <>
                          Shift kerja <span className="font-semibold text-slate-800 dark:text-slate-200">{currentEmployee.shift.name}</span> dimulai dalam{' '}
                          <span className="font-bold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                            {timingStats.countdownMinutes} menit {timingStats.countdownSeconds} detik
                          </span>
                          . Segera verifikasi lokasi GPS dan unggah foto selfie agar kehadiran tercatat tepat waktu.
                        </>
                      ) : (
                        <>
                          Shift kerja telah dimulai sejak pukul <span className="font-semibold text-slate-800 dark:text-slate-200">{currentEmployee.shift.startTime} WIB</span> (
                          <span className="font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded">
                            +{timingStats.countdownMinutes} menit lalu
                          </span>
                          ).{' '}
                          {timingStats.isStillWithinTolerance ? (
                            <span className="text-amber-800 dark:text-amber-400 font-semibold">
                              Toleransi keterlambatan tersisa {timingStats.minutesUntilLate} menit!
                            </span>
                          ) : (
                            <span className="text-rose-700 dark:text-rose-400 font-semibold">
                              Lewat toleransi, kehadiran akan tercatat terlambat.
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right Side: Primary CTA & Dismiss */}
                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    id="banner-clock-in-now-btn"
                    onClick={onClockInNow}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Presensi Masuk Sekarang</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    id="dismiss-banner-btn"
                    onClick={() => setIsBannerDismissed(true)}
                    title="Tutup Pengingat"
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom Micro Ticker */}
              <div className="bg-amber-500/10 dark:bg-amber-950/30 px-4 py-1.5 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between text-[11px] text-amber-900 dark:text-amber-200 font-medium">
                <div className="flex items-center gap-2">
                  <AlarmClock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>
                    Batas toleransi maksimal:{' '}
                    <strong className="text-slate-900 dark:text-slate-100">
                      +{currentEmployee.shift.lateToleranceMinutes} Menit
                    </strong>{' '}
                    setelah jam mulai
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Waktu Acuan:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white/70 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-amber-200 dark:border-slate-700">
                    {formattedTimeNow} WIB
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Simulation Bar: If outside 30 minutes, let user toggle simulation to test easily! */}
          {!timingStats.isWithin30MinWindow && (
            <div className="bg-blue-50/70 dark:bg-slate-900 border border-blue-200/70 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-blue-950 dark:text-slate-100">
                    Status Jam Shift ({currentEmployee.shift.startTime} WIB):
                  </span>
                  <span className="text-blue-700 dark:text-slate-400 ml-1">
                    Waktu saat ini (<span className="font-mono font-semibold">{formattedTimeNow} WIB</span>) berada di luar jendela 30 menit shift.
                  </span>
                </div>
              </div>
              <button
                type="button"
                id="toggle-shift-simulation-btn"
                onClick={() => setIsSimulatedShiftTime(true)}
                className="self-end sm:self-auto px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Uji Notifikasi Shift (Simulasi 07:45 WIB)</span>
              </button>
            </div>
          )}

          {/* Reset Simulation button if simulated mode is active */}
          {isSimulatedShiftTime && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsSimulatedShiftTime(false)}
                className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline flex items-center gap-1 cursor-pointer"
              >
                Kembalikan ke Waktu Nyata Perangkat ({currentTime.toLocaleTimeString('id-ID')})
              </button>
            </div>
          )}
        </>
      )}

      {/* 3. Floating Toast Notification (Bottom Right) */}
      {timingStats.isWithin30MinWindow && !hasClockedInToday && isToastVisible && (
        <div
          id="clock-in-reminder-toast"
          className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 animate-in fade-in slide-in-from-bottom-5 duration-300 flex items-start gap-3.5"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <BellRing className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                Pengingat Masuk Kerja
              </span>
              <button
                type="button"
                onClick={() => setIsToastVisible(false)}
                className="text-slate-400 hover:text-white p-0.5 rounded transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <h4 className="text-xs font-bold text-slate-100">
              Shift {currentEmployee.shift.startTime} WIB — Segera Presensi
            </h4>

            <p className="text-[11px] text-slate-300 leading-snug">
              {timingStats.isBeforeShift
                ? `Dimulai dalam ${timingStats.countdownMinutes} menit lagi. Ambil selfie & verifikasi GPS sekarang.`
                : `Shift telah aktif sejak ${timingStats.countdownMinutes} menit lalu.`}
            </p>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                id="toast-clock-in-now-btn"
                onClick={() => {
                  setIsToastVisible(false);
                  onClockInNow();
                }}
                className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Presensi Masuk</span>
              </button>
              <button
                type="button"
                onClick={() => setIsToastVisible(false)}
                className="py-1.5 px-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-medium transition"
              >
                Nanti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Service Worker Push Notification Card & Schedule Control */}
      <div
        id="sw-push-notification-card"
        className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-2xs transition-all"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200/80 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-4.5 h-4.5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  Notifikasi Push Service Worker (Pengingat Shift Pagi)
                </h4>
                {notifPermission === 'granted' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    SW Push Aktif ({reminderInfo.reminderTimeFormatted})
                  </span>
                ) : notifPermission === 'denied' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                    <ShieldAlert className="w-3 h-3" />
                    Izin Diblokir di Browser
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <AlertTriangle className="w-3 h-3" />
                    Belum Diizinkan
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                Service Worker menjadwalkan notifikasi push lokal setiap pagi pukul{' '}
                <strong className="text-slate-800 dark:text-slate-200">{reminderInfo.reminderTimeFormatted}</strong>{' '}
                (15 menit sebelum masuk shift <strong className="text-slate-800 dark:text-slate-200">{currentEmployee.shift.startTime} WIB</strong>) untuk mengingatkan {currentEmployee.name} agar tidak terlambat presensi.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-center">
            {notifPermission !== 'granted' && (
              <button
                type="button"
                id="btn-enable-sw-notifications"
                onClick={handleEnableNotification}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>Izinkan Notifikasi SW</span>
              </button>
            )}

            <button
              type="button"
              id="btn-test-sw-push-notification"
              onClick={handleTestNotification}
              disabled={isTestingNotif}
              className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 active:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{isTestingNotif ? 'Mengirim...' : 'Uji Push Shift'}</span>
            </button>

            <button
              type="button"
              id="btn-test-outside-radius-notif"
              onClick={handleTestOutsideRadiusNotif}
              disabled={isTestingNotif}
              className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              title="Uji coba notifikasi browser saat berada di luar radius kantor"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{isTestingNotif ? 'Mengirim...' : 'Uji Notif Luar Radius'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert if user just tested or enabled */}
        {notifFeedback && (
          <div
            className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 border animate-in fade-in duration-200 ${
              notifFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
            }`}
          >
            {notifFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{notifFeedback.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};
