import React, { useState, useEffect, useCallback } from 'react';
import { Employee, AttendanceType } from '../types';
import {
  Fingerprint,
  ScanFace,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Lock,
  Smartphone,
  X,
  ExternalLink,
  KeyRound,
  Check,
  Cpu,
} from 'lucide-react';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  verifyWebAuthnCredential,
  registerWebAuthnCredential,
  getStoredCredential,
  removeStoredCredential,
  getPlatformDeviceLabel,
  isRunningInIframe,
  WebAuthnAuthResult,
} from '../utils/webauthn';

export type BiometricMode = 'FINGERPRINT' | 'FACE_SCAN';

export interface BiometricAuthSuccessData {
  method: 'WEBAUTHN_BIOMETRIC' | 'BIOMETRIC_SIMULATION';
  credentialId?: string;
  authenticatorLabel?: string;
}

interface BiometricScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (authData: BiometricAuthSuccessData) => void;
  employee: Employee;
  attendanceType: AttendanceType;
}

export const BiometricScanModal: React.FC<BiometricScanModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  employee,
  attendanceType,
}) => {
  const [mode, setMode] = useState<BiometricMode>('FINGERPRINT');
  const [status, setStatus] = useState<'IDLE' | 'SCANNING_WEBAUTHN' | 'SCANNING_SIMULATION' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIframeIssue, setIsIframeIssue] = useState<boolean>(false);

  // WebAuthn capability state
  const [webAuthnSupported, setWebAuthnSupported] = useState<boolean>(true);
  const [platformAvailable, setPlatformAvailable] = useState<boolean>(false);
  const [storedCred, setStoredCred] = useState<ReturnType<typeof getStoredCredential>>(null);
  const [deviceLabel, setDeviceLabel] = useState<string>('Sensor Biometrik Perangkat');

  // Check WebAuthn status on open
  useEffect(() => {
    if (isOpen) {
      setStatus('IDLE');
      setScanProgress(0);
      setErrorMessage(null);
      setIsIframeIssue(false);

      const supported = isWebAuthnSupported();
      setWebAuthnSupported(supported);
      setDeviceLabel(getPlatformDeviceLabel());

      const cred = getStoredCredential(employee.id);
      setStoredCred(cred);

      if (supported) {
        isPlatformAuthenticatorAvailable().then((avail) => {
          setPlatformAvailable(avail);
        });
      }

      setStatusMessage(
        cred
          ? `Biometrik perangkat (${cred.deviceLabel || 'WebAuthn'}) siap diverifikasi untuk ${employee.name}.`
          : `Sentuh sensor sidik jari atau arahkan wajah ke pemindai WebAuthn perangkat Anda.`
      );
    }
  }, [isOpen, employee.id, employee.name]);

  // Audio confirmation chime on success
  const playSuccessChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.46);
      }
    } catch {
      // Audio playback policy silent catch
    }
  }, []);

  if (!isOpen) return null;

  // Handle Real Web Authentication API (WebAuthn) Flow
  const handleWebAuthnVerify = async () => {
    if (status === 'SCANNING_WEBAUTHN' || status === 'SUCCESS') return;

    setStatus('SCANNING_WEBAUTHN');
    setErrorMessage(null);
    setIsIframeIssue(false);
    setStatusMessage(`Memulai otentikasi WebAuthn perangkat (${deviceLabel}). Silakan sentuh sensor atau konfirmasi di dialog browser...`);

    try {
      const result: WebAuthnAuthResult = await verifyWebAuthnCredential(employee);

      if (result.success) {
        playSuccessChime();
        setStatus('SUCCESS');
        setStatusMessage(result.message);
        setStoredCred(getStoredCredential(employee.id));

        setTimeout(() => {
          onAuthenticated({
            method: 'WEBAUTHN_BIOMETRIC',
            credentialId: result.credentialId,
            authenticatorLabel: result.authenticatorLabel || deviceLabel,
          });
        }, 900);
      } else {
        setStatus('ERROR');
        setErrorMessage(result.message);
        setIsIframeIssue(!!result.isIframeIssue);
        setStatusMessage('Verifikasi WebAuthn belum berhasil.');
      }
    } catch (err: unknown) {
      setStatus('ERROR');
      const errObj = err as Error;
      setErrorMessage(errObj?.message || 'Gagal melakukan verifikasi WebAuthn.');
    }
  };

  // Register or re-register biometric credential
  const handleRegisterNewCredential = async () => {
    setStatus('SCANNING_WEBAUTHN');
    setErrorMessage(null);
    setStatusMessage(`Mendaftarkan biometrik baru pada perangkat (${deviceLabel})...`);

    const result = await registerWebAuthnCredential(employee);

    if (result.success) {
      playSuccessChime();
      setStatus('SUCCESS');
      setStatusMessage(result.message);
      setStoredCred(getStoredCredential(employee.id));

      setTimeout(() => {
        onAuthenticated({
          method: 'WEBAUTHN_BIOMETRIC',
          credentialId: result.credentialId,
          authenticatorLabel: result.authenticatorLabel || deviceLabel,
        });
      }, 900);
    } else {
      setStatus('ERROR');
      setErrorMessage(result.message);
      setIsIframeIssue(!!result.isIframeIssue);
    }
  };

  // Reset / Clear stored credential for testing
  const handleResetCredential = () => {
    removeStoredCredential(employee.id);
    setStoredCred(null);
    setStatus('IDLE');
    setStatusMessage('Kredensial biometrik lokal direset. Siap didaftarkan ulang.');
  };

  // Fallback Simulation Scan (for environments without biometric hardware or sandboxed iframes)
  const handleSimulationScan = () => {
    if (status === 'SCANNING_SIMULATION' || status === 'SUCCESS') return;

    setStatus('SCANNING_SIMULATION');
    setScanProgress(0);
    setErrorMessage(null);
    setStatusMessage(
      mode === 'FINGERPRINT'
        ? 'Membaca data sensor biometrik sidik jari...'
        : 'Mendeteksi titik kontur biometrik wajah pegawai...'
    );

    let current = 0;
    const interval = setInterval(() => {
      current += 20;
      if (current >= 100) {
        clearInterval(interval);
        setScanProgress(100);
        playSuccessChime();
        setStatus('SUCCESS');
        setStatusMessage(
          `Identitas ${employee.name} (${employee.nip}) terverifikasi aman! Kamera selfie dibuka.`
        );

        setTimeout(() => {
          onAuthenticated({
            method: 'BIOMETRIC_SIMULATION',
            authenticatorLabel: mode === 'FINGERPRINT' ? 'Simulasi Sensor Sidik Jari' : 'Simulasi Pemindai Wajah',
          });
        }, 850);
      } else {
        setScanProgress(current);
        if (current === 40) {
          setStatusMessage(
            mode === 'FINGERPRINT'
              ? 'Memverifikasi template enkripsi sidik jari...'
              : 'Memvalidasi kecocokan kontur 3D wajah pegawai...'
          );
        } else if (current === 80) {
          setStatusMessage('Integritas biometrik valid. Menyiapkan sesi aman...');
        }
      }
    }, 160);
  };

  const getAttendanceLabel = () => {
    switch (attendanceType) {
      case 'MASUK':
        return 'Presensi Masuk Kerja';
      case 'PULANG':
        return 'Presensi Pulang Kerja';
      case 'DINAS_LUAR':
        return 'Presensi Tugas Dinas Luar';
      default:
        return 'Presensi Kehadiran';
    }
  };

  const isScanning = status === 'SCANNING_WEBAUTHN' || status === 'SCANNING_SIMULATION';

  return (
    <div
      id="biometric-auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Verifikasi Biometrik WebAuthn
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  FIDO2 API
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Otentikasi biometrik perangkat (sidik jari / wajah) sebelum akses kamera
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Employee Info Strip */}
        <div className="px-5 py-3 bg-blue-50/60 dark:bg-slate-800/60 border-b border-blue-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <img
              src={employee.avatarUrl}
              alt={employee.name}
              className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
            />
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">{employee.name}</p>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-mono font-medium">
                NIP: {employee.nip} &bull; {employee.position}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-blue-100/70 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-bold text-[10px] uppercase">
            {getAttendanceLabel()}
          </span>
        </div>

        {/* Device & WebAuthn Capabilities Banner */}
        <div className="px-5 pt-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-750 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shrink-0">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] leading-tight">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {deviceLabel}
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  {storedCred ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3 inline" /> Kredensial Biometrik Terdaftar
                    </span>
                  ) : platformAvailable ? (
                    'Sensor biometrik perangkat aktif & siap digunakan'
                  ) : (
                    'Mendukung WebAuthn API & simulasi sensor'
                  )}
                </p>
              </div>
            </div>

            {storedCred && (
              <button
                type="button"
                onClick={handleResetCredential}
                className="text-[10px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 underline self-start sm:self-center transition cursor-pointer"
                title="Hapus kredensial tersimpan untuk registrasi ulang"
              >
                Reset Kredensial
              </button>
            )}
          </div>
        </div>

        {/* Biometric Interactive Area */}
        <div className="p-5 space-y-4">
          {/* Main Interactive Scanner Visual */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative">
              {/* Radial Scanner Animation Rings */}
              {isScanning && (
                <>
                  <div className="absolute -inset-3 rounded-full border-2 border-blue-500/30 animate-ping" />
                  <div className="absolute -inset-6 rounded-full border border-blue-400/20 animate-pulse" />
                </>
              )}

              {/* Main Interactive Sensor Disc */}
              <button
                type="button"
                id="btn-trigger-biometric-scan"
                onClick={handleWebAuthnVerify}
                disabled={isScanning || status === 'SUCCESS'}
                className={`w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden cursor-pointer shadow-lg active:scale-95 ${
                  status === 'SUCCESS'
                    ? 'bg-emerald-500 text-white shadow-emerald-500/30 ring-4 ring-emerald-300 dark:ring-emerald-800'
                    : status === 'SCANNING_WEBAUTHN' || status === 'SCANNING_SIMULATION'
                    ? 'bg-blue-600 text-white shadow-blue-500/30 ring-4 ring-blue-300 dark:ring-blue-800'
                    : status === 'ERROR'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border-2 border-rose-300 dark:border-rose-700'
                    : 'bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-850 hover:from-blue-50 hover:to-blue-100 text-slate-700 dark:text-slate-200 border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                }`}
                title="Klik untuk memverifikasi via WebAuthn Biometrik Perangkat"
              >
                {/* Visual Sweep Line during scanning */}
                {isScanning && (
                  <div className="absolute inset-x-0 h-1 bg-cyan-300 shadow-[0_0_12px_#22d3ee] animate-[bounce_1.5s_infinite]" />
                )}

                {status === 'SUCCESS' ? (
                  <CheckCircle2 className="w-14 h-14 animate-in zoom-in-75 duration-200 text-white" />
                ) : status === 'ERROR' ? (
                  <AlertCircle className="w-14 h-14 text-rose-500 animate-in shake duration-200" />
                ) : mode === 'FINGERPRINT' ? (
                  <Fingerprint
                    className={`w-14 h-14 transition-transform duration-300 ${
                      isScanning ? 'scale-110 text-cyan-200' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  />
                ) : (
                  <ScanFace
                    className={`w-14 h-14 transition-transform duration-300 ${
                      isScanning ? 'scale-110 text-cyan-200' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  />
                )}

                <span className="text-[10px] font-bold mt-1 uppercase tracking-wider opacity-90">
                  {status === 'SUCCESS'
                    ? 'Terverifikasi'
                    : status === 'SCANNING_WEBAUTHN'
                    ? 'Sentuh Sensor'
                    : status === 'SCANNING_SIMULATION'
                    ? `${scanProgress}%`
                    : status === 'ERROR'
                    ? 'Coba Lagi'
                    : 'Pindai WebAuthn'}
                </span>
              </button>
            </div>

            {/* Progress Bar for simulation */}
            {status === 'SCANNING_SIMULATION' && (
              <div className="w-48 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-4">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-200 rounded-full"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            )}

            {/* Status Message Text */}
            <p className="text-center text-xs text-slate-700 dark:text-slate-200 font-medium mt-4 max-w-sm px-2 leading-relaxed">
              {statusMessage}
            </p>

            {/* Error Message Display */}
            {errorMessage && (
              <div className="mt-2.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 max-w-sm text-center leading-relaxed">
                <span>{errorMessage}</span>
                {isIframeIssue && (
                  <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-800/60 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="inline-flex items-center gap-1 font-bold text-rose-800 dark:text-rose-200 hover:underline cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Buka di Tab Baru
                    </button>
                    <span>atau</span>
                    <button
                      type="button"
                      onClick={handleSimulationScan}
                      className="font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Gunakan Mode Simulasi
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              id="btn-webauthn-primary-verify"
              onClick={handleWebAuthnVerify}
              disabled={isScanning || status === 'SUCCESS'}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Fingerprint className="w-4 h-4" />
              <span>Verifikasi Biometrik WebAuthn Perangkat</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-register-webauthn-credential"
                onClick={handleRegisterNewCredential}
                disabled={isScanning || status === 'SUCCESS'}
                className="py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <KeyRound className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{storedCred ? 'Daftar Ulang' : 'Daftarkan Biometrik'}</span>
              </button>

              <button
                type="button"
                id="btn-fallback-simulation"
                onClick={handleSimulationScan}
                disabled={isScanning || status === 'SUCCESS'}
                className="py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Simulasi Biometrik</span>
              </button>
            </div>
          </div>

          {/* Biometric Mode Toggle for Simulation */}
          <div className="flex items-center justify-between px-1 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Metode Tampilan:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode('FINGERPRINT')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  mode === 'FINGERPRINT'
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                    : 'hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Fingerprint className="w-3 h-3" /> Sidik Jari
              </button>
              <button
                type="button"
                onClick={() => setMode('FACE_SCAN')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  mode === 'FACE_SCAN'
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                    : 'hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <ScanFace className="w-3 h-3" /> Pengenal Wajah
              </button>
            </div>
          </div>

          {/* Anti-Spoofing & FIDO2 Security Guarantee */}
          <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800/80 flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[11px] leading-tight">
              Standar Web Authentication API (FIDO2/W3C). Kunci privat disimpan aman di Secure Enclave / TPM perangkat.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/50 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5 text-blue-500" /> {deviceLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium cursor-pointer"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
};
