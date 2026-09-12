import { AttendanceRecord, QueuedAttendanceItem } from '../types';

const QUEUE_STORAGE_KEY = 'absensi_offline_sync_queue';

/**
 * Get all queued attendance records awaiting upload
 */
export function getOfflineQueue(): QueuedAttendanceItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to read offline queue from localStorage:', err);
    return [];
  }
}

/**
 * Add an attendance record to the offline queue
 */
export function enqueueOfflineAttendance(record: AttendanceRecord): QueuedAttendanceItem {
  const currentQueue = getOfflineQueue();
  
  const queuedRecord: AttendanceRecord = {
    ...record,
    syncStatus: 'OFFLINE_PENDING',
    offlineQueuedAt: new Date().toISOString(),
  };

  const queueItem: QueuedAttendanceItem = {
    queueId: `QUEUE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    record: queuedRecord,
    queuedAt: new Date().toISOString(),
    retryAttempts: 0,
  };

  const updatedQueue = [queueItem, ...currentQueue];
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updatedQueue));
  } catch (err) {
    console.error('Failed to save offline queue:', err);
  }

  return queueItem;
}

/**
 * Remove a specific item from the offline queue by queueId
 */
export function removeQueueItem(queueId: string): void {
  const currentQueue = getOfflineQueue();
  const filtered = currentQueue.filter((item) => item.queueId !== queueId);
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Failed to update offline queue in localStorage:', err);
  }
}

/**
 * Clear the entire offline queue
 */
export function clearAllQueued(): void {
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear offline queue:', err);
  }
}

/**
 * Process and synchronize all pending offline attendance records.
 * Invokes onItemSynced for each successfully uploaded record so the main app state updates.
 */
export async function processOfflineQueue(
  onItemSynced: (syncedRecord: AttendanceRecord) => void
): Promise<{ syncedCount: number; errors: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, errors: 0 };
  }

  let syncedCount = 0;
  let errors = 0;

  for (const item of queue) {
    try {
      // Simulate real-time server upload latency per record
      await new Promise((resolve) => setTimeout(resolve, 350));

      const syncedRecord: AttendanceRecord = {
        ...item.record,
        syncStatus: 'ONLINE_SYNCED',
        syncedAt: new Date().toISOString(),
      };

      // Notify consumer
      onItemSynced(syncedRecord);

      // Remove from queue
      removeQueueItem(item.queueId);
      syncedCount++;
    } catch (err) {
      console.error('Failed to sync queue item:', item.queueId, err);
      errors++;
    }
  }

  return { syncedCount, errors };
}
