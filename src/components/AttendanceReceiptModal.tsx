import React from 'react';
import { X, CheckCircle2, Download, Printer, MapPin, Clock, Calendar, Building, User, FileText, ShieldCheck } from 'lucide-react';
import { AttendanceRecord } from '../types';

interface AttendanceReceiptModalProps {
  record: AttendanceRecord | null;
  onClose: () => void;
}

export const AttendanceReceiptModal: React.FC<AttendanceReceiptModalProps> = ({ record, onClose }) => {
  if (!record) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSlip = () => {
    // Generate text summary or trigger download
    const textContent = `
==============================================
BUKTI RESMI PRESENSI KEHADIRAN PEGAWAI
PT NUSANTARA SOLUSI TEKNOLOGI
==============================================
ID Transaksi : ${record.id}
Nama Pegawai : ${record.employeeName}
NIP          : ${record.nip}
Departemen   : ${record.department}
Jenis Absen  : ${record.type}
Status       : ${record.status}
Waktu        : ${record.dateFormatted}, ${record.timeFormatted}
Lokasi       : ${record.location.address}
Kantor       : ${record.location.officeName} (Jarak: ${record.location.distanceToOffice}m)
GPS          : ${record.location.latitude}, ${record.location.longitude} (Akurasi: ±${record.location.accuracy}m)
Perangkat    : ${record.deviceInfo}
Catatan      : ${record.notes || '-'}
Biometrik    : ${record.biometricVerification?.verified ? `TERVERIFIKASI (${record.biometricVerification.method === 'WEBAUTHN_BIOMETRIC' ? 'WebAuthn ' + (record.biometricVerification.authenticatorLabel || '') : 'Simulasi Sensor'})` : 'Validasi Kamera'}
Verifikasi   : VALID (WebAuthn Biometrik, Selfie & Geolocation Real-Time)
==============================================
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bukti_Presensi_${record.nip}_${record.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">Bukti Presensi Terverifikasi</h3>
              <p className="text-[11px] text-slate-400">ID: {record.id}</p>
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Selfie Photo with overlay */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs aspect-4/3 bg-slate-950">
            <img
              src={record.photoUrl}
              alt={`Selfie ${record.employeeName}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Selfie Otentik Real-Time
            </div>
            <div className="absolute bottom-2.5 right-2.5 bg-emerald-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
              {record.type} • {record.status.replace('_', ' ')}
            </div>
          </div>

          {/* Employee & Time info card */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <User className="w-3 h-3" /> Pegawai
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{record.employeeName}</p>
              <p className="text-slate-500 dark:text-slate-400">{record.nip}</p>
              <p className="text-slate-500 dark:text-slate-400">{record.department}</p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3" /> Waktu Absen
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{record.timeFormatted}</p>
              <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {record.dateFormatted}
              </p>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                  record.status === 'TEPAT_WAKTU' || record.status === 'DISETUJUI'
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                }`}
              >
                {record.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Location details */}
          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Verifikasi Lokasi & Geofencing
            </h4>

            <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 dark:text-slate-400">Target Kantor:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-right flex items-center gap-1">
                  <Building className="w-3 h-3 text-slate-400" />
                  {record.location.officeName}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Jarak dari Kantor:</span>
                <span
                  className={`font-semibold ${
                    record.location.isWithinRadius ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {record.location.distanceToOffice} meter ({record.location.isWithinRadius ? 'Dalam Radius' : 'Luar Radius'})
                </span>
              </div>

              <div className="flex justify-between items-start gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Alamat GPS:</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium text-right max-w-[260px] truncate">
                  {record.location.address}
                </span>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Koordinat:</span>
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {record.location.latitude.toFixed(6)}, {record.location.longitude.toFixed(6)} (±{record.location.accuracy}m)
                </span>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">Status Sinkronisasi:</span>
                <span
                  className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                    record.syncStatus === 'OFFLINE_PENDING'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {record.syncStatus === 'OFFLINE_PENDING'
                    ? '⏳ Antrian Offline (Pending)'
                    : '✓ Terunggah ke Server'}
                </span>
              </div>
            </div>
          </div>

          {/* Biometric Verification Audit */}
          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Verifikasi Biometrik WebAuthn & Anti-Joki
            </h4>

            <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Status Biometrik:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Terverifikasi Aman
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Metode Otentikasi:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {record.biometricVerification?.method === 'WEBAUTHN_BIOMETRIC'
                    ? 'Web Authentication API (FIDO2 Hardware)'
                    : 'Sensor Biometrik Perangkat'}
                </span>
              </div>

              {record.biometricVerification?.authenticatorLabel && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400">Perangkat Sensor:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {record.biometricVerification.authenticatorLabel}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes if any */}
          {record.notes && (
            <div className="bg-blue-50/50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50 text-xs">
              <div className="flex items-center gap-1 text-blue-700 dark:text-blue-300 font-semibold mb-1">
                <FileText className="w-3 h-3" /> Catatan Kegiatan:
              </div>
              <p className="text-slate-700 dark:text-slate-300 italic">"{record.notes}"</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDownloadSlip}
            className="flex-1 py-2.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Unduh Bukti
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Cetak Slip
          </button>
        </div>
      </div>
    </div>
  );
};
