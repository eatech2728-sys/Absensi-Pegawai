import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  Sparkles,
  MapPin,
  Clock,
  FileText,
  X,
  Share2,
  ShieldCheck,
  PartyPopper,
  ArrowRight,
} from 'lucide-react';
import { AttendanceRecord } from '../types';
import { triggerAttendanceSuccessConfetti } from '../utils/confetti';

interface AttendanceSuccessModalProps {
  record: AttendanceRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onViewDetailedReceipt: () => void;
}

export const AttendanceSuccessModal: React.FC<AttendanceSuccessModalProps> = ({
  record,
  isOpen,
  onClose,
  onViewDetailedReceipt,
}) => {
  useEffect(() => {
    if (isOpen && record) {
      triggerAttendanceSuccessConfetti();
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const isCheckIn = record.type === 'MASUK';
  const isDinas = record.type === 'DINAS_LUAR';

  return (
    <AnimatePresence>
      <div
        id="attendance-success-overlay"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm"
      >
        {/* Animated Card Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 25 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 320 }}
          className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative"
        >
          {/* Top Decorative Confetti Rainbow Bar */}
          <div className="h-2 bg-gradient-to-r from-emerald-500 via-blue-500 to-amber-500" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Celebration Header */}
          <div className="pt-8 pb-4 px-6 text-center">
            {/* Animated Icon Ring */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 20 }}
              className="relative inline-block mb-3"
            >
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              {/* Little floating celebratory sparkles badge */}
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.25 }}
                className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-md font-bold text-xs"
              >
                <Sparkles className="w-4 h-4 text-amber-900" />
              </motion.span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 mb-2 border border-emerald-200">
                Verifikasi Berhasil!
              </span>

              <h3 className="text-xl font-extrabold text-slate-900 leading-tight">
                {isDinas
                  ? 'Presensi Dinas Luar Tercatat!'
                  : isCheckIn
                  ? 'Presensi Masuk Berhasil!'
                  : 'Presensi Pulang Berhasil!'}
              </h3>

              <p className="text-xs text-slate-500 mt-1">
                Terima kasih, <strong className="text-slate-800">{record.employeeName}</strong>. Kehadiran Anda hari ini telah sah terdata di sistem.
              </p>
            </motion.div>
          </div>

          {/* Quick Snapshot Card */}
          <div className="px-6 pb-6 space-y-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center gap-3">
                {/* Selfie Avatar thumbnail with verified tick */}
                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-200 shadow-2xs">
                  <img
                    src={record.photoUrl}
                    alt="Selfie Presensi"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-end justify-center pb-0.5">
                    <span className="text-[8px] font-bold text-white tracking-widest uppercase">
                      GPS OK
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-400">ID Dokumen:</span>
                    <span className="text-xs font-mono font-bold text-slate-700">{record.id}</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-800 font-semibold mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>{record.timeFormatted}</span>
                    <span className="text-slate-400 font-normal">• {record.dateFormatted}</span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate mt-0.5">
                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{record.location.officeName || record.location.address}</span>
                  </div>
                </div>
              </div>

              {/* Status Pill & Badge */}
              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Status Kehadiran:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    record.status === 'TEPAT_WAKTU'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : record.status === 'TERLAMBAT'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  {record.status.replace('_', ' ')}
                </span>
              </div>

              {/* Biometric Verification Badge */}
              <div className="pt-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Keamanan Biometrik:
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {record.biometricVerification?.method === 'WEBAUTHN_BIOMETRIC'
                    ? 'WebAuthn Terverifikasi'
                    : 'Biometrik Terverifikasi'}
                </span>
              </div>
            </div>

            {/* Actions: View Slip & Replay Confetti */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                id="view-detailed-receipt-btn"
                onClick={() => {
                  onClose();
                  onViewDetailedReceipt();
                }}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition transform active:scale-98 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Buka Bukti Resmi & Cetak Slip</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="replay-confetti-btn"
                  onClick={() => triggerAttendanceSuccessConfetti()}
                  className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100/80 active:bg-amber-200 text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-200/80 transition cursor-pointer"
                >
                  <PartyPopper className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ledakkan Konfeti 🎉</span>
                </button>

                <button
                  type="button"
                  id="finish-attendance-btn"
                  onClick={onClose}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
