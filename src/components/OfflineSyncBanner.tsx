import React from 'react';
import { WifiOff, Cloud, RefreshCw, Layers, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import { QueuedAttendanceItem } from '../types';

interface OfflineSyncBannerProps {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  onToggleSimulateOffline: () => void;
  queue: QueuedAttendanceItem[];
  isSyncing: boolean;
  onOpenQueueModal: () => void;
  onSyncNow: () => void;
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({
  isOnline,
  isSimulatedOffline,
  onToggleSimulateOffline,
  queue,
  isSyncing,
  onOpenQueueModal,
  onSyncNow,
}) => {
  const hasQueue = queue.length > 0;
  const isOffline = !isOnline || isSimulatedOffline;

  // Don't render if completely online and queue is empty
  if (!isOffline && !hasQueue) {
    return null;
  }

  return (
    <div
      id="offline-sync-banner"
      className={`mb-6 p-4 rounded-2xl border transition-all animate-in fade-in slide-in-from-top-3 duration-200 ${
        isOffline
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/80 text-amber-950 dark:text-amber-100'
          : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-950 dark:text-blue-100'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Left Info */}
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              isOffline
                ? 'bg-amber-500 text-white'
                : 'bg-blue-600 text-white'
            }`}
          >
            {isOffline ? <WifiOff className="w-5 h-5 animate-pulse" /> : <Cloud className="w-5 h-5" />}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">
                {isOffline
                  ? 'Mode Offline Aktif (Service Worker Siap)'
                  : 'Koneksi Pulih — Menunggu Unggah Presensi'}
              </span>

              {isSimulatedOffline && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                  Simulasi Offline
                </span>
              )}

              {hasQueue && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white animate-pulse">
                  {queue.length} Pending
                </span>
              )}
            </div>

            <p className="text-xs opacity-90">
              {isOffline
                ? 'Anda tetap dapat melakukan presensi dengan kamera & GPS. Data otomatis masuk antrian lokal dan akan terunggah saat online.'
                : `Terdapat ${queue.length} presensi offline yang siap disinkronkan secara otomatis ke server.`}
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0 flex-wrap">
          {/* Quick Simulation Toggle */}
          <button
            type="button"
            id="btn-toggle-offline-simulation"
            onClick={onToggleSimulateOffline}
            title="Uji coba presensi saat tidak ada koneksi internet"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer"
          >
            {isSimulatedOffline ? (
              <ToggleRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-slate-400" />
            )}
            <span className="hidden sm:inline">Tes Offline:</span>
            <span>{isSimulatedOffline ? 'ON' : 'OFF'}</span>
          </button>

          {/* View Queue Button */}
          {hasQueue && (
            <button
              type="button"
              id="btn-view-offline-queue"
              onClick={onOpenQueueModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Lihat Antrian ({queue.length})</span>
            </button>
          )}

          {/* Sync Now Button (Active if online and hasQueue) */}
          {hasQueue && !isOffline && (
            <button
              type="button"
              id="btn-sync-offline-now"
              disabled={isSyncing}
              onClick={onSyncNow}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl text-white shadow-xs transition cursor-pointer ${
                isSyncing
                  ? 'bg-blue-400 dark:bg-blue-800 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Mengunggah...' : 'Sinkronkan Sekarang'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
