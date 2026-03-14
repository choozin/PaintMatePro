import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Loader2, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useAllQuotes } from "@/hooks/useAllQuotes";
import { useCreateInvoice, useUpdateInvoice } from "@/hooks/useInvoices";
import { invoiceOperations, type Invoice, type InvoiceLineItem, type PaymentTerms, type InvoiceType } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { calculateTaxLines, TaxLine } from "@/lib/financeUtils";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";

interface InvoiceBuilderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice?: Invoice | null;
    preselectedProjectId?: string;
    preselectedQuoteId?: string;
}

const PAYMENT_TERMS_OPTIONS: { value: PaymentTerms; label: string; days: number }[] = [
    { value: 'due_on_receipt', label: 'Due on Receipt', days: 0 },
    { value: 'net_15', label: 'Net 15', days: 15 },
    { value: 'net_30', label: 'Net 30', days: 30 },
    { value: 'net_60', label: 'Net 60', days: 60 },
    { value: 'custom', label: 'Custom', days: 0 },
];

const INVOICE_TYPES: { value: InvoiceType; label: string }[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'deposit', label: 'Deposit' },
    { value: 'progress', label: 'Progress Payment' },
    { value: 'final', label: 'Final Payment' },
];

function emptyLineItem(): InvoiceLineItem {
    return { description: '', quantity: 1, unit: 'ea', rate: 0, amount: 0 };
}

export function InvoiceBuilderDialog({ open, onOpenChange, invoice, preselectedProjectId, preselectedQuoteId }: InvoiceBuilderDialogProps) {
    const { currentOrgId, org, user } = useAuth();
    const { data: projects = [] } = useProjects();
    const { data: clients = [] } = useClients();
    const { data: quotes = [] } = useAllQuotes();
    const createInvoice = useCreateInvoice();
    const updateInvoice = useUpdateInvoice();
    const { toast } = useToast();

    const isEditing = !!invoice;

    // Form state
    const [projectId, setProjectId] = useState('');
    const [quoteId, setQuoteId] = useState('');
    const [invoiceType, setInvoiceType] = useState<InvoiceType>('standard');
    const [depositPercent, setDepositPercent] = useState(org?.invoiceSettings?.defaultDepositPercent || 30);
    const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(org?.invoiceSettings?.defaultPaymentTerms || 'net_30');
    const [customDueDays, setCustomDueDays] = useState(30);
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([emptyLineItem()]);
    const [taxLines, setTaxLines] = useState<Array<{ name: string; rate: number }>>([]);
    const [notes, setNotes] = useState('');
    const [internalNotes, setInternalNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Derived
    const selectedProject = projects.find(p => p.id === projectId);
    const clientId = selectedProject?.clientId || '';
    const selectedClient = clients.find(c => c.id === clientId);
    const projectQuotes = quotes.filter(q => q.projectId === projectId && (q.status === 'accepted' || q.signature));

    // Initialize form on open/edit
    useEffect(() => {
        if (!open) return;

        if (invoice) {
            setProjectId(invoice.projectId || '');
            setQuoteId(invoice.quoteId || '');
            setInvoiceType(invoice.invoiceType || 'standard');
            setDepositPercent(invoice.depositPercent || 30);
            setPaymentTerms(invoice.paymentTerms || 'net_30');
            setCustomDueDays(invoice.customDueDays || 30);
            setLineItems(invoice.lineItems?.length ? invoice.lineItems : [emptyLineItem()]);

            if (invoice.taxLines && invoice.taxLines.length > 0) {
                setTaxLines(invoice.taxLines.map(tl => ({ name: tl.name, rate: tl.rate })));
            } else if (invoice.taxRate !== undefined) {
                setTaxLines([{ name: 'Tax', rate: invoice.taxRate }]);
            }

            setNotes(invoice.notes || '');
            setInternalNotes(invoice.internalNotes || '');
        } else {
            setProjectId(preselectedProjectId || '');
            setQuoteId(preselectedQuoteId || '');
            setInvoiceType('standard');
            setDepositPercent(org?.invoiceSettings?.defaultDepositPercent || 30);
            setPaymentTerms(org?.invoiceSettings?.defaultPaymentTerms || 'net_30');
            setCustomDueDays(30);
            setLineItems([emptyLineItem()]);

            if (org?.invoiceSettings?.defaultTaxLines) {
                setTaxLines(org.invoiceSettings.defaultTaxLines);
            } else if (org?.estimatingSettings?.defaultTaxRate !== undefined) {
                setTaxLines([{ name: 'Tax', rate: org.estimatingSettings.defaultTaxRate }]);
            }

            setNotes('');
            setInternalNotes('');
        }
    }, [open, invoice, preselectedProjectId, preselectedQuoteId, org]);

    // Import from quote
    const handleImportFromQuote = (selectedQuoteId: string) => {
        const quote = quotes.find(q => q.id === selectedQuoteId);
        if (!quote) return;

        setQuoteId(selectedQuoteId);
        const items: InvoiceLineItem[] = quote.lineItems
            .filter(li => !li.isHeader)
            .map(li => ({
                description: li.description,
                quantity: li.quantity,
                unit: li.unit,
                rate: li.rate,
                amount: li.quantity * li.rate,
            }));
        setLineItems(items.length > 0 ? items : [emptyLineItem()]);

        if (quote.taxLines && quote.taxLines.length > 0) {
            setTaxLines(quote.taxLines.map(tl => ({ name: tl.name, rate: tl.rate })));
        } else if ((quote as any).taxRate !== undefined) {
            setTaxLines([{ name: 'Tax', rate: (quote as any).taxRate }]);
        }
    };

    // Line item handlers
    const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
        const updated = [...lineItems];
        updated[index] = { ...updated[index], [field]: value };
        updated[index].amount = updated[index].quantity * updated[index].rate;
        setLineItems(updated);
    };

    const addLineItem = () => setLineItems([...lineItems, emptyLineItem()]);
    const removeLineItem = (index: number) => {
        if (lineItems.length <= 1) return;
        setLineItems(lineItems.filter((_, i) => i !== index));
    };

    // Calculations
    const subtotal = useMemo(() => lineItems.reduce((sum, li) => sum + (li.quantity * li.rate), 0), [lineItems]);

    const { taxLines: calculatedTaxes, taxTotal } = useMemo(() =>
        calculateTaxLines(subtotal, taxLines),
        [subtotal, taxLines]);

    const total = useMemo(() => {
        const baseTotal = subtotal + taxTotal;
        if (invoiceType === 'deposit') return baseTotal * (depositPercent / 100);
        return baseTotal;
    }, [subtotal, taxTotal, invoiceType, depositPercent]);

    const currency = org?.currency || 'USD';
    const symbol = getCurrencySymbol(currency);

    // Due date calculation
    const dueDate = useMemo(() => {
        const days = paymentTerms === 'custom'
            ? customDueDays
            : PAYMENT_TERMS_OPTIONS.find(o => o.value === paymentTerms)?.days || 30;
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
    }, [paymentTerms, customDueDays]);

    const handleSave = async () => {
        if (!projectId || !clientId || !currentOrgId) {
            toast({ title: "Error", description: "Please select a project.", variant: "destructive" });
            return;
        }

        setSaving(true);

        try {
            const invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
                orgId: currentOrgId,
                projectId,
                clientId,
                quoteId: quoteId || undefined,
                invoiceNumber: invoice?.invoiceNumber || await invoiceOperations.getNextNumber(currentOrgId),
                lineItems,
                subtotal,
                taxRate: taxLines.length > 0 ? taxLines[0].rate : 0, // Legacy fallback
                tax: taxTotal, // Legacy fallback
                taxTotal,
                taxLines: calculatedTaxes,
                total,
                currency,
                amountPaid: invoice?.amountPaid || 0,
                balanceDue: total - (invoice?.amountPaid || 0),
                status: invoice?.status || 'draft',
                invoiceType,
                depositPercent: invoiceType === 'deposit' ? depositPercent : undefined,
                issuedDate: invoice?.issuedDate || Timestamp.now(),
                dueDate: Timestamp.fromDate(dueDate),
                paymentTerms,
                customDueDays: paymentTerms === 'custom' ? customDueDays : undefined,
                payments: invoice?.payments || [],
                notes: notes || undefined,
                internalNotes: internalNotes || undefined,
                createdBy: invoice?.createdBy || user?.uid,
                createdByName: invoice?.createdByName || user?.displayName || user?.email || undefined,
            };

            if (isEditing && invoice) {
                await updateInvoice.mutateAsync({ id: invoice.id, data: invoiceData });
                toast({ title: "Invoice Updated", description: `Invoice ${invoice.invoiceNumber} has been updated.` });
            } else {
                await createInvoice.mutateAsync(invoiceData as any);
                toast({ title: "Invoice Created", description: `Invoice ${invoiceData.invoiceNumber} has been created.` });
            }

            onOpenChange(false);
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to save invoice.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        {isEditing ? `Edit Invoice ${invoice?.invoiceNumber}` : 'Create New Invoice'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Project & Quote Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Project *</Label>
                            <Select value={projectId} onValueChange={setProjectId} disabled={isEditing}>
                                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedClient && (
                                <p className="text-sm text-muted-foreground">Client: {selectedClient.name}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Import from Quote</Label>
                            <Select value={quoteId} onValueChange={handleImportFromQuote} disabled={!projectId || projectQuotes.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder={projectQuotes.length === 0 ? 'No accepted quotes' : 'Select quote'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {projectQuotes.map(q => (
                                        <SelectItem key={q.id} value={q.id}>
                                            <span className="flex items-center gap-2">
                                                <FileText className="h-3 w-3" />
                                                {formatCurrency(q.total || 0, q.currency || 'USD')} — {q.createdAt ? new Date(q.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Invoice Type & Terms */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Invoice Type</Label>
                            <Select value={invoiceType} onValueChange={(v) => setInvoiceType(v as InvoiceType)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {INVOICE_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {invoiceType === 'deposit' && (
                            <div className="space-y-2">
                                <Label>Deposit %</Label>
                                <Input
                                    type="number"
                                    value={depositPercent}
                                    onChange={(e) => setDepositPercent(Number(e.target.value))}
                                    min={1}
                                    max={100}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Payment Terms</Label>
                            <Select value={paymentTerms} onValueChange={(v) => setPaymentTerms(v as PaymentTerms)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_TERMS_OPTIONS.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {paymentTerms === 'custom' && (
                            <div className="space-y-2">
                                <Label>Days Until Due</Label>
                                <Input
                                    type="number"
                                    value={customDueDays}
                                    onChange={(e) => setCustomDueDays(Number(e.target.value))}
                                    min={1}
                                />
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Line Items */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label className="text-base font-semibold">Line Items</Label>
                            <Button variant="outline" size="sm" onClick={addLineItem} className="gap-1">
                                <Plus className="h-3 w-3" /> Add Line
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {/* Header */}
                            <div className="grid grid-cols-[1fr_80px_60px_100px_80px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                                <span>Description</span>
                                <span>Qty</span>
                                <span>Unit</span>
                                <span>Rate</span>
                                <span className="text-right">Amount</span>
                                <span></span>
                            </div>

                            {lineItems.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_80px_60px_100px_80px_32px] gap-2 items-center">
                                    <Input
                                        value={item.description}
                                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                                        placeholder="Item description"
                                        className="text-sm"
                                    />
                                    <Input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))}
                                        min={0}
                                        className="text-sm"
                                    />
                                    <Input
                                        value={item.unit}
                                        onChange={(e) => updateLineItem(idx, 'unit', e.target.value)}
                                        className="text-sm"
                                    />
                                    <Input
                                        type="number"
                                        value={item.rate}
                                        onChange={(e) => updateLineItem(idx, 'rate', Number(e.target.value))}
                                        min={0}
                                        step={0.01}
                                        className="text-sm"
                                    />
                                    <span className="text-sm text-right font-medium text-muted-foreground">
                                        {formatCurrency(item.quantity * item.rate, currency)}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeLineItem(idx)}
                                        disabled={lineItems.length <= 1}
                                        className="h-8 w-8"
                                    >
                                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Totals */}
                    <div className="flex justify-end">
                        <div className="w-80 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>{formatCurrency(subtotal, currency)}</span>
                            </div>

                            {taxLines.map((tl, idx) => (
                                <div key={idx} className="flex justify-between text-sm items-center gap-2 group">
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => setTaxLines(taxLines.filter((_, i) => i !== idx))} className="text-red-400">
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <input
                                        className="text-muted-foreground bg-transparent border-none p-0 w-24 text-xs focus:ring-0"
                                        value={tl.name}
                                        onChange={e => {
                                            const newLines = [...taxLines];
                                            newLines[idx].name = e.target.value;
                                            setTaxLines(newLines);
                                        }}
                                    />
                                    <div className="flex items-center gap-1 bg-muted px-1 rounded">
                                        <input
                                            type="number"
                                            value={tl.rate}
                                            onChange={(e) => {
                                                const newLines = [...taxLines];
                                                newLines[idx].rate = Number(e.target.value);
                                                setTaxLines(newLines);
                                            }}
                                            className="w-12 h-6 text-xs text-right bg-transparent border-none focus:ring-0"
                                            min={0}
                                            step={0.01}
                                        />
                                        <span className="text-[10px]">%</span>
                                    </div>
                                    <span className="min-w-[60px] text-right">{formatCurrency(calculatedTaxes[idx].amount, currency)}</span>
                                </div>
                            ))}

                            <button
                                onClick={() => setTaxLines([...taxLines, { name: 'Tax', rate: 0 }])}
                                className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 ml-auto"
                            >
                                <Plus className="h-3 w-3" /> Add Tax Line
                            </button>

                            {invoiceType === 'deposit' && (
                                <div className="flex justify-between text-sm text-amber-600">
                                    <span>Deposit ({depositPercent}%)</span>
                                    <span>{formatCurrency(total, currency)}</span>
                                </div>
                            )}
                            <Separator />
                            <div className="flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>{formatCurrency(total, currency)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Due Date</span>
                                <span>{dueDate.toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Client Notes</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Visible to client on the invoice..."
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Internal Notes</Label>
                            <Textarea
                                value={internalNotes}
                                onChange={(e) => setInternalNotes(e.target.value)}
                                placeholder="Only visible to your team..."
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || !projectId}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {isEditing ? 'Update Invoice' : 'Create Invoice'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
