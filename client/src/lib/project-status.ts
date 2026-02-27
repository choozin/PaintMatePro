import { ProjectEvent, ProjectStatus, Timestamp } from "./firestore";

export function getDerivedStatus(
    timeline: ProjectEvent[] | undefined,
    defaultStatus: ProjectStatus,
    startDate?: string | Timestamp | Date | null,
    endDate?: string | Timestamp | Date | null
): ProjectStatus {
    // Terminal statuses should not be overridden by timeline/date calculations
    if (['completed', 'invoiced', 'paid'].includes(defaultStatus)) {
        return defaultStatus;
    }

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
        // If we have explicit dates, we should try to derive status from them
        // This handles legacy projects or projects where dates were set without generating timeline events
        if (start && end) {
            const currentDate = new Date();
            if (currentDate > end) {
                return 'overdue' as ProjectStatus;
            } else if (currentDate >= start) {
                // specific logic: if now is past start, it's either in-progress or overdue
                return 'in-progress' as ProjectStatus;
            } else {
                // Future start date
                return 'booked' as ProjectStatus;
            }
        }

        // If no dates and no timeline, fallback to default
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

    // Allow derived status from dates to override early lifecycle statuses if dates are explicitly set
    // This fixed the issue where projects with dates but without specific timeline events were stuck as "New"
    if (['new', 'lead', 'quote_created', 'quote_sent', 'pending'].includes(currentStatus)) {
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

            if (start && end) {
                // Set end date to end of day to avoid premature overdue status on the due date itself
                const endOfDay = new Date(end);
                endOfDay.setHours(23, 59, 59, 999);

                if (now > endOfDay) {
                    currentStatus = 'overdue';
                } else if (now >= start) {
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
