import { Timestamp } from 'firebase/firestore';

export function formatDate(timestamp: Timestamp | string | number | Date | undefined | null, format: 'short' | 'long' = 'short'): string {
  if (!timestamp) return 'N/A';

  let date: Date;
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else {
    // Fallback if it's an object but not a Timestamp (e.g. serialized date)
    date = new Date((timestamp as any).seconds * 1000);
  }

  if (format === 'short') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function createTimestamp(date?: Date): Timestamp {
  return Timestamp.fromDate(date || new Date());
}
