import React, { useState, useEffect } from 'react';
import { CameraCapture } from './CameraCapture';
import { BiometricScanModal, BiometricAuthSuccessData } from './BiometricScanModal';
import { OutsideRadiusWarningModal } from './OutsideRadiusWarningModal';
import { Employee, OfficeLocation, AttendanceType, AttendanceRecord, AttendanceStatus } from '../types';
import {
  Clock,
  Calendar,
  Send,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  LogIn,
  LogOut,
  FileText,
  UserCheck,
  CloudOff,
  Fingerprint,
  ScanFace,
  ShieldCheck,
  Lock,
  BellRing,
} from 'lucide-react';
import { formatCoordinates } from '../utils/geo';
import { triggerOutsideRadiusNotification } from '../utils/shiftNotificationService';

interface AttendanceCardProps {
  employee: Employee;
  targetOffice: OfficeLocation;
  currentLat: number | null;
  currentLng: number | null;
  accuracy: number | null;
  address: string;
  distanceToOffice: number;
  isWithinRadius: boolean;
  attendanceType: AttendanceType;
  onChangeAttendanceType: (type: AttendanceType) => void;
  onSubmitAttendance: (record: AttendanceRecord) => void;
  isOffline?: boolean;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({
  employee,
  targetOffice,
  currentLat,
  currentLng,
  accuracy,
  address,
  distanceToOffice,
  isWithinRadius,
  attendanceType,
  onChangeAttendanceType,
  onSubmitAttendance,
  isOffline = false,
}) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessAnimated, setIsSuccessAnimated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Biometric authentication state (Fingerprint or Face scan check via WebAuthn)
  const [isBiometricVerified, setIsBiometricVerified] = useState<boolean>(false);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState<boolean>(false);
  const [biometricAuthData, setBiometricAuthData] = useState<BiometricAuthSuccessData | null>(null);

  // Outside radius warning & browser notification state
  const [isOutsideRadiusModalOpen, setIsOutsideRadiusModalOpen] = useState<boolean>(false);
  const [outsideRadiusNotifSent, setOutsideRadiusNotifSent] = useState<boolean>(false);
  const [outsideRadiusNotifMessage, setOutsideRadiusNotifMessage] = useState<string | null>(null);

  // Reset biometric verification if employee changes
  useEffect(() => {
    setIsBiometricVerified(false);
    setPhotoUrl(null);
    setBiometricAuthData(null);
    setOutsideRadiusNotifSent(false);
  }, [employee.id]);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format Indonesian date and time
  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(currentTime);

  const formattedTime = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(currentTime) + ' WIB';

  // Watermark text parameters
  const watermarkData = {
    employeeName: employee.name,
    nip: employee.nip,
    timeString: `${formattedDate}, ${formattedTime}`,
    coordinatesString: currentLat && currentLng ? formatCoordinates(currentLat, currentLng) : 'GPS Aktif',
    officeStatus: isWithinRadius
      ? `Radius Valid (${distanceToOffice}m dari ${targetOffice.name})`
      : attendanceType === 'DINAS_LUAR'
      ? `Dinas Luar (${targetOffice.name})`
      : `Luar Radius (${distanceToOffice}m dari ${targetOffice.name})`,
  };

  const calculateStatus = (): AttendanceStatus => {
    if (attendanceType === 'DINAS_LUAR') {
      return 'DISETUJUI';
    }

    const currentHour = currentTime.getHours();
    const currentMin = currentTime.getMinutes();
    const currentTotalMin = currentHour * 60 + currentMin;

    if (attendanceType === 'MASUK') {
      const [startH, startM] = employee.shift.startTime.split(':').map(Number);
      const shiftStartTotalMin = startH * 60 + startM;
      const lateThreshold = shiftStartTotalMin + employee.shift.lateToleranceMinutes;

      if (currentTotalMin <= lateThreshold) {
        return 'TEPAT_WAKTU';
      }
      return 'TERLAMBAT';
    }

    if (attendanceType === 'PULANG') {
      const [endH, endM] = employee.shift.endTime.split(':').map(Number);
      const shiftEndTotalMin = endH * 60 + endM;

      if (currentTotalMin < shiftEndTotalMin) {
        return 'PULANG_CEPAT';
      }
      return 'PULANG_NORMAL';
    }

    return 'TEPAT_WAKTU';
  };

  const executeSubmit = () => {
    setIsSubmitting(true);

    const record: AttendanceRecord = {
      id: `PRES-${Date.now().toString().slice(-6)}`,
      employeeId: employee.id,
      employeeName: employee.name,
      nip: employee.nip,
      department: employee.department,
      timestamp: new Date().toISOString(),
      dateFormatted: formattedDate,
      timeFormatted: formattedTime,
      type: attendanceType,
      status: calculateStatus(),
      photoUrl: photoUrl || '',
      location: {
        latitude: currentLat || 0,
        longitude: currentLng || 0,
        accuracy: accuracy || 10,
        address: address || 'Lokasi Terverifikasi',
        distanceToOffice: distanceToOffice,
        isWithinRadius: isWithinRadius,
        officeName: targetOffice.name,
      },
      notes: notes.trim() || undefined,
      deviceInfo: `${navigator.platform || 'Browser Device'} (${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'})`,
      syncStatus: isOffline ? 'OFFLINE_PENDING' : 'ONLINE_SYNCED',
      offlineQueuedAt: isOffline ? new Date().toISOString() : undefined,
      syncedAt: isOffline ? undefined : new Date().toISOString(),
      biometricVerification: {
        verified: true,
        method: biometricAuthData?.method || 'WEBAUTHN_BIOMETRIC',
        credentialId: biometricAuthData?.credentialId,
        verifiedAt: new Date().toISOString(),
        authenticatorLabel: biometricAuthData?.authenticatorLabel || 'Sensor Biometrik Perangkat',
      },
    };

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccessAnimated(true);

      // Give 450ms for the animated checkmark before launching the modal & resetting
      setTimeout(() => {
        setIsSuccessAnimated(false);
        onSubmitAttendance(record);
        // Reset form
        setPhotoUrl(null);
        setNotes('');
        setOutsideRadiusNotifSent(false);
      }, 450);
    }, 450);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    // If outside radius and not on Dinas Luar mode, dispatch browser notification warning
    if (!isWithinRadius && attendanceType !== 'DINAS_LUAR') {
      triggerOutsideRadiusNotification({
        distanceMeters: Math.round(distanceToOffice),
        maxRadiusMeters: targetOffice.radiusMeters,
        officeName: targetOffice.name,
        employeeName: employee.name,
        attendanceType: attendanceType,
      }).then((res) => {
        setOutsideRadiusNotifSent(true);
        if (res.message) setOutsideRadiusNotifMessage(res.message);
      });
    }

    // Validation 0: Biometric
    if (!isBiometricVerified) {
      setErrorMessage('Wajib menyelesaikan verifikasi biometrik (sidik jari / wajah) terlebih dahulu.');
      setIsBiometricModalOpen(true);
      return;
    }

    // Validation 1: Photo
    if (!photoUrl) {
      setErrorMessage('Wajib mengambil foto selfie real-time terlebih dahulu.');
      return;
    }

    // Validation 2: GPS coordinates
    if (currentLat === null || currentLng === null) {
      setErrorMessage('Lokasi GPS belum terdeteksi. Silakan aktifkan izin lokasi di browser.');
      return;
    }

    // Validation 3: Outside radius warning modal if user is outside radius
    if (!isWithinRadius && attendanceType !== 'DINAS_LUAR') {
      setIsOutsideRadiusModalOpen(true);
      return;
    }

    executeSubmit();
  };

  const isDinasLuar = attendanceType === 'DINAS_LUAR';
  const readyToSubmit = !!photoUrl && currentLat !== null && currentLng !== null;

  return (
    <div id="attendance-card" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 space-y-5 transition-colors duration-200">
      {/* Live Digital Clock & Shift Status */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-400/30">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono text-white">
              {formattedTime}
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              {formattedDate}
            </div>
          </div>
        </div>

        <div className="sm:text-right border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0 w-full sm:w-auto">
          <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider block">
            {employee.shift.name}
          </span>
          <span className="text-xs text-slate-200 font-medium">
            {employee.shift.startTime} - {employee.shift.endTime} WIB (Toleransi {employee.shift.lateToleranceMinutes}m)
          </span>
        </div>
      </div>

      {/* Attendance Type Selector (Tabs) */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
          Pilih Jenis Presensi
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => onChangeAttendanceType('MASUK')}
            className={`py-3 px-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
              attendanceType === 'MASUK'
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200 shadow-xs ring-1 ring-blue-500'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <LogIn className={`w-4 h-4 ${attendanceType === 'MASUK' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              <span className={`w-2 h-2 rounded-full ${attendanceType === 'MASUK' ? 'bg-blue-600 dark:bg-blue-400' : 'bg-transparent'}`} />
            </div>
            <span className="font-bold text-xs sm:text-sm">Absen Masuk</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Mulai jam kerja</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeAttendanceType('PULANG')}
            className={`py-3 px-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
              attendanceType === 'PULANG'
                ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <LogOut className={`w-4 h-4 ${attendanceType === 'PULANG' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
              <span className={`w-2 h-2 rounded-full ${attendanceType === 'PULANG' ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-transparent'}`} />
            </div>
            <span className="font-bold text-xs sm:text-sm">Absen Pulang</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Selesai jam kerja</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeAttendanceType('DINAS_LUAR')}
            className={`py-3 px-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
              attendanceType === 'DINAS_LUAR'
                ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 text-purple-900 dark:text-purple-200 shadow-xs ring-1 ring-purple-500'
                : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <Briefcase className={`w-4 h-4 ${attendanceType === 'DINAS_LUAR' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
              <span className={`w-2 h-2 rounded-full ${attendanceType === 'DINAS_LUAR' ? 'bg-purple-600 dark:bg-purple-400' : 'bg-transparent'}`} />
            </div>
            <span className="font-bold text-xs sm:text-sm">Dinas Luar</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Tugas luar kantor</span>
          </button>
        </div>
      </div>

      {/* Real-Time Camera Selfie Component with Small Live Camera Preview Window */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ScanFace className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Jendela Pratinjau Kamera & Selfie
          </label>
          <div className="flex items-center gap-2">
            {isBiometricVerified && (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                {biometricAuthData?.method === 'WEBAUTHN_BIOMETRIC'
                  ? `WebAuthn: ${biometricAuthData.authenticatorLabel || 'Biometrik'}`
                  : 'Biometrik Terverifikasi'}
              </span>
            )}
            {photoUrl && (
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Foto Siap Dikirim
              </span>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Gunakan jendela pratinjau kamera langsung untuk memastikan posisi wajah tepat di tengah, pencahayaan cukup, dan jarak ideal sebelum mengambil selfie.
        </p>

        {!isBiometricVerified ? (
          /* Biometric Security Gate Card before camera opens */
          <div
            id="biometric-locked-camera-banner"
            className="w-full max-w-md mx-auto aspect-4/3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col items-center justify-center p-6 text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Akses Jendela Kamera Terkunci Biometrik
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                Verifikasi identitas {employee.name} menggunakan sensor biometrik perangkat untuk membuka jendela pratinjau kamera langsung.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-xs">
              <button
                type="button"
                id="btn-open-biometric-auth"
                onClick={() => setIsBiometricModalOpen(true)}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Fingerprint className="w-4 h-4" />
                <span>Verifikasi WebAuthn Biometrik</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Standar Web Authentication (FIDO2) & Anti-Joki Resmi</span>
            </div>
          </div>
        ) : (
          /* Active Camera once Biometric Authentication Succeeded */
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Sesi Biometrik Aktif: {biometricAuthData?.authenticatorLabel || 'WebAuthn Perangkat'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsBiometricVerified(false);
                  setBiometricAuthData(null);
                  setPhotoUrl(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
              >
                Kunci Ulang
              </button>
            </div>
            <CameraCapture
              photoUrl={photoUrl}
              onPhotoCaptured={(url) => {
                setPhotoUrl(url);
                setErrorMessage(null);
              }}
              onRetake={() => setPhotoUrl(null)}
              watermarkData={watermarkData}
            />
          </div>
        )}
      </div>

      {/* Notes / Catatan Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
          <FileText className="w-3 h-3 text-slate-400" />
          Catatan / Rencana Kerja (Opsional)
        </label>
        <textarea
          rows={2}
          placeholder={
            isDinasLuar
              ? 'Tuliskan lokasi dinas luar dan tujuan kegiatan penugasan...'
              : 'Contoh: Masuk kerja tepat waktu, siap mengikuti daily standup...'
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-slate-50/50 dark:bg-slate-800/50"
        />
      </div>

      {/* Checklist validation items before submit */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-2 text-xs">
        <div className="font-semibold text-slate-700 dark:text-slate-300 text-xs">Validasi Kehadiran Real-Time:</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {/* Biometric Check */}
          <div className="flex items-center gap-1.5">
            {isBiometricVerified ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
            )}
            <span className={isBiometricVerified ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400 dark:text-slate-500'}>
              Biometrik Valid
            </span>
          </div>

          {/* Photo Selfie Check */}
          <div className="flex items-center gap-1.5">
            {photoUrl ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
            )}
            <span className={photoUrl ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400 dark:text-slate-500'}>Foto Selfie Diambil</span>
          </div>

          {/* GPS Check */}
          <div className="flex items-center gap-1.5">
            {currentLat && currentLng ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
            )}
            <span className={currentLat ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-slate-400 dark:text-slate-500'}>
              GPS Terdeteksi {accuracy ? `(±${Math.round(accuracy)}m)` : ''}
            </span>
          </div>

          {/* Radius Geofence Check */}
          <div className="flex items-center gap-1.5">
            {isWithinRadius || isDinasLuar ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            <span
              className={
                isWithinRadius || isDinasLuar ? 'text-slate-800 dark:text-slate-200 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'
              }
            >
              {isDinasLuar
                ? 'Pengecualian Dinas'
                : isWithinRadius
                ? 'Dalam Radius'
                : `Luar Radius (${distanceToOffice}m)`}
            </span>
          </div>
        </div>
      </div>

      {/* Error display */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Offline Mode Alert */}
      {isOffline && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 text-amber-900 dark:text-amber-200 text-xs rounded-xl flex items-start gap-2.5">
          <CloudOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Mode Offline Aktif</span>
            <p className="text-[11px] mt-0.5 opacity-90">
              Kamera selfie dan koordinat GPS tetap divalidasi. Presensi akan disimpan aman di antrian perangkat lokal dan otomatis diunggah saat koneksi internet kembali normal.
            </p>
          </div>
        </div>
      )}

      {/* Outside Radius Real-time Notice */}
      {!isWithinRadius && !isDinasLuar && (
        <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <span>Posisi di Luar Radius ({Math.round(distanceToOffice)}m &gt; {targetOffice.radiusMeters}m)</span>
            </div>
            <p className="text-[11px] opacity-90 leading-relaxed">
              Jika Anda mencoba mengirim presensi dalam status ini, sistem otomatis mengirimkan <strong>notifikasi browser</strong> dan meminta konfirmasi kehadiran luar radius atau beralih ke Dinas Luar.
            </p>
            {outsideRadiusNotifSent && (
              <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium pt-0.5">
                <BellRing className="w-3.5 h-3.5 animate-pulse" />
                <span>Notifikasi browser telah dipicu ke sistem perangkat Anda.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit Button with Smooth Dynamic Transitions */}
      <button
        id="btn-submit-attendance"
        type="button"
        disabled={isSubmitting || isSuccessAnimated}
        onClick={handleSubmit}
        className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all duration-300 active:scale-98 cursor-pointer ${
          isSuccessAnimated
            ? 'bg-emerald-600 shadow-emerald-500/30 scale-[1.01]'
            : isSubmitting
            ? 'bg-blue-700 shadow-blue-500/20'
            : isOffline
            ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
            : readyToSubmit
            ? attendanceType === 'MASUK'
              ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              : attendanceType === 'PULANG'
              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
              : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'
            : 'bg-slate-700 hover:bg-slate-800'
        } disabled:opacity-80`}
      >
        {isSuccessAnimated ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-emerald-200 animate-bounce" />
            <span className="font-extrabold tracking-wide">
              {isOffline ? 'Tersimpan di Antrian Offline!' : 'Presensi Berhasil Terverifikasi!'}
            </span>
          </>
        ) : isSubmitting ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>
              {isOffline
                ? 'Menyimpan ke Antrian Lokal...'
                : 'Memverifikasi Wajah & Koordinat GPS...'}
            </span>
          </>
        ) : isOffline ? (
          <>
            <CloudOff className="w-4 h-4" />
            <span>Simpan ke Antrian Presensi Offline</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>
              {attendanceType === 'MASUK'
                ? 'Kirim Presensi Masuk Sekarang'
                : attendanceType === 'PULANG'
                ? 'Kirim Presensi Pulang Sekarang'
                : 'Kirim Presensi Dinas Luar Sekarang'}
            </span>
          </>
        )}
      </button>

      {/* Biometric Verification Modal */}
      <BiometricScanModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        onAuthenticated={(authData) => {
          setIsBiometricVerified(true);
          setBiometricAuthData(authData);
          setIsBiometricModalOpen(false);
          setErrorMessage(null);
        }}
        employee={employee}
        attendanceType={attendanceType}
      />

      {/* Outside Radius Warning & Confirmation Modal */}
      <OutsideRadiusWarningModal
        isOpen={isOutsideRadiusModalOpen}
        onClose={() => setIsOutsideRadiusModalOpen(false)}
        distanceMeters={Math.round(distanceToOffice)}
        maxRadiusMeters={targetOffice.radiusMeters}
        officeName={targetOffice.name}
        employeeName={employee.name}
        onSwitchToDinasLuar={() => {
          onChangeAttendanceType('DINAS_LUAR');
          setIsOutsideRadiusModalOpen(false);
        }}
        onProceedAnyway={() => {
          setIsOutsideRadiusModalOpen(false);
          executeSubmit();
        }}
      />
    </div>
  );
};
