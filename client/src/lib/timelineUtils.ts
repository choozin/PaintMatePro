import { Project, Client, Quote, Timestamp } from "./firestore";
import { format } from "date-fns";

export interface TimelineEvent {
    id: string;
    label: string;
    date: Date | null;
    status: 'completed' | 'pending' | 'future' | 'current';
    order: number; // Added order field
    action?: {
        label: string;
        onClick?: () => void;
        disabled?: boolean;
    };
    description?: string;
    icon?: any; // Lucide icon
}

// Helper to safely get Date object
const getDate = (d: any): Date | null => {
    if (!d) return null;
    if (typeof d.toDate === 'function') return d.toDate();
    if (d instanceof Date) return d;
    if (typeof d === 'string') return new Date(d);
    return null;
};

export const getProjectTimelineEvents = (
    project: Project,
    client?: Client | null,
    quotes: Quote[] = []
): TimelineEvent[] => {
    const events: TimelineEvent[] = [];
    const now = new Date();

    // 1. Lead Created (Client Created)
    // Use client.createdAt if available, otherwise project.createdAt (fallback)
    // NOTE: User specified "Lead Created" should allow for older leads.
    const leadDate = client?.createdAt ? getDate(client.createdAt) : getDate(project.createdAt);
    events.push({
        id: 'lead_created',
        label: 'Lead Created',
        date: leadDate,
        status: 'completed', // Always completed if project exists
        order: 1,
        description: client ? `Client: ${client.name}` : undefined
    });

    // 2. Project Created
    const projectCreatedDate = getDate(project.createdAt);
    events.push({
        id: 'project_created',
        label: 'Project Created',
        date: projectCreatedDate,
        status: 'completed',
        order: 2
    });

    // 3. Quote Provided
    // Check if any quote exists
    const quoteProvided = quotes.length > 0;
    // If multiple quotes, take the earliest creation date? Or latest? Usually earliest "Provided".
    // Let's sort quotes by createdAt ascending
    const sortedQuotes = [...quotes].sort((a, b) => {
        const dA = getDate(a.createdAt)?.getTime() || 0;
        const dB = getDate(b.createdAt)?.getTime() || 0;
        return dA - dB;
    });

    const firstQuoteDate = quoteProvided ? getDate(sortedQuotes[0].createdAt) : null;

    events.push({
        id: 'quote_provided',
        label: 'Quote Provided',
        date: firstQuoteDate,
        status: quoteProvided ? 'completed' : 'pending',
        order: 3,
        action: !quoteProvided ? { label: 'Create Quote' } : undefined
    });

    // 4. Quote Accepted
    // Check if any quote is accepted OR project status implies acceptance (booked, in-progress, etc)
    const acceptedQuote = quotes.find(q => q.status === 'accepted');
    const isAcceptedStatus = ['booked', 'in-progress', 'paused', 'completed', 'invoiced', 'paid'].includes(project.status);

    // Logic: either we have a specific acceptance date from a quote, or we infer it happened if the project is booked.
    // If we don't have a quote object but project is booked, we might lack a specific date. Fallback to project.updatedAt or createdAt?
    // Ideally rely on the quote.
    let quoteAcceptedDate = acceptedQuote ? getDate(acceptedQuote.updatedAt) : null;

    // If no quote object found but status is advanced, mark as completed but date might be approximate or unknown
    // For now, if no quote is explicitly accepted, we leave it pending unless status forces it?
    // User asked for "Quote Accepted" line. 

    const isQuoteAccepted = !!acceptedQuote || isAcceptedStatus;

    // Only show "Quote Accepted" if quotes exist
    if (quotes.length > 0) {
        events.push({
            id: 'quote_accepted',
            label: 'Quote Accepted',
            date: isQuoteAccepted ? quoteAcceptedDate : null, // Ensure date is null if pending
            status: isQuoteAccepted ? 'completed' : 'pending',
            order: 4,
            // If pending and quote provided, maybe action to "Mark Accepted"?
            action: (!isQuoteAccepted && quoteProvided) ? { label: 'Mark Accepted' } : undefined
        });
    }


    // 5. Project Started
    // project.startDate
    const startDate = getDate(project.startDate);
    // Status: Completed if startDate <= now AND we are in an active status (not new/lead/quoted)
    // Actually, "Project Started" event usually means "Work Began". 
    // If project.status is 'in-progress' or 'completed', it's started.
    const isStarted = ['in-progress', 'paused', 'completed', 'invoiced', 'paid'].includes(project.status);
    // OR if startDate is in the past? User might set a future start date.
    // We'll trust the status primarily. 

    events.push({
        id: 'project_started',
        label: 'Project Started',
        date: startDate,
        status: isStarted ? 'completed' : (startDate && startDate < now ? 'pending' : 'future')
    });

    // 6. Project Due
    const dueDate = getDate(project.estimatedCompletion);
    // Status: Completed if project is completed?
    // "Project Due" is a milestone. It's usually "Future" until passed.
    // If project is completed, this milestone is "passed" or "met".
    const isCompleted = ['completed', 'invoiced', 'paid'].includes(project.status);

    events.push({
        id: 'project_due',
        label: 'Project Due',
        date: dueDate,
        status: dueDate && dueDate < now && !isCompleted ? 'pending' : (isCompleted ? 'completed' : 'future'), // If due date passed and not completed, it's pending. If completed, it's completed. Otherwise future.
        order: 6,
        action: !dueDate ? { label: 'Set Due Date' } : undefined,
        type: 'finished'
    });

    // 7. Project Completed
    const completedDate = getDate(project.completedAt);
    events.push({
        id: 'project_completed',
        label: 'Project Completed',
        date: completedDate,
        status: isCompleted ? 'completed' : 'pending',
        order: 7,
        // Action handled by main toggle usually, but could put here
        action: !isCompleted ? { label: 'Complete Project' } : undefined,
        type: 'completed'
    });

    // 8. Invoice Provided
    // STUBBED
    const isInvoiced = ['invoiced', 'paid'].includes(project.status);
    events.push({
        id: 'invoice_provided',
        label: 'Invoice Provided',
        date: null, // Stubbed
        status: isInvoiced ? 'completed' : (isCompleted ? 'pending' : 'future'),
        order: 8,
        action: (isCompleted && !isInvoiced) ? { label: 'Create Invoice' } : undefined,
        type: 'invoice_issued'
    });

    // 9. Invoice Paid
    // STUBBED
    const isPaid = project.status === 'paid';
    events.push({
        id: 'invoice_paid',
        label: 'Invoice Paid',
        date: null,
        status: isPaid ? 'completed' : (isInvoiced ? 'pending' : 'future'),
        order: 9,
        action: (isInvoiced && !isPaid) ? { label: 'Mark Paid' } : undefined,
        type: 'payment_received'
    });

    return events;
};
