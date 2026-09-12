import React, { useState } from 'react';
import { X, Building2, Plus, Check, MapPin, Crosshair, Trash2 } from 'lucide-react';
import { OfficeLocation } from '../types';

interface OfficeSettingsModalProps {
  offices: OfficeLocation[];
  activeOfficeId: string;
  onSaveOffices: (offices: OfficeLocation[], selectedId: string) => void;
  onClose: () => void;
  currentLat: number | null;
  currentLng: number | null;
}

export const OfficeSettingsModal: React.FC<OfficeSettingsModalProps> = ({
  offices,
  activeOfficeId,
  onSaveOffices,
  onClose,
  currentLat,
  currentLng,
}) => {
  const [officeList, setOfficeList] = useState<OfficeLocation[]>(offices);
  const [selectedId, setSelectedId] = useState<string>(activeOfficeId);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  // New office form state
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLat, setNewLat] = useState<string>(currentLat ? currentLat.toString() : '-6.2088');
  const [newLng, setNewLng] = useState<string>(currentLng ? currentLng.toString() : '106.8456');
  const [newRadius, setNewRadius] = useState<number>(150);

  const handleUpdateRadius = (id: string, radius: number) => {
    setOfficeList((prev) =>
      prev.map((o) => (o.id === id ? { ...o, radiusMeters: Math.max(20, radius) } : o))
    );
  };

  const handleAddOffice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newOffice: OfficeLocation = {
      id: `office-custom-${Date.now()}`,
      name: newName.trim(),
      address: newAddress.trim() || 'Alamat Cabang Kantor',
      latitude: parseFloat(newLat) || -6.2,
      longitude: parseFloat(newLng) || 106.8,
      radiusMeters: Number(newRadius) || 150,
      isCustom: true,
    };

    const updated = [...officeList, newOffice];
    setOfficeList(updated);
    setSelectedId(newOffice.id);
    setShowAddForm(false);
    setNewName('');
    setNewAddress('');
  };

  const handleDeleteOffice = (id: string) => {
    if (officeList.length <= 1) return;
    const filtered = officeList.filter((o) => o.id !== id);
    setOfficeList(filtered);
    if (selectedId === id) {
      setSelectedId(filtered[0].id);
    }
  };

  const handleFillCurrentCoords = () => {
    if (currentLat && currentLng) {
      setNewLat(currentLat.toString());
      setNewLng(currentLng.toString());
      if (!newName) setNewName('Kantor Lokasi Saya (Uji Coba)');
      if (!newAddress) setNewAddress('Berdasarkan deteksi GPS browser saat ini');
    }
  };

  const handleSaveAndApply = () => {
    onSaveOffices(officeList, selectedId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-sm">Pengaturan Geofencing & Titik Kantor</h3>
              <p className="text-[11px] text-slate-400">Kelola daftar kantor dan radius toleransi presensi</p>
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
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Daftar Lokasi Kantor ({officeList.length})
            </h4>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Cabang
            </button>
          </div>

          {/* Add New Branch Form */}
          {showAddForm && (
            <form
              onSubmit={handleAddOffice}
              className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 space-y-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Form Cabang Baru</span>
                {currentLat && currentLng && (
                  <button
                    type="button"
                    onClick={handleFillCurrentCoords}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Crosshair className="w-3 h-3" /> Gunakan Koordinat Saya Sekarang
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Nama Kantor / Cabang</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kantor Cabang Bali / Gedung Mitra"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Alamat Lengkap</label>
                <input
                  type="text"
                  placeholder="Contoh: Jl. Sunset Road No. 88, Kuta, Bali"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newLng}
                    onChange={(e) => setNewLng(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">Radius (Meter)</label>
                  <input
                    type="number"
                    min="20"
                    max="100000"
                    required
                    value={newRadius}
                    onChange={(e) => setNewRadius(Number(e.target.value))}
                    className="w-full text-xs p-2 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                >
                  Simpan Cabang
                </button>
              </div>
            </form>
          )}

          {/* Office Items */}
          <div className="space-y-3">
            {officeList.map((office) => {
              const isSelected = selectedId === office.id;
              return (
                <div
                  key={office.id}
                  onClick={() => setSelectedId(office.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{office.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                        Radius: {office.radiusMeters}m
                      </span>
                      {office.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOffice(office.id);
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">{office.address}</p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pl-6 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      Lat: {office.latitude.toFixed(4)}, Lng: {office.longitude.toFixed(4)}
                    </span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <span className="text-slate-500 dark:text-slate-400">Ubah Radius:</span>
                      <select
                        value={office.radiusMeters}
                        onChange={(e) => handleUpdateRadius(office.id, Number(e.target.value))}
                        className="text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md py-0.5 px-1 bg-white dark:bg-slate-800 cursor-pointer"
                      >
                        <option value={50}>50 m</option>
                        <option value={100}>100 m</option>
                        <option value={150}>150 m</option>
                        <option value={250}>250 m</option>
                        <option value={500}>500 m</option>
                        <option value={1000}>1 km</option>
                        <option value={500000}>Nasional (WFH)</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-950 p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveAndApply}
            className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition cursor-pointer"
          >
            Terapkan Lokasi Kantor
          </button>
        </div>
      </div>
    </div>
  );
};
