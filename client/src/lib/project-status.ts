import { ProjectEvent, ProjectStatus, Timestamp } from "./firestore";

export function getDerivedStatus(timeline: ProjectEvent[] | undefined, defaultStatus: ProjectStatus, hasScheduledDate?: boolean): ProjectStatus {
    if (!timeline || timeline.length === 0) {
        // If param `hasScheduledDate` is true, upgrade 'lead'/'quoted' to 'booked' (Scheduled).
        if ((defaultStatus === 'lead' || defaultStatus === 'quoted') && hasScheduledDate) {
            return 'booked';
        }
        return defaultStatus;
    }

    const now = new Date();
    const sortedEvents = [...timeline].sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date as any).getTime();
        const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date as any).getTime();
        return dateA - dateB;
    });

    // Find the last event that has occurred (date <= now)
    // Initialize with a fallback, potentially the defaultStatus if it makes sense, 
    // or 'lead' if we want to be strict about the timeline.
    // Let's use 'lead' as the base if no events have happened yet, 
    // UNLESS the defaultStatus is something like 'pending' or 'on-hold' which might be manual.

    // Actually, let's just replay the history.
    let currentStatus: ProjectStatus = 'lead';

    // If the default status is something we don't track in timeline (like 'on-hold' manually set), 
    // we might want to respect it if no events override it? 
    // But the goal is to be Time-Aware.
    // Let's iterate.

    let collectionHasStarted = false;

    // Filter for events that have happened
    const validEvents = sortedEvents.filter(e => {
        const d = e.date?.toDate ? e.date.toDate() : new Date(e.date as any);
        return d <= now;
    });

    if (validEvents.length === 0) {
        // If no events have happened, and we have future events?
        // It's possibly 'booked' (Scheduled) if we have a future start date?
        // Or just return the manually set defaultStatus for safety if no history exists.
        // If param `hasScheduledDate` is true, upgrade 'lead'/'quoted' to 'booked' (Scheduled).
        if ((defaultStatus === 'lead' || defaultStatus === 'quoted') && hasScheduledDate) {
            return 'booked';
        }
        return defaultStatus;
    }

    for (const event of validEvents) {
        switch (event.type) {
            case 'lead_created':
                currentStatus = 'lead';
                break;
            case 'quote_provided':
                currentStatus = 'quoted';
                break;
            case 'quote_accepted':
                currentStatus = 'booked'; // Badge label: "Scheduled"
                break;
            case 'scheduled':
                // Explicit "Scheduled" event? usually we map quote_accepted to booked.
                // But if we have this type:
                currentStatus = 'booked';
                break;
            case 'started':
                currentStatus = 'in-progress';
                break;
            case 'paused':
                currentStatus = 'paused';
                break;
            case 'resumed':
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
        }
    }

    // Edge case: If the calculated status is 'lead' or 'quoted', 
    // BUT we know there is a "Scheduled Start" in the future (implied by existence of future 'started' event?)
    // The user wanted: "It should say 'Scheduled' if there is a start date schedule"
    // If param `hasScheduledDate` is true, upgrade 'lead'/'quoted' to 'booked' (Scheduled).
    if ((currentStatus === 'lead' || currentStatus === 'quoted') && hasScheduledDate) {
        return 'booked';
    }

    return currentStatus;
}
