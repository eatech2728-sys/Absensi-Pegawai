import React, { useState, useEffect, useCallback } from 'react';
// Jalur impor yang sudah disesuaikan agar dibaca oleh rollup/vite
import { motion, AnimatePresence } from 'framer-motion';
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <HeaderNavbar 
        currentEmployee={currentEmployee} 
        themeMode={themeMode} 
        onThemeChange={handleThemeModeChange} 
        setActiveTab={setActiveTab}
        activeTab={activeTab}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OfflineSyncBanner 
          isOnline={isOnline && !isSimulatedOffline} 
          queueCount={queue.length} 
          onOpenQueue={() => setIsQueueModalOpen(true)} 
        />
        
        {activeTab === 'ATTENDANCE' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
            <div className="lg:col-span-2 space-y-6">
              <LocationRadar 
                activeOffice={activeOffice}
                currentLat={currentLat}
                currentLng={currentLng}
                accuracy={accuracy}
                address={address}
                isLocating={isLocating}
                locationError={locationError}
                onRefreshLocation={() => {}}
              />
              <AttendanceCard 
                attendanceType={attendanceType}
                setAttendanceType={setAttendanceType}
                isOnline={isOnline && !isSimulatedOffline}
                onSubmit={() => {}}
              />
            </div>
            <div className="space-y-6">
              <MonthlyAttendanceDistributionCard records={records} />
              <ClockInReminderBanner />
            </div>
          </div>
                ) : (
          <AttendanceHistory 
            records={records} 
            onViewReceipt={setSelectedReceiptRecord} 
          />
        )}
      </main>

      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-5 right-5 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-xl z-50 flex items-center space-x-2"
          >
            <Info size={18} />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AttendanceSuccessModal 
        isOpen={isCelebrationOpen} 
        record={celebrationRecord} 
        onClose={() => setIsCelebrationOpen(false)} 
      />
      
      <AttendanceReceiptModal 
        record={selectedReceiptRecord} 
        onClose={() => setSelectedReceiptRecord(null)} 
      />
      
      <OfficeSettingsModal 
        isOpen={isOfficeModalOpen} 
        offices={offices} 
        activeOffice={activeOffice}
        onSave={setOffices}
        onSelect={setActiveOffice}
        onClose={() => setIsOfficeModalOpen(false)} 
      />
      
      <OfflineQueueModal 
        isOpen={isQueueModalOpen} 
        queue={queue}
        onClose={() => setIsQueueModalOpen(false)}
      />
    </div>
  );
}
