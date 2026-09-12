import React from 'react';
import { MapPin, Navigation, Compass, CheckCircle2, AlertOctagon, RotateCw, Settings2, Building2, Crosshair } from 'lucide-react';
import { OfficeLocation } from '../types';
import { formatCoordinates, formatDistance } from '../utils/geo';

interface LocationRadarProps {
  currentLat: number | null;
  currentLng: number | null;
  accuracy: number | null;
  address: string;
  isLocating: boolean;
  locationError: string | null;
  targetOffice: OfficeLocation;
  distanceToOffice: number;
  isWithinRadius: boolean;
  onRefreshLocation: () => void;
  onSetCurrentAsOffice: () => void;
  onSelectOffice: (office: OfficeLocation) => void;
  allOffices: OfficeLocation[];
  onOpenOfficeModal: () => void;
  attendanceType: string;
}

export const LocationRadar: React.FC<LocationRadarProps> = ({
  currentLat,
  currentLng,
  accuracy,
  address,
  isLocating,
  locationError,
  targetOffice,
  distanceToOffice,
  isWithinRadius,
  onRefreshLocation,
  onSetCurrentAsOffice,
  onSelectOffice,
  allOffices,
  onOpenOfficeModal,
  attendanceType,
}) => {
  const isDinasLuar = attendanceType === 'DINAS_LUAR';
  const effectiveValid = isWithinRadius || isDinasLuar;

  // Calculate percentage of distance vs radius for visual radar
  // If distance is 0, user is in center (0%). If distance is targetOffice.radiusMeters, user is on boundary (50%).
  const visualScale = Math.min(1.8, Math.max(0.1, distanceToOffice / (targetOffice.radiusMeters * 1.5)));
  const radarDistancePx = Math.min(100, Math.round(visualScale * 55));

  return (
    <div id="location-radar-card" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col gap-4 transition-colors duration-200">
      {/* Header & Office Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Lokasi Target Kantor</h3>
            <div className="flex items-center gap-2">
              <select
                id="office-select"
                value={targetOffice.id}
                onChange={(e) => {
                  const found = allOffices.find((o) => o.id === e.target.value);
                  if (found) onSelectOffice(found);
                }}
                className="font-semibold text-slate-800 dark:text-slate-100 dark:bg-slate-900 text-sm border-none p-0 focus:ring-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
              >
                {allOffices.map((off) => (
                  <option key={off.id} value={off.id} className="dark:bg-slate-900 dark:text-slate-100">
                    {off.name} (Max {off.radiusMeters >= 1000 ? `${off.radiusMeters / 1000}km` : `${off.radiusMeters}m`})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            id="btn-open-office-modal"
            type="button"
            onClick={onOpenOfficeModal}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer"
            title="Konfigurasi Radius & Titik Kantor"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden md:inline text-xs">Ubah Radius</span>
          </button>
          <button
            id="btn-refresh-gps"
            type="button"
            onClick={onRefreshLocation}
            disabled={isLocating}
            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg text-xs font-medium transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            title="Segarkan Koordinat GPS"
          >
            <RotateCw className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span className="text-xs">Update GPS</span>
          </button>
        </div>
      </div>

      {/* Visual Radar & Distance Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Radar Graphic */}
        <div className="md:col-span-5 flex flex-col items-center justify-center relative py-2">
          <div className="w-40 h-40 relative flex items-center justify-center">
            {/* Outer Geofence Zone Circle */}
            <div
              className={`absolute inset-0 rounded-full border-2 border-dashed ${
                effectiveValid
                  ? 'border-emerald-400 dark:border-emerald-500/60 bg-emerald-500/5'
                  : 'border-rose-300 dark:border-rose-500/40 bg-rose-500/5'
              }`}
            />
            {/* Safe Radius Circle (inner) */}
            <div
              className={`w-24 h-24 rounded-full border ${
                effectiveValid
                  ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-500/10'
                  : 'border-rose-400 dark:border-rose-500 bg-rose-500/10'
              } flex items-center justify-center`}
            >
              {/* Center Office Pin */}
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md z-10" title="Titik Kantor Pusat">
                <Building2 className="w-4 h-4" />
              </div>
            </div>

            {/* Dynamic User Pin based on distance */}
            <div
              className="absolute z-20 flex flex-col items-center transition-all duration-700 pointer-events-none"
              style={{
                transform: `translate(${isWithinRadius ? 15 : radarDistancePx}px, ${
                  isWithinRadius ? -18 : -radarDistancePx
                }px)`,
              }}
            >
              <div
                className={`w-7 h-7 rounded-full text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800 animate-pulse ${
                  effectiveValid ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
                title="Posisi GPS Anda Saat Ini"
              >
                <Navigation className="w-3.5 h-3.5 -rotate-45" />
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-slate-900/90 text-white shadow-xs whitespace-nowrap mt-0.5">
                Anda
              </span>
            </div>

            {/* Radar Sweep Animation */}
            <div className="absolute inset-2 rounded-full border border-blue-400/20 pointer-events-none animate-ping opacity-25" />
          </div>

          <div className="text-center mt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Radius Izin Kantor:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {targetOffice.radiusMeters >= 1000 ? `${targetOffice.radiusMeters / 1000} km` : `${targetOffice.radiusMeters} m`}
              </strong>
            </span>
          </div>
        </div>

        {/* Location Info & Geofence Status */}
        <div className="md:col-span-7 flex flex-col gap-3">
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              isDinasLuar
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200'
                : isWithinRadius
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200'
            }`}
          >
            <div className="mt-0.5">
              {isDinasLuar ? (
                <Compass className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              ) : isWithinRadius ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              )}
            </div>
            <div className="flex-1 text-xs leading-relaxed">
              <div className="font-bold text-sm">
                {isDinasLuar
                  ? 'Mode Dinas Luar Kantor'
                  : isWithinRadius
                  ? 'Di Dalam Radius Kantor (Valid)'
                  : 'Di Luar Radius Kantor'}
              </div>
              <div>
                {isDinasLuar ? (
                  <span>Penugasan dinas di luar kantor diizinkan dengan melampirkan laporan kegiatan.</span>
                ) : isWithinRadius ? (
                  <span>
                    Jarak Anda <strong>{formatDistance(distanceToOffice)}</strong> dari titik kantor. Presensi dapat
                    diterima secara otomatis.
                  </span>
                ) : (
                  <span>
                    Jarak Anda <strong>{formatDistance(distanceToOffice)}</strong> (melebihi batas radius{' '}
                    <strong>{targetOffice.radiusMeters}m</strong>). Notifikasi browser otomatis dikirim saat presensi dicoba.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Coordinates and Address Box */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
            <div className="flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Alamat Terdeteksi: </span>
                <span className="text-slate-600 dark:text-slate-300">{address || (isLocating ? 'Mendeteksi alamat...' : 'Lokasi teridentifikasi')}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
              <div>
                <span>GPS: </span>
                <span className="font-mono text-slate-700 dark:text-slate-200">
                  {currentLat && currentLng ? formatCoordinates(currentLat, currentLng) : 'Menghubungkan sensor GPS...'}
                </span>
              </div>
              <div>
                <span>Akurasi: </span>
                <span className="font-mono text-slate-700 dark:text-slate-200">{accuracy ? `±${Math.round(accuracy)}m` : '-'}</span>
              </div>
            </div>
          </div>

          {/* Quick calibration action for testing */}
          {!isWithinRadius && currentLat && currentLng && !isDinasLuar && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onSetCurrentAsOffice}
                className="w-full py-2 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                title="Set koordinat GPS saya saat ini sebagai lokasi kantor untuk kemudahan uji coba presensi"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Kalibrasi: Set Lokasi Saya Sebagai Titik Kantor
              </button>
            </div>
          )}

          {locationError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 italic">
              *Catatan GPS: {locationError}. Tetap dapat melakukan simulasi dengan presensi kantor.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
