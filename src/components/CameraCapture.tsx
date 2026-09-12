import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  RefreshCw,
  SwitchCamera,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Sparkles,
  Minimize2,
  Maximize2,
  Grid3X3,
  Timer,
  Sun,
  Check,
  UserCheck,
  Focus,
} from 'lucide-react';

interface CameraCaptureProps {
  onPhotoCaptured: (photoUrl: string) => void;
  photoUrl: string | null;
  onRetake: () => void;
  watermarkData?: {
    employeeName: string;
    nip: string;
    timeString: string;
    coordinatesString: string;
    officeStatus: string;
  };
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onPhotoCaptured,
  photoUrl,
  onRetake,
  watermarkData,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [sessionTrigger, setSessionTrigger] = useState<number>(0);

  // Live positioning preview enhancement states
  const [windowSize, setWindowSize] = useState<'small' | 'standard'>('small');
  const [showGridGuide, setShowGridGuide] = useState<boolean>(true);
  const [timerSeconds, setTimerSeconds] = useState<0 | 3>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashActive, setIsFlashActive] = useState<boolean>(false);

  // Audio beep helper for countdown and shutter
  const playAudioChime = (freq = 600, duration = 0.08) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  // Check available video inputs
  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      })
      .catch(() => {});
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setCameraActive(false);
  };

  const startCamera = () => {
    setSessionTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let isCancelled = false;

    if (photoUrl) {
      stopCamera();
      return;
    }

    const initCamera = async () => {
      setCameraError(null);

      // Stop any existing tracks before requesting new stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('NOT_SUPPORTED');
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (isCancelled) {
          newStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = newStream;
        setStream(newStream);

        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          try {
            await videoRef.current.play();
          } catch (playErr: any) {
            if (playErr?.name === 'AbortError' || isCancelled) {
              return;
            }
            throw playErr;
          }
        }

        if (!isCancelled) {
          setCameraActive(true);
        }
      } catch (err: any) {
        if (isCancelled) return;
        if (err?.name === 'AbortError') return;

        console.error('Camera access error:', err);
        let errorMsg = 'Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan di browser.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMsg = 'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser atau gunakan opsi unggah foto.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMsg = 'Perangkat kamera tidak ditemukan pada perangkat ini.';
        } else if (err.message === 'NOT_SUPPORTED') {
          errorMsg = 'Browser tidak mendukung akses kamera langsung. Silakan gunakan opsi unggah foto.';
        }
        setCameraError(errorMsg);
        setCameraActive(false);
      }
    };

    initCamera();

    return () => {
      isCancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraActive(false);
    };
  }, [facingMode, photoUrl, sessionTrigger]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleTriggerCapture = () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    if (timerSeconds > 0) {
      setCountdown(timerSeconds);
      playAudioChime(660, 0.1);

      let current = timerSeconds;
      const interval = setInterval(() => {
        current -= 1;
        if (current > 0) {
          setCountdown(current);
          playAudioChime(660, 0.1);
        } else {
          clearInterval(interval);
          setCountdown(null);
          playAudioChime(950, 0.18);
          performCapture();
        }
      }, 1000);
    } else {
      playAudioChime(900, 0.12);
      performCapture();
    }
  };

  const performCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    // Trigger visual shutter flash effect
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 180);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions equal to video resolution
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // Draw video frame
    if (facingMode === 'user') {
      // Mirror front camera for natural selfie look
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    // Embed digital watermark directly into photo canvas
    drawWatermark(ctx, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    setIsCapturing(false);
    onPhotoCaptured(dataUrl);
  };

  const drawWatermark = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!watermarkData) return;

    const overlayHeight = Math.max(90, Math.round(height * 0.18));

    // Bottom dark gradient overlay for watermark readability
    const gradient = ctx.createLinearGradient(0, height - overlayHeight - 20, 0, height);
    gradient.addColorStop(0, 'rgba(15, 23, 42, 0)');
    gradient.addColorStop(0.3, 'rgba(15, 23, 42, 0.75)');
    gradient.addColorStop(1, 'rgba(15, 23, 42, 0.92)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - overlayHeight - 20, width, overlayHeight + 20);

    // Green verification pill top right
    ctx.save();
    ctx.fillStyle = '#059669'; // emerald-600
    const pillWidth = 200;
    const pillHeight = 28;
    const pillX = width - pillWidth - 16;
    const pillY = 16;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('● LIVE SELFIE VERIFIED', pillX + pillWidth / 2, pillY + pillHeight / 2);
    ctx.restore();

    // Watermark text in bottom bar
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'bottom';

    // Line 1: Name & NIP
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${watermarkData.employeeName} (${watermarkData.nip})`, 16, height - 52);

    // Line 2: Timestamp & Status
    ctx.font = '500 13px sans-serif';
    ctx.fillStyle = '#93c5fd'; // blue-300
    ctx.fillText(`🕒 ${watermarkData.timeString} | ${watermarkData.officeStatus}`, 16, height - 30);

    // Line 3: GPS Coordinates
    ctx.font = '12px monospace';
    ctx.fillStyle = '#cbd5e1'; // slate-300
    ctx.fillText(`📍 GPS: ${watermarkData.coordinatesString}`, 16, height - 12);

    ctx.restore();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          drawWatermark(ctx, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          stopCamera();
          onPhotoCaptured(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div id="camera-capture-container" className="flex flex-col items-center w-full space-y-3">
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Captured Photo View */}
      {photoUrl ? (
        <div className="w-full max-w-md mx-auto space-y-2">
          <div className="relative aspect-4/3 rounded-2xl overflow-hidden shadow-lg border-2 border-emerald-500 bg-slate-950 group">
            <img
              src={photoUrl}
              alt="Foto Selfie Presensi"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 bg-emerald-600/95 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md backdrop-blur-xs">
              <CheckCircle2 className="w-4 h-4" />
              Foto Berhasil Diambil & Terverifikasi
            </div>

            <button
              id="btn-retake-photo"
              type="button"
              onClick={onRetake}
              className="absolute bottom-3 right-3 bg-slate-900/85 hover:bg-slate-900 text-white text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md backdrop-blur-xs transition active:scale-95 border border-white/20 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Buka Pratinjau Ulang Kamera
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">Posisi selfie sudah tervalidasi. Siap untuk dikirimkan.</span>
            </div>
            <button
              type="button"
              onClick={onRetake}
              className="text-[11px] font-bold underline hover:opacity-80 cursor-pointer shrink-0 ml-2"
            >
              Periksa Posisi Lagi
            </button>
          </div>
        </div>
      ) : (
        /* Small Live Camera Preview Window View */
        <div
          id="live-camera-preview-window"
          className={`w-full mx-auto transition-all duration-300 ${
            windowSize === 'small' ? 'max-w-[340px] sm:max-w-[360px]' : 'max-w-md'
          }`}
        >
          {/* Window Frame Card */}
          <div className="rounded-2xl overflow-hidden shadow-md border border-slate-700/80 dark:border-slate-800 bg-slate-950 flex flex-col">
            {/* Window Top Title / Control Bar */}
            <div className="bg-slate-900/95 border-b border-slate-800/90 px-3 py-2 flex items-center justify-between text-xs text-slate-200 select-none">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="font-mono text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-200">
                  LIVE PREVIEW
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.2 rounded-md hidden xs:inline">
                  Sensor Aktif
                </span>
              </div>

              {/* Window Tools & Controls */}
              <div className="flex items-center gap-1.5">
                {/* Guide Grid & Silhouette Toggle */}
                <button
                  type="button"
                  id="btn-toggle-camera-grid"
                  onClick={() => setShowGridGuide((prev) => !prev)}
                  title={showGridGuide ? 'Sembunyikan Panduan Posisi' : 'Tampilkan Panduan Posisi'}
                  className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                    showGridGuide
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Grid3X3 className="w-3.5 h-3.5" />
                </button>

                {/* Timer Toggle (0s / 3s) */}
                <button
                  type="button"
                  id="btn-toggle-camera-timer"
                  onClick={() => setTimerSeconds((prev) => (prev === 0 ? 3 : 0))}
                  title={timerSeconds === 0 ? 'Aktifkan Timer 3 Detik' : 'Nonaktifkan Timer'}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                    timerSeconds > 0
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Timer className="w-3 h-3" />
                  <span>{timerSeconds > 0 ? '3s' : '0s'}</span>
                </button>

                {/* Flip Facing Camera Mode */}
                {hasMultipleCameras && (
                  <button
                    type="button"
                    id="btn-toggle-camera-facing"
                    onClick={toggleFacingMode}
                    title="Ganti Kamera Depan / Belakang"
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Window Size Mode (Small vs Standard) */}
                <button
                  type="button"
                  id="btn-toggle-window-size"
                  onClick={() => setWindowSize((prev) => (prev === 'small' ? 'standard' : 'small'))}
                  title={
                    windowSize === 'small'
                      ? 'Perluas Jendela Pratinjau'
                      : 'Kompakkan Jendela Pratinjau'
                  }
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  {windowSize === 'small' ? (
                    <Maximize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Minimize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Video Viewport Box */}
            <div className="relative aspect-4/3 overflow-hidden bg-slate-950 flex flex-col items-center justify-center">
              {cameraError ? (
                <div className="p-6 text-center flex flex-col items-center text-slate-300 max-w-xs">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-white mb-1">Akses Kamera Terkendala</p>
                  <p className="text-xs text-slate-400 mb-4">{cameraError}</p>
                  <div className="flex flex-col gap-2 w-full">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Coba Sambungkan Lagi
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" /> Unggah Foto dari Galeri
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${
                      facingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                  />

                  {/* Shutter Flash Animation */}
                  {isFlashActive && (
                    <div className="absolute inset-0 bg-white z-30 pointer-events-none transition-opacity duration-150" />
                  )}

                  {/* Positioning Guides (Oval Silhouette & Grid) */}
                  {showGridGuide && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                      {/* Rule of Thirds Grid Lines */}
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/3 left-0 right-0 h-px bg-white/10" />
                        <div className="absolute top-2/3 left-0 right-0 h-px bg-white/10" />
                        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/10" />
                        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/10" />
                      </div>

                      {/* Head Silhouette Oval */}
                      <div className="w-40 h-52 sm:w-48 sm:h-60 rounded-[50%] border-2 border-dashed border-emerald-400/90 shadow-[0_0_20px_rgba(16,185,129,0.35)] flex flex-col items-center justify-start pt-3 relative">
                        <div className="bg-slate-900/80 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-xs flex items-center gap-1 border border-emerald-500/40">
                          <Focus className="w-3 h-3 text-emerald-400" />
                          <span>Posisikan Wajah</span>
                        </div>
                        {/* Subtle target crosshairs */}
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-400/30" />
                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-emerald-400/30" />
                      </div>

                      {/* Distance & Lighting Positioning Prompt */}
                      <div className="mt-2.5 bg-slate-900/75 text-white/90 text-[10px] font-medium px-2.5 py-0.5 rounded-full backdrop-blur-xs border border-white/10 flex items-center gap-1">
                        <Sun className="w-3 h-3 text-amber-400" />
                        <span>Jarak ideal 40-60 cm | Wajah tegak & simetris</span>
                      </div>
                    </div>
                  )}

                  {/* Countdown Display Overlay */}
                  {countdown !== null && (
                    <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center z-20">
                      <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-4xl font-extrabold shadow-2xl border-4 border-white animate-pulse">
                        {countdown}
                      </div>
                    </div>
                  )}

                  {/* Capture Button Trigger */}
                  <div className="absolute bottom-3.5 left-0 right-0 flex items-center justify-center gap-4 z-20">
                    <button
                      id="btn-capture-selfie"
                      type="button"
                      disabled={!cameraActive || isCapturing || countdown !== null}
                      onClick={handleTriggerCapture}
                      className="group relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/25 p-1 backdrop-blur-xs transition hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                      title="Ambil Foto Selfie Presensi"
                    >
                      <div className="w-full h-full rounded-full bg-emerald-500 group-hover:bg-emerald-400 flex items-center justify-center shadow-lg border-2 border-white transition">
                        <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                    </button>

                    {/* Secondary upload option */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute right-3 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-xl backdrop-blur-xs border border-white/20 flex items-center gap-1 cursor-pointer"
                      title="Gunakan file foto"
                    >
                      <Upload className="w-3 h-3" />
                      <span className="hidden sm:inline">Galeri</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Positioning Verification HUD Checklist below the preview window */}
          <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-center gap-1">
              <Focus className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">Posisi Pas</span>
            </div>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-semibold flex items-center justify-center gap-1">
              <Sun className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="truncate">Cahaya Cukup</span>
            </div>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 font-semibold flex items-center justify-center gap-1">
              <UserCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="truncate">Tatap Lensa</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

