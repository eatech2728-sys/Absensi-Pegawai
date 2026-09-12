import { Employee, AttendanceRecord } from '../types';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

const REMINDER_SENT_KEY_PREFIX = 'presensi_shift_reminder_sent_';

/**
 * Check if the browser supports Notifications and Service Workers
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionState;
  } catch (err) {
    console.warn('Gagal meminta izin notifikasi:', err);
    return Notification.permission as NotificationPermissionState;
  }
}

/**
 * Ensure the Service Worker at /sw.js is registered
 */
export async function registerPresensiServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[SW Registration] Service Worker presensi berhasil didaftarkan:', registration.scope);

    // If waiting or installing, wait until active
    if (registration.installing) {
      console.log('[SW Registration] Service Worker sedang menginstal...');
    } else if (registration.waiting) {
      console.log('[SW Registration] Service Worker menunggu aktivasi...');
    } else if (registration.active) {
      console.log('[SW Registration] Service Worker aktif & siap.');
    }

    return registration;
  } catch (error) {
    console.warn('[SW Registration] Gagal mendaftarkan Service Worker:', error);
    return null;
  }
}

/**
 * Calculate milliseconds until the next reminder time for an employee shift
 * Reminder is set to 15 minutes before shift startTime (e.g. 07:45 WIB for 08:00 WIB shift)
 */
export function calculateShiftReminderDelay(shiftStartTime: string): {
  delayMs: number;
  reminderTimeFormatted: string;
  isToday: boolean;
} {
  const [startH, startM] = shiftStartTime.split(':').map(Number);
  const now = new Date();

  // Target time: 15 minutes before shift start
  let reminderH = startH;
  let reminderM = startM - 15;
  if (reminderM < 0) {
    reminderH -= 1;
    reminderM += 60;
  }

  const targetDate = new Date(now);
  targetDate.setHours(reminderH, reminderM, 0, 0);

  let isToday = true;
  // If target reminder time for today has already passed, schedule for tomorrow
  if (targetDate.getTime() <= now.getTime()) {
    targetDate.setDate(targetDate.getDate() + 1);
    isToday = false;
  }

  const delayMs = targetDate.getTime() - now.getTime();
  const reminderTimeFormatted = `${String(reminderH).padStart(2, '0')}:${String(reminderM).padStart(2, '0')} WIB`;

  return {
    delayMs,
    reminderTimeFormatted,
    isToday,
  };
}

/**
 * Check if the morning reminder has already been sent for today
 */
export function hasReminderBeenSentToday(employeeId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const key = `${REMINDER_SENT_KEY_PREFIX}${employeeId}_${todayDateStr}`;
  return localStorage.getItem(key) === 'true';
}

/**
 * Mark that the morning reminder was sent today
 */
export function markReminderSentToday(employeeId: string): void {
  if (typeof localStorage === 'undefined') return;
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const key = `${REMINDER_SENT_KEY_PREFIX}${employeeId}_${todayDateStr}`;
  localStorage.setItem(key, 'true');
}

/**
 * Dispatch schedule configuration to the Service Worker
 */
export async function scheduleShiftReminderInSW(
  employee: Employee,
  hasClockedInToday: boolean
): Promise<{ success: boolean; message: string }> {
  if (!isNotificationSupported()) {
    return { success: false, message: 'Browser tidak mendukung Service Worker / Notifikasi.' };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, message: 'Izin notifikasi belum diberikan oleh pengguna.' };
  }

  if (hasClockedInToday) {
    // If user already clocked in, cancel pending reminder
    cancelShiftReminderInSW();
    return { success: true, message: 'Presensi sudah tercatat hari ini. Pengingat tidak dijadwalkan.' };
  }

  const { delayMs, reminderTimeFormatted, isToday } = calculateShiftReminderDelay(employee.shift.startTime);

  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) {
      reg.active.postMessage({
        type: 'SCHEDULE_SHIFT_REMINDER',
        shift: employee.shift,
        employee: {
          id: employee.id,
          name: employee.name,
          nip: employee.nip,
        },
        delayMs,
        reminderTimeStr: reminderTimeFormatted,
      });

      return {
        success: true,
        message: `Pengingat shift otomatis aktif pada ${reminderTimeFormatted} (${isToday ? 'Hari ini' : 'Besok pagi'}).`,
      };
    } else {
      return { success: false, message: 'Service Worker belum aktif.' };
    }
  } catch (err) {
    console.error('Gagal menjadwalkan notifikasi ke Service Worker:', err);
    return { success: false, message: 'Gagal berkomunikasi dengan Service Worker.' };
  }
}

/**
 * Cancel any pending reminder in the Service Worker
 */
export async function cancelShiftReminderInSW(): Promise<void> {
  if (!isNotificationSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) {
      reg.active.postMessage({ type: 'CANCEL_SHIFT_REMINDER' });
    }
  } catch (err) {
    console.warn('Gagal membatalkan pengingat di SW:', err);
  }
}

/**
 * Trigger an instant local push notification via Service Worker (for testing or manual prompt)
 */
export async function triggerLocalShiftNotification(
  employee: Employee,
  customTitle?: string,
  customBody?: string
): Promise<{ success: boolean; message: string }> {
  if (!isNotificationSupported()) {
    return { success: false, message: 'Browser tidak mendukung Notification API.' };
  }

  // Request permission if not granted
  if (Notification.permission !== 'granted') {
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') {
      return {
        success: false,
        message: 'Izin notifikasi belum diizinkan. Silakan izinkan notifikasi pada pengaturan browser.',
      };
    }
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg) {
      // Send message to SW or call showNotification directly via registration
      const title = customTitle || `⏰ Pengingat Presensi Masuk: Shift ${employee.shift.startTime} WIB`;
      const body =
        customBody ||
        `Halo ${employee.name}, waktu masuk kerja shift ${employee.shift.name} (${employee.shift.startTime} WIB) telah tiba. Buka aplikasi untuk presensi masuk dengan kamera selfie & GPS!`;

      await (reg as ServiceWorkerRegistration).showNotification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'shift-clockin-reminder',
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: {
          url: '/',
          employeeId: employee.id,
          shiftStartTime: employee.shift.startTime,
          toleranceMinutes: employee.shift.lateToleranceMinutes,
          action: 'CLOCK_IN_REMINDER',
        },
        actions: [
          {
            action: 'action_clock_in',
            title: 'Presensi Masuk Sekarang',
          },
          {
            action: 'action_dismiss',
            title: 'Tutup',
          },
        ],
      } as unknown as NotificationOptions);

      return {
        success: true,
        message: 'Notifikasi push lokal Service Worker berhasil dikirim ke perangkat Anda!',
      };
    }

    return { success: false, message: 'Service Worker tidak tersedia.' };
  } catch (err) {
    console.error('Error saat memicu notifikasi:', err);
    return {
      success: false,
      message: `Gagal mengirim notifikasi: ${(err as Error).message || 'Kesalahan sistem'}`,
    };
  }
}

export interface OutsideRadiusNotificationParams {
  distanceMeters: number;
  maxRadiusMeters: number;
  officeName: string;
  employeeName: string;
  attendanceType?: string;
}

/**
 * Trigger browser notification when the user attempts attendance outside the office radius
 */
export async function triggerOutsideRadiusNotification({
  distanceMeters,
  maxRadiusMeters,
  officeName,
  employeeName,
  attendanceType = 'MASUK',
}: OutsideRadiusNotificationParams): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') {
    return { success: false, message: 'Window tidak tersedia.' };
  }

  // Check and request notification permission if not yet decided
  let currentPermission: NotificationPermissionState = getNotificationPermission();
  if (currentPermission === 'default') {
    currentPermission = await requestNotificationPermission();
  }

  const title = `⚠️ Peringatan: Anda di Luar Radius Kantor!`;
  const typeLabel =
    attendanceType === 'MASUK'
      ? 'Presensi Masuk'
      : attendanceType === 'PULANG'
      ? 'Presensi Pulang'
      : 'Presensi';
  const body = `Halo ${employeeName}, posisi Anda berjarak ${distanceMeters}m dari kantor ${officeName} (maksimal radius ${maxRadiusMeters}m). Anda berada di luar area kantor yang diizinkan untuk ${typeLabel}.`;

  // 1. Send via Service Worker Registration if active
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg && currentPermission === 'granted') {
        await (reg as ServiceWorkerRegistration).showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
          tag: 'outside-office-radius-alert',
          renotify: true,
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
          data: {
            url: '/',
            type: 'OUTSIDE_RADIUS_WARNING',
            distanceMeters,
            maxRadiusMeters,
            officeName,
            employeeName,
            attendanceType,
            timestamp: new Date().toISOString(),
          },
          actions: [
            {
              action: 'action_dinas_luar',
              title: 'Beralih ke Dinas Luar',
            },
            {
              action: 'action_dismiss',
              title: 'Tutup',
            },
          ],
        } as unknown as NotificationOptions);

        return {
          success: true,
          message: 'Notifikasi browser di luar radius berhasil dikirim.',
        };
      }
    } catch (swErr) {
      console.warn('[Outside Radius] Gagal via SW showNotification, mencoba window.Notification:', swErr);
    }
  }

  // 2. Fallback to native window.Notification constructor
  if ('Notification' in window && currentPermission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'outside-office-radius-alert',
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return {
        success: true,
        message: 'Notifikasi browser di luar radius berhasil dikirim.',
      };
    } catch (notifErr) {
      console.warn('[Outside Radius] Gagal memunculkan window.Notification:', notifErr);
    }
  }

  return {
    success: false,
    message:
      currentPermission === 'denied'
        ? 'Izin notifikasi diblokir pada browser Anda.'
        : 'Notifikasi browser tidak didukung atau belum diizinkan.',
  };
}

