import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  MapPin,
  Briefcase,
  ArrowRight,
  X,
  BellRing,
  ShieldAlert,
  Send,
} from 'lucide-react';

interface OutsideRadiusWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  distanceMeters: number;
  maxRadiusMeters: number;
  officeName: string;
  employeeName: string;
  onSwitchToDinasLuar: () => void;
  onProceedAnyway: () => void;
  onResendNotification?: () => void;
}

export const OutsideRadiusWarningModal: React.FC<OutsideRadiusWarningModalProps> = ({
  isOpen,
  onClose,
  distanceMeters,
  maxRadiusMeters,
  officeName,
  employeeName,
  onSwitchToDinasLuar,
  onProceedAnyway,
  onResendNotification,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="outside-radius-modal-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          id="outside-radius-modal-content"
          className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-amber-500/10 dark:bg-amber-950/40 p-5 border-b border-amber-200/80 dark:border-amber-900/40 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Di Luar Radius Kantor
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                  Presensi memerlukan konfirmasi khusus
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4">
            {/* Notification Sent Banner */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs flex items-start gap-2.5 text-blue-800 dark:text-blue-300">
              <BellRing className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <span className="font-bold">Notifikasi Browser Terkirim</span>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5 leading-relaxed">
                  Peringatan posisi luar radius telah dikirimkan ke bilah notifikasi browser / sistem perangkat Anda.
                </p>
              </div>
            </div>

            {/* Distance Info Box */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Target Kantor:
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{officeName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Jarak Anda Saat Ini:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                  {distanceMeters} meter
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Batas Maksimum Radius:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                  {maxRadiusMeters} meter
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Posisi Anda melebihi batas toleransi radius kantor sebesar{' '}
                <strong className="text-rose-600 dark:text-rose-400">
                  +{Math.max(0, distanceMeters - maxRadiusMeters)}m
                </strong>
                .
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Halo <strong>{employeeName}</strong>, jika Anda sedang bertugas di luar kantor, disarankan memilih opsi <strong>Dinas Luar</strong> agar catatan kehadiran diverifikasi sesuai agenda tugas.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              id="btn-modal-switch-dinas-luar"
              onClick={onSwitchToDinasLuar}
              className="flex-1 py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Ganti ke Dinas Luar</span>
            </button>

            <button
              type="button"
              id="btn-modal-proceed-outside-radius"
              onClick={onProceedAnyway}
              className="flex-1 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Tetap Lanjut Catat</span>
            </button>

            <button
              type="button"
              id="btn-modal-cancel-outside-radius"
              onClick={onClose}
              className="py-2.5 px-3 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Batal
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
