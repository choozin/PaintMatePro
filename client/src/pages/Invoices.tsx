import { useState, useMemo, useRef, useEffect } from "react";
import { useInvoices, useUpdateInvoice } from "@/hooks/useInvoices";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    FileText,
    Plus,
    Search,
    DollarSign,
    AlertTriangle,
    CheckCircle2,
    MoreHorizontal,
    Send,
    Eye,
    Loader2,
    CreditCard,
    Ban,
    Receipt,
    Mail,
    Undo2,
    Activity
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { FeatureLock } from "@/components/FeatureLock";
import { InvoiceBuilderDialog } from "@/components/InvoiceBuilderDialog";
import { RecordPaymentDialog } from "@/components/RecordPaymentDialog";
import { InvoicePDFPreview } from "@/components/InvoicePDFPreview";
import { CreditNoteDialog } from "@/components/CreditNoteDialog";
import { useCreditNotes } from "@/hooks/useCreditNotes";
import type { Invoice, InvoiceStatus, CreditNote } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type TabFilter = 'all' | 'draft' | 'sent' | 'overdue' | 'paid' | 'credits';

function statusBadge(status: InvoiceStatus) {
    switch (status) {
        case 'draft':
            return <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />Draft</Badge>;
        case 'sent':
            return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 gap-1"><Send className="h-3 w-3" />Sent</Badge>;
        case 'viewed':
            return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200 gap-1"><Eye className="h-3 w-3" />Viewed</Badge>;
        case 'partially_paid':
            return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 gap-1"><DollarSign className="h-3 w-3" />Partial</Badge>;
        case 'paid':
            return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" />Paid</Badge>;
        case 'overdue':
            return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 gap-1"><AlertTriangle className="h-3 w-3" />Overdue</Badge>;
        case 'void':
            return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 border-gray-200 gap-1"><Ban className="h-3 w-3" />Void</Badge>;
        case 'refunded':
            return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 border-gray-200 gap-1"><Undo2 className="h-3 w-3" />Refunded</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

export default function Invoices() {
    const { data: invoices = [], isLoading } = useInvoices();
    const { data: projects = [] } = useProjects();
    const { data: clients = [] } = useClients();
    const { currentPermissions } = useAuth();
    const updateInvoice = useUpdateInvoice();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<TabFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [builderOpen, setBuilderOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
    const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
    const [creditNoteOpen, setCreditNoteOpen] = useState(false);
    const [creditNoteInvoice, setCreditNoteInvoice] = useState<Invoice | null>(null);
    const [creditNoteDraft, setCreditNoteDraft] = useState<CreditNote | undefined>(undefined);

    const { data: creditNotes = [] } = useCreditNotes();

    // Auto-detect overdue invoices on load (run once)
    const overdueCheckDone = useRef(false);
    useEffect(() => {
        if (overdueCheckDone.current || invoices.length === 0) return;
        overdueCheckDone.current = true;
        const now = new Date();
        invoices.forEach(inv => {
            if (['sent', 'viewed'].includes(inv.status) && inv.dueDate) {
                const dueDate = inv.dueDate instanceof Timestamp ? inv.dueDate.toDate() : new Date(inv.dueDate as any);
                if (dueDate < now) {
                    updateInvoice.mutate({ id: inv.id, data: { status: 'overdue' } });
                }
            }
        });
    }, [invoices]);

    // Filter invoices
    const filteredInvoices = useMemo(() => {
        let filtered = invoices;

        // Tab filter
        if (activeTab === 'credits') {
            // "Credit Notes" tab logic: for now, it just shows invoices that HAVE credit notes.
            // A separate AR aging report handles detail. 
            filtered = filtered.filter(inv => (inv.totalCreditsApplied || 0) > 0);
        } else if (activeTab !== 'all') {
            if (activeTab === 'sent') {
                filtered = filtered.filter(inv => ['sent', 'viewed', 'partially_paid'].includes(inv.status));
            } else {
                filtered = filtered.filter(inv => inv.status === activeTab);
            }
        }

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(inv => {
                const client = clients.find(c => c.id === inv.clientId);
                const project = projects.find(p => p.id === inv.projectId);
                return (
                    inv.invoiceNumber?.toLowerCase().includes(q) ||
                    client?.name?.toLowerCase().includes(q) ||
                    project?.name?.toLowerCase().includes(q)
                );
            });
        }

        return filtered;
    }, [invoices, activeTab, searchQuery, clients, projects]);

    // Summary stats
    const stats = useMemo(() => {
        const outstanding = invoices
            .filter(inv => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(inv.status))
            .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
        const overdue = invoices
            .filter(inv => inv.status === 'overdue')
            .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        // Sum all individual payments made this month (from payments[] array)
        let collected = 0;
        invoices.forEach(inv => {
            if (inv.payments && Array.isArray(inv.payments)) {
                inv.payments.forEach((pmt: any) => {
                    const pmtDate = pmt.date instanceof Timestamp ? pmt.date.toDate() : new Date(pmt.date as any);
                    if (pmtDate >= startOfMonth) {
                        collected += pmt.amount || 0;
                    }
                });
            } else if (inv.paidAt) {
                // Fallback for invoices with no payments[] array (legacy)
                const paidDate = inv.paidAt instanceof Timestamp ? inv.paidAt.toDate() : new Date(inv.paidAt as any);
                if (paidDate >= startOfMonth) {
                    collected += inv.amountPaid || 0;
                }
            }
        });
        const drafts = invoices.filter(inv => inv.status === 'draft').length;

        const creditsIssued = creditNotes
            .filter(cn => cn.status === 'issued' || cn.status === 'applied')
            .reduce((sum, cn) => sum + (cn.total || 0), 0);

        return { outstanding, overdue, collected, drafts, creditsIssued };
    }, [invoices, creditNotes]);

    const handleSendInvoice = async (invoice: Invoice) => {
        try {
            await updateInvoice.mutateAsync({
                id: invoice.id,
                data: { status: 'sent', sentAt: Timestamp.now() }
            });
            toast({ title: "Invoice Sent", description: `Invoice ${invoice.invoiceNumber} has been marked as sent.` });
        } catch (err) {
            toast({ title: "Error", description: "Failed to send invoice.", variant: "destructive" });
        }
    };

    const handleVoidInvoice = async (invoice: Invoice) => {
        try {
            await updateInvoice.mutateAsync({
                id: invoice.id,
                data: { status: 'void' }
            });
            toast({ title: "Invoice Voided", description: `Invoice ${invoice.invoiceNumber} has been voided.` });
        } catch (err) {
            toast({ title: "Error", description: "Failed to void invoice.", variant: "destructive" });
        }
    };

    const handleEmailInvoice = (invoice: Invoice, isCreditNote = false) => {
        const client = clients.find(c => c.id === invoice.clientId);
        const project = projects.find(p => p.id === invoice.projectId);
        if (!client?.email) {
            toast({ title: "No Email", description: "This client does not have an email address on file.", variant: "destructive" });
            return;
        }

        const dueDate = invoice.dueDate instanceof Timestamp
            ? invoice.dueDate.toDate() : new Date(invoice.dueDate as any);

        const lineItemsText = invoice.lineItems?.map(
            li => `  \u2022 ${li.description}: ${li.quantity} \u00d7 $${li.rate?.toFixed(2)} = $${(li.quantity * li.rate).toFixed(2)}`
        ).join('\n') || '';

        const typeName = isCreditNote ? 'Credit Note' : 'Invoice';
        const docName = isCreditNote ? 'credit note' : 'invoice';

        let body = `Hi ${client.name},\n\n`;
        body += isCreditNote
            ? `Please find your credit note details below for project ${project?.name || ''}:\n\n`
            : `Please find your invoice details below:\n\n`;

        body += `${typeName} #: ${invoice.invoiceNumber}\n` +
            `Project: ${project?.name || ''}\n` +
            `Date: ${new Date().toLocaleDateString()}\n`;

        if (!isCreditNote) {
            body += `Due Date: ${dueDate.toLocaleDateString()}\n\n`;
        } else {
            body += `\n`;
        }

        body += `--- Line Items ---\n${lineItemsText}\n\n` +
            `Subtotal: $${invoice.subtotal?.toFixed(2)}\n` +
            ((invoice.taxRate || 0) > 0 ? `Tax (${invoice.taxRate}%): $${invoice.tax?.toFixed(2)}\n` : '') +
            `Total${isCreditNote ? ' Credited' : ''}: $${invoice.total?.toFixed(2)}\n`;

        if (!isCreditNote) {
            body += (invoice.amountPaid > 0 ? `Paid: $${invoice.amountPaid?.toFixed(2)}\n` : '') +
                `Balance Due: $${invoice.balanceDue?.toFixed(2)}\n\n`;
        } else {
            body += `\n`;
        }

        body += (invoice.notes ? `Notes: ${invoice.notes}\n\n` : '') +
            `Thank you for your business!`;

        const encodedSubject = encodeURIComponent(`${typeName} ${invoice.invoiceNumber} \u2014 ${project?.name || 'Project'}`);
        const encodedBody = encodeURIComponent(body);

        window.location.href = `mailto:${client.email}?subject=${encodedSubject}&body=${encodedBody}`;
        toast({ title: "Email Client", description: `Opening email to ${client.email}...` });
    };

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <FeatureLock feature="payments" teaseMessage="Upgrade to unlock Invoicing & Payments">
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-bold">Invoices & Payments</h1>
                        <p className="text-muted-foreground mt-2">Create, send, and track invoices for your projects.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" asChild className="gap-2">
                            <a href="/reports/ar-aging">
                                <Activity className="h-4 w-4" />
                                Outstanding Balances
                            </a>
                        </Button>
                        {hasPermission(currentPermissions, 'create_invoices') && (
                            <Button onClick={() => { setEditingInvoice(null); setBuilderOpen(true); }} className="gap-2">
                                <Plus className="h-4 w-4" />
                                New Invoice
                            </Button>
                        )}
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                                    <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Outstanding</p>
                                    <p className="text-2xl font-bold">${stats.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 rounded-lg dark:bg-red-900/30">
                                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Overdue</p>
                                    <p className="text-2xl font-bold">${stats.overdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg dark:bg-green-900/30">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Collected This Month</p>
                                    <p className="text-2xl font-bold">${stats.collected.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-lg dark:bg-slate-800">
                                    <FileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Drafts</p>
                                    <p className="text-2xl font-bold">{stats.drafts}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg dark:bg-orange-900/30">
                                    <Undo2 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Credits Issued</p>
                                    <p className="text-2xl font-bold">${stats.creditsIssued.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs + Search */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)}>
                                <TabsList className="flex flex-wrap h-auto justify-start gap-1">
                                    <TabsTrigger value="all">All ({invoices.length})</TabsTrigger>
                                    <TabsTrigger value="draft">Draft</TabsTrigger>
                                    <TabsTrigger value="sent">Sent / Active</TabsTrigger>
                                    <TabsTrigger value="overdue">Overdue</TabsTrigger>
                                    <TabsTrigger value="paid">Paid</TabsTrigger>
                                    <TabsTrigger value="credits">Credit Notes</TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <div className="relative w-full md:w-72">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search invoices..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {activeTab === 'credits' ? (
                            creditNotes.length > 0 ? (
                                <div className="relative w-full">
                                    <div className="overflow-x-auto w-full">
                                        <Table className="min-w-[800px]">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>CN #</TableHead>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Invoice #</TableHead>
                                                    <TableHead>Client</TableHead>
                                                    <TableHead className="text-right">Total</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {creditNotes.map((cn) => {
                                                    const client = clients.find(c => c.id === cn.clientId);
                                                    const inv = invoices.find(i => i.id === cn.invoiceId);
                                                    const date = cn.createdAt instanceof Timestamp ? cn.createdAt.toDate() : new Date(cn.createdAt as any);

                                                    return (
                                                        <TableRow key={cn.id}>
                                                            <TableCell className="font-mono font-medium text-sm">{cn.creditNoteNumber}</TableCell>
                                                            <TableCell>{date.toLocaleDateString()}</TableCell>
                                                            <TableCell className="font-mono text-sm">{inv?.invoiceNumber || cn.invoiceId}</TableCell>
                                                            <TableCell className="max-w-[150px] truncate">{client?.name || '—'}</TableCell>
                                                            <TableCell className="text-right font-medium">${cn.total?.toFixed(2)}</TableCell>
                                                            <TableCell>
                                                                {cn.status === 'draft' ? <Badge variant="outline">Draft</Badge> : <Badge className="bg-orange-100 text-orange-800">Applied</Badge>}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {cn.status === 'draft' && hasPermission(currentPermissions, 'manage_invoices') && (
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            if (inv) {
                                                                                setCreditNoteInvoice(inv);
                                                                                setCreditNoteDraft(cn);
                                                                                setCreditNoteOpen(true);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <FileText className="h-4 w-4 mr-2" />
                                                                        Edit Draft
                                                                    </Button>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
                                </div>
                            ) : (
                                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                                    <Undo2 className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                                    <h3 className="mt-4 text-lg font-semibold">No Credit Notes Found</h3>
                                    <p className="text-muted-foreground mt-1">You haven't issued any credit notes yet.</p>
                                </div>
                            )
                        ) : filteredInvoices.length > 0 ? (
                            <div className="relative w-full">
                                <div className="overflow-x-auto w-full">
                                    <Table className="min-w-[1000px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Invoice #</TableHead>
                                                <TableHead>Client</TableHead>
                                                <TableHead>Project</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredInvoices.map((invoice) => {
                                                const client = clients.find(c => c.id === invoice.clientId);
                                                const project = projects.find(p => p.id === invoice.projectId);
                                                const dueDate = invoice.dueDate instanceof Timestamp
                                                    ? invoice.dueDate.toDate()
                                                    : new Date(invoice.dueDate as any);
                                                const isOverdue = invoice.status === 'overdue';

                                                return (
                                                    <TableRow key={invoice.id} className={isOverdue ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                                                        <TableCell className="font-mono font-medium text-sm">
                                                            {invoice.invoiceNumber}
                                                        </TableCell>
                                                        <TableCell>{client?.name || '—'}</TableCell>
                                                        <TableCell className="max-w-[200px] truncate">{project?.name || '—'}</TableCell>
                                                        <TableCell className="text-right font-medium">
                                                            ${invoice.total?.toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className={`text-right font-medium ${isOverdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                                                            <div>${invoice.balanceDue?.toFixed(2)}</div>
                                                            {(invoice.totalCreditsApplied || 0) > 0 && (
                                                                <div className="text-xs text-orange-600 dark:text-orange-400 font-normal">
                                                                    (${invoice.totalCreditsApplied?.toFixed(2)} credited)
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{statusBadge(invoice.status)}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {dueDate.toLocaleDateString()}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem onClick={() => setPreviewInvoice(invoice)}>
                                                                        <Eye className="h-4 w-4 mr-2" />View / Print
                                                                    </DropdownMenuItem>
                                                                    {invoice.status === 'draft' && hasPermission(currentPermissions, 'create_invoices') && (
                                                                        <DropdownMenuItem onClick={() => { setEditingInvoice(invoice); setBuilderOpen(true); }}>
                                                                            <FileText className="h-4 w-4 mr-2" />Edit
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {invoice.status === 'draft' && hasPermission(currentPermissions, 'manage_invoices') && (
                                                                        <DropdownMenuItem onClick={() => handleSendInvoice(invoice)}>
                                                                            <Send className="h-4 w-4 mr-2" />Mark as Sent
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {invoice.status !== 'draft' && (
                                                                        <DropdownMenuItem onClick={() => handleEmailInvoice(invoice)}>
                                                                            <Mail className="h-4 w-4 mr-2" />Email to Client
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {invoice.status === 'refunded' && (
                                                                        <DropdownMenuItem onClick={() => handleEmailInvoice(invoice, true)}>
                                                                            <Mail className="h-4 w-4 mr-2" />Email Credit Note
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {!['paid', 'void', 'draft'].includes(invoice.status) && hasPermission(currentPermissions, 'record_payments') && (
                                                                        <DropdownMenuItem onClick={() => { setPaymentInvoice(invoice); setPaymentDialogOpen(true); }}>
                                                                            <CreditCard className="h-4 w-4 mr-2" />Record Payment
                                                                        </DropdownMenuItem>
                                                                    )}
                                                                    {invoice.status !== 'void' && invoice.status !== 'paid' && invoice.status !== 'refunded' && hasPermission(currentPermissions, 'manage_invoices') && (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem onClick={() => handleVoidInvoice(invoice)} className="text-red-600">
                                                                                <Ban className="h-4 w-4 mr-2" />Void Invoice
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                    {invoice.amountPaid > 0 && invoice.status !== 'refunded' && invoice.status !== 'void' && hasPermission(currentPermissions, 'manage_invoices') && (
                                                                        <>
                                                                            <DropdownMenuSeparator />
                                                                            <DropdownMenuItem onClick={() => { setCreditNoteInvoice(invoice); setCreditNoteOpen(true); }} className="text-orange-600">
                                                                                <Undo2 className="h-4 w-4 mr-2" />Issue Credit Note
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
                            </div>
                        ) : (
                            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                                <Receipt className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                                <h3 className="mt-4 text-lg font-semibold">No Invoices Found</h3>
                                <p className="text-muted-foreground mt-1">
                                    {activeTab === 'all'
                                        ? 'Create your first invoice to start collecting payments.'
                                        : `No ${activeTab} invoices found.`
                                    }
                                </p>
                                {activeTab === 'all' && hasPermission(currentPermissions, 'create_invoices') && (
                                    <Button onClick={() => { setEditingInvoice(null); setBuilderOpen(true); }} className="mt-4 gap-2">
                                        <Plus className="h-4 w-4" /> New Invoice
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Invoice Builder Dialog */}
                <InvoiceBuilderDialog
                    open={builderOpen}
                    onOpenChange={setBuilderOpen}
                    invoice={editingInvoice}
                />

                {/* Record Payment Dialog */}
                {paymentInvoice && (
                    <RecordPaymentDialog
                        open={paymentDialogOpen}
                        onOpenChange={setPaymentDialogOpen}
                        invoice={paymentInvoice}
                    />
                )}

                {/* PDF Preview Dialog */}
                {previewInvoice && (
                    <InvoicePDFPreview
                        open={!!previewInvoice}
                        onOpenChange={(open: boolean) => { if (!open) setPreviewInvoice(null); }}
                        invoice={previewInvoice}
                    />
                )}

                {/* Credit Note Dialog */}
                {creditNoteInvoice && (
                    <CreditNoteDialog
                        open={creditNoteOpen}
                        onOpenChange={(v) => {
                            setCreditNoteOpen(v);
                            if (!v) {
                                setTimeout(() => setCreditNoteDraft(undefined), 200);
                            }
                        }}
                        invoice={creditNoteInvoice}
                        creditNote={creditNoteDraft}
                    />
                )}
            </div>
        </FeatureLock>
    );
}
