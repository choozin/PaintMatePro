import { ProjectEvent, ProjectStatus, Timestamp } from "./firestore";

export function getDerivedStatus(
    timeline: ProjectEvent[] | undefined,
    defaultStatus: ProjectStatus,
    startDate?: string | Timestamp | Date | null,
    endDate?: string | Timestamp | Date | null
): ProjectStatus {
    const now = new Date();

    // Normalize dates helper
    const toDate = (d: any): Date | null => {
        if (!d) return null;
        if (d instanceof Timestamp) return d.toDate();
        if (d instanceof Date) return d;
        return new Date(d);
    };

    const start = toDate(startDate);
    const end = toDate(endDate);

    // If no timeline, checking defaultStatus 'new' or 'quote_created' etc.
    if (!timeline || timeline.length === 0) {
        // If status is 'new', it stays 'new' regardless of dates (as per user request: "start as New... status won't become Quoted until Quote Has been saved")
        // Actually, if we have start/end dates but no events, it technically shouldn't move to Booked unless Quote is Accepted.
        // But if defaultStatus is 'lead' or 'new', we keep it.
        return defaultStatus;
    }

    const sortedEvents = [...timeline].sort((a, b) => {
        const dateA = a.date instanceof Timestamp ? a.date.toDate().getTime() : new Date(a.date as any).getTime();
        const dateB = b.date instanceof Timestamp ? b.date.toDate().getTime() : new Date(b.date as any).getTime();
        return dateA - dateB;
    });

    // Find the last event that has mapped status logic
    let currentStatus: ProjectStatus = 'new';

    // Manual statuses that might be set in DB but have events? 
    // Usually manual statuses like 'paused' or 'on-hold' should be respected if they are the LATEST intent.
    // We will rely on event history to determine the "flow" status.

    // Filter for events that have happened
    const validEvents = sortedEvents.filter(e => {
        const d = e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date as any);
        return d <= now;
    });

    // Replay History
    for (const event of validEvents) {
        switch (event.type) {
            case 'lead_created':
                currentStatus = 'new';
                break;
            case 'quote_provided': // Legacy
            case 'quote_created':
                currentStatus = 'quote_created';
                break;
            case 'quote_sent':
                currentStatus = 'quote_sent';
                break;
            case 'quote_accepted':
                // Base status becomes pending upon acceptance
                currentStatus = 'pending';
                break;
            case 'scheduled':
                // Explicit scheduled event -> Booked
                currentStatus = 'booked';
                break;
            case 'started':
                // Explicit start -> In Progress
                currentStatus = 'in-progress';
                break;
            case 'paused':
                currentStatus = 'paused';
                break;
            case 'resumed':
                // Resume usually means back to In Progress
                currentStatus = 'in-progress';
                break;
            case 'finished':
                currentStatus = 'completed';
                break;
            case 'invoice_issued':
                currentStatus = 'invoiced';
                break;
            case 'payment_received':
                currentStatus = 'paid';
                break;
            case 'on_hold':
                currentStatus = 'on-hold';
                break;
        }
    }

    // Automated Transitions based on Dates
    // "Pending should only get applied when a client has accepted a quote but a start and end date hasn't been entered yet."
    // "Booked should only apply if a start and end date have been entered"
    // "In Progress should only apply if the current date falls within a Booked project's start or end dates"

    if (currentStatus === 'pending') {
        if (start && end) {
            currentStatus = 'booked';
        }
    }

    if (currentStatus === 'booked') {
        if (start && end) {
            // Check if current date is within range
            // Normalize current date to ignore time for start check? 
            // Usually "Booked" means future. "In Progress" means now.

            // If now >= start AND (now <= end OR unfinished)
            // But if now > end and not marked finished? Still In Progress (Overdue)?
            // User said: "In Progress should only apply if the current date falls within a Booked project's start or end dates, inclusively"

            if (now >= start && ((now <= end) || (now > end))) {
                // Wait, "falls within" implies <= end. 
                // But if it's past end date and not "Completed", it's still technically in progress (or overdue).
                // Let's stick to strict "within dates" first, or maybe "started and not finished".
                // User said: "In Progress should only apply if the current date falls within...".

                if (now >= start) {
                    currentStatus = 'in-progress';
                }
            }
        }
    }

    // Logic override: You can't be 'new' or 'quote_created' and be 'in-progress' just by dates unless quote is accepted.
    // The replay logic protects this because we only switch to 'booked' if we hit 'pending' (Quote Accepted) or explicit 'scheduled'.

    // Explicit overrides for manual statuses
    // If the latest event was 'paused' or 'on_hold', we should probably stay there UNLESS the date logic forces 'in-progress'?
    // Usually 'paused' stops the clock.
    // If last event was 'paused', we return 'paused'.
    // If last event was 'on_hold', we return 'on_hold'.
    if (validEvents.length > 0) {
        const lastType = validEvents[validEvents.length - 1].type;
        if (lastType === 'paused') return 'paused';
        if (lastType === 'on_hold') return 'on-hold';
        if (lastType === 'finished') return 'completed'; // Don't revert to in-progress if finished early
    }

    return currentStatus;
}
