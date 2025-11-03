import { Timestamp } from 'firebase/firestore';

export function formatDate(timestamp: Timestamp | undefined | null, format: 'short' | 'long' = 'short'): string {
  if (!timestamp) return 'N/A';
  
  const date = timestamp.toDate();
  
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
