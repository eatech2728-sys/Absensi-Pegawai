import React from 'react';
import { QueuedAttendanceItem } from '../types';
import { CloudOff, RefreshCw, Trash2, X, CheckCircle2, Clock, MapPin, AlertCircle } from 'lucide-react';

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: QueuedAttendanceItem[];
  isOnline: boolean;
  isSyncing: boolean;
  onSyncNow: () => void;
  onRemoveItem: (queueId: string) => void;
  onClearQueue: () => void;
}

export const OfflineQueueModal: React.FC<OfflineQueueModalProps> = ({
  isOpen,
  onClose,
  queue,
  isOnline,
  isSyncing,
  onSyncNow,
  onRemoveItem,
  onClearQueue,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <CloudOff className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Antrian Sinkronisasi Offline</h3>
              <p className="text-[11px] text-slate-400">
                {queue.length} data presensi tersimpan lokal di perangkat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Connection condition reminder */}
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-2.5 ${
              isOnline
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
            }`}
          >
            {isOnline ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-bold block">
                {isOnline
                  ? 'Koneksi Internet Aktif'
                  : 'Koneksi Internet Terputus (Mode Offline)'}
              </span>
              <p className="text-[11px] mt-0.5 opacity-90">
                {isOnline
                  ? 'Perangkat telah terhubung ke jaringan. Anda dapat menyinkronkan sekarang atau menunggu pengunggahan otomatis.'
                  : 'Data presensi, foto selfie terstempel, dan koordinat GPS aman tersimpan di IndexedDB/localStorage browser Anda. Sistem akan mengunggah otomatis begitu koneksi pulih.'}
              </p>
            </div>
          </div>

          {/* Queue Items List */}
          {queue.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <CloudOff className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">
                Antrian Offline Kosong
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Semua data presensi telah berhasil tersinkronisasi ke server.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                <span>DAFTAR PRESENSI PENDING ({queue.length})</span>
                <button
                  type="button"
                  onClick={onClearQueue}
                  className="text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Bersihkan Semua
                </button>
              </div>

              {queue.map((item) => (
                <div
                  key={item.queueId}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 flex items-center gap-3.5"
                >
                  {/* Photo thumbnail */}
                  <img
                    src={item.record.photoUrl}
                    alt={item.record.employeeName}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                        {item.record.employeeName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.record.type === 'MASUK'
                            ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                            : item.record.type === 'PULANG'
                            ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                            : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {item.record.type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.record.timeFormatted}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3" />
                        {item.record.location.officeName}
                      </span>
                    </div>

                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Status: Menunggu Sinyal Jaringan
                    </div>
                  </div>

                  {/* Delete single button */}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.queueId)}
                    title="Hapus dari antrian"
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>

          {queue.length > 0 && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={onSyncNow}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                isSyncing
                  ? 'bg-blue-400 dark:bg-blue-800 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 active:scale-95'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
