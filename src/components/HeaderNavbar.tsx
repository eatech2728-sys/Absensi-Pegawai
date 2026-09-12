import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Employee, ThemeMode } from '../types';
import { ShieldCheck, ChevronDown, History, Camera, Moon, Sun, Layers, Monitor, Check, Laptop } from 'lucide-react';
import { TechnicalStatusIndicator, TechnicalStatusProps } from './TechnicalStatusIndicator';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderNavbarProps extends TechnicalStatusProps {
  currentEmployee: Employee;
  allEmployees: Employee[];
  onSelectEmployee: (emp: Employee) => void;
  activeTab: 'ATTENDANCE' | 'HISTORY';
  onChangeTab: (tab: 'ATTENDANCE' | 'HISTORY') => void;
  totalRecordsToday: number;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  themeMode?: ThemeMode;
  onChangeThemeMode?: (mode: ThemeMode) => void;
  pendingQueueCount?: number;
  onOpenQueueModal?: () => void;
}

export const HeaderNavbar: React.FC<HeaderNavbarProps> = ({
  currentEmployee,
  allEmployees,
  onSelectEmployee,
  activeTab,
  onChangeTab,
  totalRecordsToday,
  isDarkMode,
  onToggleDarkMode,
  themeMode = 'system',
  onChangeThemeMode,
  pendingQueueCount = 0,
  onOpenQueueModal,
  currentLat,
  currentLng,
  accuracy,
  isLocating,
  distanceToOffice,
  isWithinRadius,
  activeOfficeName,
  activeOfficeRadius,
  locationError,
  onRefreshLocation,
}) => {
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
    }
    if (isThemeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isThemeMenuOpen]);

  const handleSelectTheme = (mode: ThemeMode) => {
    if (onChangeThemeMode) {
      onChangeThemeMode(mode);
    } else {
      onToggleDarkMode();
    }
    setIsThemeMenuOpen(false);
  };
  return (
    <header className="bg-white dark:bg-slate-900/95 border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-40 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-tight">
                  Presensi Lokasi
                </h1>
                <span className="hidden md:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                  GPS Real-Time
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">PT Nusantara Solusi Teknologi</p>
            </div>
          </div>

          {/* Center: Real-Time Server & Location Validation Indicators (visible on lg and larger) */}
          <div className="hidden lg:flex items-center justify-center">
            <TechnicalStatusIndicator
              currentLat={currentLat}
              currentLng={currentLng}
              accuracy={accuracy}
              isLocating={isLocating}
              distanceToOffice={distanceToOffice}
              isWithinRadius={isWithinRadius}
              activeOfficeName={activeOfficeName}
              activeOfficeRadius={activeOfficeRadius}
              locationError={locationError}
              onRefreshLocation={onRefreshLocation}
            />
          </div>

          {/* Right Section: Navigation Tabs, Dark Mode Toggle & Employee Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Real-Time Indicators for tablet screens (md to lg) */}
            <div className="hidden sm:flex lg:hidden items-center">
              <TechnicalStatusIndicator
                currentLat={currentLat}
                currentLng={currentLng}
                accuracy={accuracy}
                isLocating={isLocating}
                distanceToOffice={distanceToOffice}
                isWithinRadius={isWithinRadius}
                activeOfficeName={activeOfficeName}
                activeOfficeRadius={activeOfficeRadius}
                locationError={locationError}
                onRefreshLocation={onRefreshLocation}
              />
            </div>

            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Offline Queue Quick Badge (if any pending) */}
            {pendingQueueCount > 0 && onOpenQueueModal && (
              <button
                type="button"
                id="btn-header-offline-queue"
                onClick={onOpenQueueModal}
                title={`Ada ${pendingQueueCount} presensi dalam antrian sinkronisasi`}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 animate-pulse"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Antrian:</span>
                <span>{pendingQueueCount}</span>
              </button>
            )}

            {/* Theme Selector (Real-Time OS System Theme & Manual Toggle) */}
            <div className="relative" ref={themeMenuRef}>
              <button
                id="btn-theme-selector"
                type="button"
                onClick={() => setIsThemeMenuOpen((prev) => !prev)}
                title={
                  themeMode === 'system'
                    ? `Tema: Otomatis Sesuai Sistem OS (Saat ini ${isDarkMode ? 'Gelap' : 'Terang'}) - Real-Time`
                    : themeMode === 'dark'
                    ? 'Tema: Mode Gelap (Manual)'
                    : 'Tema: Mode Terang (Manual)'
                }
                className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer active:scale-95 ${
                  themeMode === 'system'
                    ? 'bg-blue-50/90 dark:bg-slate-800 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100/90 dark:hover:bg-slate-700/80 shadow-xs'
                    : isDarkMode
                    ? 'bg-slate-800 border-amber-400/40 text-amber-300 hover:bg-slate-700/80 shadow-xs'
                    : 'bg-slate-100/90 border-slate-200 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {themeMode === 'system' ? (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Monitor className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <span className="hidden sm:inline text-[11px] font-bold">Auto OS</span>
                    <span className="hidden xl:inline text-[10px] px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/60 dark:border-blue-800/60">
                      {isDarkMode ? 'Gelap' : 'Terang'}
                    </span>
                  </>
                ) : isDarkMode ? (
                  <>
                    <Moon className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                    <span className="hidden xl:inline text-[11px] font-bold">Shift Malam</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                    <span className="hidden xl:inline text-[11px]">Mode Terang</span>
                  </>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Theme Dropdown Menu */}
              {isThemeMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1.5 mb-1 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Preferensi Tema
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Deteksi Real-Time
                    </span>
                  </div>

                  <div className="space-y-1">
                    {/* System OS Option */}
                    <button
                      type="button"
                      id="btn-theme-mode-system"
                      onClick={() => handleSelectTheme('system')}
                      className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition cursor-pointer ${
                        themeMode === 'system'
                          ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg mt-0.5 ${themeMode === 'system' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        <Monitor className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold leading-tight">Otomatis (Sistem OS)</span>
                          {themeMode === 'system' && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          Sinkronisasi real-time mengikuti setelan OS ({isDarkMode ? 'Saat ini: Gelap' : 'Saat ini: Terang'})
                        </p>
                      </div>
                    </button>

                    {/* Light Mode Option */}
                    <button
                      type="button"
                      id="btn-theme-mode-light"
                      onClick={() => handleSelectTheme('light')}
                      className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition cursor-pointer ${
                        themeMode === 'light'
                          ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg mt-0.5 ${themeMode === 'light' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        <Sun className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold leading-tight">Mode Terang (Siang)</span>
                          {themeMode === 'light' && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          Tampilan latar cerah kontras tinggi
                        </p>
                      </div>
                    </button>

                    {/* Dark Mode Option */}
                    <button
                      type="button"
                      id="btn-theme-mode-dark"
                      onClick={() => handleSelectTheme('dark')}
                      className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition cursor-pointer ${
                        themeMode === 'dark'
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg mt-0.5 ${themeMode === 'dark' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        <Moon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold leading-tight">Mode Gelap (Shift Malam)</span>
                          {themeMode === 'dark' && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                          Tampilan gelap nyaman untuk penglihatan malam
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Tabs with Smooth Sliding Indicator */}
            <div className="relative flex items-center bg-slate-100 dark:bg-slate-800 border border-transparent dark:border-slate-700/60 p-1 rounded-xl">
              <button
                id="tab-attendance"
                type="button"
                onClick={() => onChangeTab('ATTENDANCE')}
                className={`relative z-10 flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  activeTab === 'ATTENDANCE'
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {activeTab === 'ATTENDANCE' && (
                  <motion.div
                    layoutId="activeTabBadge"
                    className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-xs -z-10"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <Camera className="w-3.5 h-3.5" />
                <span>Presensi</span>
              </button>
              <button
                id="tab-history"
                type="button"
                onClick={() => onChangeTab('HISTORY')}
                className={`relative z-10 flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-200 cursor-pointer ${
                  activeTab === 'HISTORY'
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {activeTab === 'HISTORY' && (
                  <motion.div
                    layoutId="activeTabBadge"
                    className="absolute inset-0 bg-white dark:bg-slate-700 rounded-lg shadow-xs -z-10"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <History className="w-3.5 h-3.5" />
                <span>Riwayat</span>
                {totalRecordsToday > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-bold">
                    {totalRecordsToday}
                  </span>
                )}
              </button>
            </div>

            {/* Employee Profile Selector */}
            <div className="relative group">
              <div className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/60 cursor-pointer transition">
                <img
                  src={currentEmployee.avatarUrl}
                  alt={currentEmployee.name}
                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                />
                <div className="hidden xl:block text-left">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">{currentEmployee.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{currentEmployee.position}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>

              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 hidden group-hover:block hover:block z-50 animate-in fade-in duration-150">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Ganti Profil Pegawai:
                </div>
                {allEmployees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => onSelectEmployee(emp)}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition ${
                      currentEmployee.id === emp.id ? 'bg-blue-50/60 dark:bg-blue-950/40' : ''
                    }`}
                  >
                    <img
                      src={emp.avatarUrl}
                      alt={emp.name}
                      className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{emp.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{emp.department} • {emp.nip}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Technical Status Sub-bar (shows on screens < sm for clear mobile accessibility) */}
        <div className="sm:hidden py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
          <TechnicalStatusIndicator
            currentLat={currentLat}
            currentLng={currentLng}
            accuracy={accuracy}
            isLocating={isLocating}
            distanceToOffice={distanceToOffice}
            isWithinRadius={isWithinRadius}
            activeOfficeName={activeOfficeName}
            activeOfficeRadius={activeOfficeRadius}
            locationError={locationError}
            onRefreshLocation={onRefreshLocation}
          />
        </div>
      </div>
    </header>
  );
};
