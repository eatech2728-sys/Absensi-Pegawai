import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HeaderNavbar } from './components/HeaderNavbar';
import { LocationRadar } from './components/LocationRadar';
import { AttendanceCard } from './components/AttendanceCard';
import { AttendanceHistory } from './components/AttendanceHistory';
import { MonthlyAttendanceDistributionCard } from './components/MonthlyAttendanceDistributionCard';
import { ClockInReminderBanner } from './components/ClockInReminderBanner';
import { AttendanceSuccessModal } from './components/AttendanceSuccessModal';
import { AttendanceReceiptModal } from './components/AttendanceReceiptModal';
import { OfficeSettingsModal } from './components/OfficeSettingsModal';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import { OfflineQueueModal } from './components/OfflineQueueModal';
import { Employee, OfficeLocation, AttendanceRecord, AttendanceType, QueuedAttendanceItem, ThemeMode } from './types';
import { EMPLOYEES, DEFAULT_OFFICES, INITIAL_RECORDS } from './utils/mockData';
import { calculateDistanceMeters, reverseGeocode } from './utils/geo';
import { triggerAttendanceSuccessConfetti } from './utils/confetti';
import {
  getOfflineQueue,
  enqueueOfflineAttendance,
  removeQueueItem,
  clearAllQueued,
  processOfflineQueue,
} from './utils/offlineQueue';
import { registerPresensiServiceWorker } from './utils/shiftNotificationService';
import {
  getStoredThemeMode,
  saveThemeMode,
  getSystemPrefersDark,
  applyThemeClass,
  watchSystemThemePreference,
} from './utils/themeDetection';
import { CheckCircle, Info, Sparkles, WifiOff } from 'lucide-react';

export default function App() {
  // Theme state with real-time system preference detection ('system' | 'light' | 'dark')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const mode = getStoredThemeMode();
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return getSystemPrefersDark();
  });

  // Real-time detection & switching based on OS and user preference
  useEffect(() => {
    const activeIsDark = themeMode === 'system' ? getSystemPrefersDark() : themeMode === 'dark';
    setIsDarkMode(activeIsDark);
    applyThemeClass(activeIsDark);
    saveThemeMode(themeMode);

    if (themeMode === 'system') {
      // Real-time listener: automatically toggles when user alters system OS preferences
      const cleanupWatcher = watchSystemThemePreference((systemPrefersDark) => {
        setIsDarkMode(systemPrefersDark);
        applyThemeClass(systemPrefersDark);
        showToast(
          systemPrefersDark
            ? 'Pengaturan OS berubah ke Mode Gelap. Tema aplikasi disesuaikan otomatis.'
            : 'Pengaturan OS berubah ke Mode Terang. Tema aplikasi disesuaikan otomatis.'
        );
      });

      // Synchronize with early inline script in index.html if triggered
      const handleCustomOSChange = (e: Event) => {
        const ce = e as CustomEvent<{ isDark: boolean }>;
        if (ce.detail && typeof ce.detail.isDark === 'boolean') {
          setIsDarkMode(ce.detail.isDark);
          applyThemeClass(ce.detail.isDark);
        }
      };

      window.addEventListener('system-theme-change', handleCustomOSChange);

      return () => {
        cleanupWatcher();
        window.removeEventListener('system-theme-change', handleCustomOSChange);
      };
    }
  }, [themeMode]);

  const handleThemeModeChange = (newMode: ThemeMode) => {
    setThemeMode(newMode);
    if (newMode === 'system') {
      const isSysDark = getSystemPrefersDark();
      setIsDarkMode(isSysDark);
      applyThemeClass(isSysDark);
      showToast(
        `Mode Otomatis Aktif: Mengikuti pengaturan sistem OS (${isSysDark ? 'Gelap' : 'Terang'}) secara real-time.`
      );
    } else if (newMode === 'dark') {
      setIsDarkMode(true);
      applyThemeClass(true);
      showToast('Beralih ke Mode Gelap (Shift Malam)');
    } else {
      setIsDarkMode(false);
      applyThemeClass(false);
      showToast('Beralih ke Mode Terang (Siang)');
    }
  };

  // Service Worker Registration for PWA Offline Caching & Shift Reminders
  useEffect(() => {
    registerPresensiServiceWorker();
  }, []);

  // Offline Sync Queue & Connectivity State
  const [queue, setQueue] = useState<QueuedAttendanceItem[]>(() => getOfflineQueue());
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState<boolean>(false);

  // Persistence state
  const [employees] = useState<Employee[]>(EMPLOYEES);
  const [currentEmployee, setCurrentEmployee] = useState<Employee>(EMPLOYEES[0]);
  
  const [offices, setOffices] = useState<OfficeLocation[]>(() => {
    try {
      const saved = localStorage.getItem('absensi_offices');
      return saved ? JSON.parse(saved) : DEFAULT_OFFICES;
    } catch {
      return DEFAULT_OFFICES;
    }
  });

  const [activeOffice, setActiveOffice] = useState<OfficeLocation>(() => offices[0] || DEFAULT_OFFICES[0]);
  
  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('absensi_records');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= INITIAL_RECORDS.length) {
          return parsed;
        }
        // Merge saved with INITIAL_RECORDS ensuring unique IDs
        const existingIds = new Set(parsed.map((r: AttendanceRecord) => r.id));
        return [...parsed, ...INITIAL_RECORDS.filter((r) => !existingIds.has(r.id))];
      }
      return INITIAL_RECORDS;
    } catch {
      return INITIAL_RECORDS;
    }
  });

  const [activeTab, setActiveTab] = useState<'ATTENDANCE' | 'HISTORY'>('ATTENDANCE');
  const [attendanceType, setAttendanceType] = useState<AttendanceType>('MASUK');
  
  // Modals state
  const [selectedReceiptRecord, setSelectedReceiptRecord] = useState<AttendanceRecord | null>(null);
  const [celebrationRecord, setCelebrationRecord] = useState<AttendanceRecord | null>(null);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState<boolean>(false);
  const [isOfficeModalOpen, setIsOfficeModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // GPS state
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLng, setCurrentLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [address, setAddress] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Listen to network status changes (online/offline events)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Koneksi internet kembali aktif! Sistem siap menyinkronkan data.');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Koneksi internet terputus. Mode offline aktif dengan penyimpanan lokal.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save to localStorage when records change
  useEffect(() => {
    try {
      localStorage.setItem('absensi_records', JSON.stringify(records));
    } catch (e) {
      console.warn('Failed to save records to localStorage', e);
    }
  }, [records]);

  // Save offices when updated
  useEffect(() => {
    try {
      localStorage.setItem('absensi_offices', JSON.stringify(offices));
    } catch (e) {
      console.warn('Failed to save offices to localStorage', e);
    }
  }, [offices]);

  // Process offline queue upload
  const handleSyncOfflineQueue = useCallback(async () => {
    const currentQueue = getOfflineQueue();
    if (currentQueue.length === 0 || isSyncing) return;

    setIsSyncing(true);
    try {
      const { syncedCount, errors } = await processOfflineQueue((syncedRecord) => {
        // Update record in records state
        setRecords((prev) => {
          const idx = prev.findIndex((r) => r.id === syncedRecord.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = syncedRecord;
            return copy;
          }
          return [syncedRecord, ...prev];
        });
      });

      // Refresh queue state
      setQueue(getOfflineQueue());

      if (syncedCount > 0) {
        showToast(`Berhasil mengunggah & menyinkronkan ${syncedCount} presensi offline ke server! 🎉`);
        triggerAttendanceSuccessConfetti();
      }
    } catch (err) {
      console.error('Sync failed:', err);
      showToast('Sinkronisasi tertunda karena gangguan server.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  // Automatic sync when connection returns and queue has items
  useEffect(() => {
    const effectiveOnline = isOnline && !isSimulatedOffline;
    if (effectiveOnline && queue.length > 0 && !isSyncing) {
      const timer = setTimeout(() => {
        handleSyncOfflineQueue();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isSimulatedOffline, queue.length, isSyncing, handleSyncOfflineQueue]);

  // Fetch current geolocation
  const fetchCurrentLocation = useCallback(() => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Perangkat atau browser tidak mendukung Geolocation.');
      // Fallback coordinate at office for testing
      setCurrentLat(activeOffice.latitude);
      setCurrentLng(activeOffice.longitude);
      setAccuracy(15);
      setAddress(activeOffice.address);
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;

        setCurrentLat(lat);
        setCurrentLng(lng);
        setAccuracy(acc);
        setIsLocating(false);

        // Fetch reverse geocode address
        const resolvedAddress = await reverseGeocode(lat, lng);
        setAddress(resolvedAddress);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        let msg = 'Gagal mendapatkan lokasi GPS.';
        if (err.code === 1) {
          msg = 'Izin lokasi (GPS) ditolak oleh browser. Menggunakan lokasi simulasi kantor.';
        } else if (err.code === 2) {
          msg = 'Posisi tidak dapat ditentukan.';
        } else if (err.code === 3) {
          msg = 'Waktu permintaan GPS habis.';
        }
        setLocationError(msg);
        setIsLocating(false);

        // Fallback coordinate close to active office so user can still test seamlessly
        if (currentLat === null) {
          setCurrentLat(activeOffice.latitude + 0.00015);
          setCurrentLng(activeOffice.longitude + 0.00015);
          setAccuracy(18);
          setAddress(activeOffice.address);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [activeOffice, currentLat]);

  // Request location on mount
  useEffect(() => {
    fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  // Calculate distance between current GPS and target office
  const distanceToOffice =
    currentLat !== null && currentLng !== null
      ? calculateDistanceMeters(currentLat, currentLng, activeOffice.latitude, activeOffice.longitude)
      : 999999;

  const isWithinRadius = distanceToOffice <= activeOffice.radiusMeters;

  // Calibrate: set current user coordinates as the active office location
  const handleSetCurrentAsOffice = () => {
    if (currentLat === null || currentLng === null) return;

    const updatedOffice: OfficeLocation = {
      ...activeOffice,
      latitude: currentLat,
      longitude: currentLng,
      address: address || 'Lokasi Terkalibrasi GPS Pengguna',
    };

    const updatedList = offices.map((o) => (o.id === activeOffice.id ? updatedOffice : o));
    setOffices(updatedList);
    setActiveOffice(updatedOffice);
    showToast(`Lokasi "${updatedOffice.name}" berhasil dikalibrasi ke koordinat Anda!`);
  };

  const handleSubmitAttendance = (newRecord: AttendanceRecord) => {
    const effectiveOffline = !isOnline || isSimulatedOffline;

    if (effectiveOffline) {
      // Enqueue to offline storage
      const queuedItem = enqueueOfflineAttendance(newRecord);
      setQueue(getOfflineQueue());

      // Save into app records so it immediately appears in the history & statistics
      const offlineRecord = queuedItem.record;
      setRecords((prev) => [offlineRecord, ...prev]);

      setCelebrationRecord(offlineRecord);
      setIsCelebrationOpen(true);
      triggerAttendanceSuccessConfetti();
      showToast(
        `Presensi ${offlineRecord.type} tersimpan di Antrian Offline! 💾 Sistem akan mengunggah otomatis saat online.`
      );
    } else {
      const onlineRecord: AttendanceRecord = {
        ...newRecord,
        syncStatus: 'ONLINE_SYNCED',
        syncedAt: new Date().toISOString(),
      };
      setRecords((prev) => [onlineRecord, ...prev]);
      setCelebrationRecord(onlineRecord);
      setIsCelebrationOpen(true);
      triggerAttendanceSuccessConfetti();
      showToast(`Presensi ${onlineRecord.type} berhasil dicatat dan terverifikasi ke server! 🎉`);
    }
  };

  const handleSaveOffices = (newOffices: OfficeLocation[], selectedId: string) => {
    setOffices(newOffices);
    const found = newOffices.find((o) => o.id === selectedId) || newOffices[0];
    if (found) {
      setActiveOffice(found);
    }
    showToast('Pengaturan titik kantor berhasil diperbarui.');
  };

  const handleClockInReminderAction = () => {
    setActiveTab('ATTENDANCE');
    setAttendanceType('MASUK');
    setTimeout(() => {
      const el = document.getElementById('attendance-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  // Listen for messages from Service Worker (e.g. user clicked notification to clock in or outside radius actions)
  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_OPEN_CLOCK_IN') {
        console.log('[App] Received notification click from Service Worker:', event.data.payload);
        handleClockInReminderAction();
      } else if (event.data?.type === 'NOTIFICATION_SWITCH_DINAS_LUAR') {
        console.log('[App] Switched to DINAS_LUAR from notification click');
        setActiveTab('ATTENDANCE');
        setAttendanceType('DINAS_LUAR');
        showToast('Beralih ke mode Presensi Dinas Luar (karena posisi di luar radius kantor).');
        setTimeout(() => {
          const el = document.getElementById('attendance-card');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } else if (event.data?.type === 'NOTIFICATION_OUTSIDE_RADIUS_ALERT') {
        console.log('[App] Outside radius notification opened');
        setActiveTab('ATTENDANCE');
        showToast('Peringatan: Posisi GPS Anda berada di luar batas radius kantor.');
        setTimeout(() => {
          const el = document.getElementById('attendance-card');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    };

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    return () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
    };
  }, []);

  const effectiveOffline = !isOnline || isSimulatedOffline;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'} flex flex-col selection:bg-blue-500 selection:text-white transition-colors duration-200`}>
      {/* Top Navbar */}
      <HeaderNavbar
        currentEmployee={currentEmployee}
        allEmployees={employees}
        onSelectEmployee={setCurrentEmployee}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        totalRecordsToday={records.filter((r) => r.dateFormatted.includes('11 Sep 2026') || r.dateFormatted.includes('Sep')).length}
        isDarkMode={isDarkMode}
        themeMode={themeMode}
        onChangeThemeMode={handleThemeModeChange}
        onToggleDarkMode={() => handleThemeModeChange(isDarkMode ? 'light' : 'dark')}
        pendingQueueCount={queue.length}
        onOpenQueueModal={() => setIsQueueModalOpen(true)}
        currentLat={currentLat}
        currentLng={currentLng}
        accuracy={accuracy}
        isLocating={isLocating}
        distanceToOffice={distanceToOffice}
        isWithinRadius={isWithinRadius}
        activeOfficeName={activeOffice.name}
        activeOfficeRadius={activeOffice.radiusMeters}
        locationError={locationError}
        onRefreshLocation={fetchCurrentLocation}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-slate-700 animate-in fade-in slide-in-from-bottom-5 duration-200">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* Visual Notification Banner & Toast for Shift Clock-In Reminder */}
        <ClockInReminderBanner
          currentEmployee={currentEmployee}
          records={records}
          onClockInNow={handleClockInReminderAction}
        />

        {/* Offline Sync Banner (shown if offline or when pending queue items exist) */}
        <OfflineSyncBanner
          isOnline={isOnline}
          isSimulatedOffline={isSimulatedOffline}
          onToggleSimulateOffline={() => {
            setIsSimulatedOffline((prev) => {
              const next = !prev;
              showToast(
                next
                  ? 'Simulasi Offline Aktif: Data presensi berikutnya akan masuk ke antrian lokal.'
                  : 'Simulasi Offline Nonaktif: Memulai sinkronisasi otomatis ke server.'
              );
              return next;
            });
          }}
          queue={queue}
          isSyncing={isSyncing}
          onOpenQueueModal={() => setIsQueueModalOpen(true)}
          onSyncNow={handleSyncOfflineQueue}
        />

        {/* Informational Guidance Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-850 border border-blue-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-100 transition-colors">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Presensi Cerdas Berbasis Lokasi, Kamera & Mode Offline PWA:</span>
              <p className="text-blue-700 dark:text-slate-400 mt-0.5">
                Pastikan posisi berada di dalam radius kantor ({activeOffice.radiusMeters}m). Bila koneksi internet terputus, presensi otomatis diantrikan dan diunggah begitu online kembali.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsOfficeModalOpen(true)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-750 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-slate-700 rounded-xl font-semibold transition cursor-pointer"
            >
              Atur Titik Kantor
            </button>
          </div>
        </div>

        {/* Animated View Transition between Presensi and Riwayat */}
        <AnimatePresence mode="wait">
          {activeTab === 'ATTENDANCE' ? (
            <motion.div
              key="view-tab-attendance"
              id="view-tab-attendance"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Left Column: Attendance Action & Real-Time Camera Selfie */}
              <div className="lg:col-span-7 space-y-6">
                <AttendanceCard
                  employee={currentEmployee}
                  targetOffice={activeOffice}
                  currentLat={currentLat}
                  currentLng={currentLng}
                  accuracy={accuracy}
                  address={address}
                  distanceToOffice={distanceToOffice}
                  isWithinRadius={isWithinRadius}
                  attendanceType={attendanceType}
                  onChangeAttendanceType={setAttendanceType}
                  onSubmitAttendance={handleSubmitAttendance}
                  isOffline={effectiveOffline}
                />
              </div>

              {/* Right Column: Location Radar & Geofencing Perimeter */}
              <div className="lg:col-span-5 space-y-6">
                <LocationRadar
                  currentLat={currentLat}
                  currentLng={currentLng}
                  accuracy={accuracy}
                  address={address}
                  isLocating={isLocating}
                  locationError={locationError}
                  targetOffice={activeOffice}
                  distanceToOffice={distanceToOffice}
                  isWithinRadius={isWithinRadius}
                  onRefreshLocation={fetchCurrentLocation}
                  onSetCurrentAsOffice={handleSetCurrentAsOffice}
                  onSelectOffice={setActiveOffice}
                  allOffices={offices}
                  onOpenOfficeModal={() => setIsOfficeModalOpen(true)}
                  attendanceType={attendanceType}
                />

                {/* Monthly Attendance Distribution Recharts Visualization Card */}
                <MonthlyAttendanceDistributionCard
                  currentEmployee={currentEmployee}
                  records={records}
                />

                {/* Employee Quick Info Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs transition-colors">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Informasi Pegawai Aktif
                  </h4>
                  <div className="flex items-start gap-3.5">
                    <img
                      src={currentEmployee.avatarUrl}
                      alt={currentEmployee.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                    />
                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{currentEmployee.name}</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{currentEmployee.nip}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{currentEmployee.position} • {currentEmployee.department}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-transparent dark:border-slate-700/60">
                      <span className="text-slate-400 block text-[10px]">Jadwal Masuk</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{currentEmployee.shift.startTime} WIB</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-transparent dark:border-slate-700/60">
                      <span className="text-slate-400 block text-[10px]">Toleransi Telat</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">+{currentEmployee.shift.lateToleranceMinutes} Menit</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Tab: Riwayat Presensi */
            <motion.div
              key="view-tab-history"
              id="view-tab-history"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <AttendanceHistory
                records={records}
                onSelectRecord={(rec) => setSelectedReceiptRecord(rec)}
                currentEmployee={currentEmployee}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Interactive Confetti & Success Celebration Modal */}
      <AttendanceSuccessModal
        isOpen={isCelebrationOpen}
        record={celebrationRecord}
        onClose={() => setIsCelebrationOpen(false)}
        onViewDetailedReceipt={() => {
          const rec = celebrationRecord;
          setIsCelebrationOpen(false);
          setSelectedReceiptRecord(rec);
        }}
      />

      {/* Attendance Receipt Modal */}
      {selectedReceiptRecord && (
        <AttendanceReceiptModal
          record={selectedReceiptRecord}
          onClose={() => setSelectedReceiptRecord(null)}
        />
      )}

      {/* Office & Geofence Settings Modal */}
      {isOfficeModalOpen && (
        <OfficeSettingsModal
          offices={offices}
          activeOfficeId={activeOffice.id}
          onSaveOffices={handleSaveOffices}
          onClose={() => setIsOfficeModalOpen(false)}
          currentLat={currentLat}
          currentLng={currentLng}
        />
      )}

      {/* Offline Queue Modal */}
      <OfflineQueueModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
        queue={queue}
        isOnline={isOnline && !isSimulatedOffline}
        isSyncing={isSyncing}
        onSyncNow={handleSyncOfflineQueue}
        onRemoveItem={(queueId) => {
          removeQueueItem(queueId);
          setQueue(getOfflineQueue());
          showToast('Data presensi dihapus dari antrian offline.');
        }}
        onClearQueue={() => {
          if (window.confirm('Yakin ingin membersihkan semua antrian presensi offline?')) {
            clearAllQueued();
            setQueue([]);
            showToast('Antrian offline telah dibersihkan.');
          }
        }}
      />
    </div>
  );
}
