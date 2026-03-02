import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Loader2, Save, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCreditNote, useUpdateCreditNote } from "@/hooks/useCreditNotes";
import { useUpdateInvoice } from "@/hooks/useInvoices";
import type { Invoice, InvoiceLineItem, CreditNote, CreditNoteMethod } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface CreditNoteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice;
    creditNote?: CreditNote; // Optional: If provided, we are editing a draft
}

const emptyLineItem = (): InvoiceLineItem => ({
    description: '',
    quantity: 1,
    unit: 'each',
    rate: 0,
});

export function CreditNoteDialog({ open, onOpenChange, invoice, creditNote }: CreditNoteDialogProps) {
    const { currentOrgId } = useAuth();
    const { toast } = useToast();
    const createCreditNote = useCreateCreditNote();
    const updateCreditNote = useUpdateCreditNote();
    const updateInvoice = useUpdateInvoice();

    // Form state
    const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
    const [reason, setReason] = useState("");
    const [issueMethod, setIssueMethod] = useState<CreditNoteMethod>("account_credit");
    const [notes, setNotes] = useState("");
    const [internalNotes, setInternalNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize from invoice or draft when opened
    useEffect(() => {
        if (open && invoice) {
            if (creditNote) {
                // Load from draft
                setLineItems(JSON.parse(JSON.stringify(creditNote.lineItems || [])));
                setReason(creditNote.reason || "");
                setIssueMethod(creditNote.issueMethod || "account_credit");
                setNotes(creditNote.notes || "");
                setInternalNotes(creditNote.internalNotes || "");
            } else {
                // Deep copy line items to avoid mutating the original invoice
                setLineItems(JSON.parse(JSON.stringify(invoice.lineItems || [emptyLineItem()])));
                setReason("");
                setIssueMethod("account_credit");
                setNotes("");
                setInternalNotes("");
            }
        }
    }, [open, invoice, creditNote]);

    // Derived totals
    const subtotal = useMemo(() => {
        return lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.rate || 0)), 0);
    }, [lineItems]);

    const taxRate = invoice?.taxRate || 0;
    const tax = Number((subtotal * (taxRate / 100)).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));

    // Line item handlers
    const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
        const newItems = [...lineItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setLineItems(newItems);
    };

    const addLineItem = () => setLineItems([...lineItems, emptyLineItem()]);
    const removeLineItem = (index: number) => setLineItems(lineItems.filter((_, i) => i !== index));

    const handleSave = async (issueNow: boolean) => {
        if (!currentOrgId) return;
        if (!reason.trim()) {
            toast({ title: "Reason Required", description: "Please provide a reason for the credit note.", variant: "destructive" });
            return;
        }

        // Validate line items
        const validItems = lineItems.filter(item => item.description.trim() && item.quantity > 0 && item.rate > 0);
        if (validItems.length === 0) {
            toast({ title: "Invalid Items", description: "Please add at least one valid line item.", variant: "destructive" });
            return;
        }

        try {
            setIsSubmitting(true);

            // Build credit note data
            const creditNoteData: any = {
                orgId: currentOrgId,
                invoiceId: invoice.id,
                clientId: invoice.clientId || '',
                projectId: invoice.projectId || '',
                creditNoteNumber: creditNote?.creditNoteNumber || "PENDING",
                lineItems: validItems,
                subtotal: subtotal || 0,
                taxRate: taxRate || 0,
                tax: tax || 0,
                total: total || 0,
                amountApplied: issueNow ? (total || 0) : 0,
                balanceRemaining: issueNow ? 0 : (total || 0),
                status: issueNow ? 'issued' : 'draft',
                issueMethod: issueMethod,
                reason: reason || '',
                notes: notes || '',
                internalNotes: internalNotes || '',
            };

            // Only update issuedDate if it's completely new, or preserve draft's issuedDate if we want
            if (!creditNote) {
                creditNoteData.issuedDate = Timestamp.now();
            }

            // Strip any remaining undefined properties 
            Object.keys(creditNoteData).forEach(key => {
                if (creditNoteData[key] === undefined) {
                    delete creditNoteData[key];
                }
            });

            // If issuing immediately, set status and applied date
            if (issueNow) {
                creditNoteData.status = 'applied';
                creditNoteData.appliedDate = Timestamp.now();
                creditNoteData.appliedToInvoiceId = invoice.id;
            }

            // Create or Update credit note FIRST so we don't apply credits to invoice if creation fails
            if (creditNote) {
                await updateCreditNote.mutateAsync({ id: creditNote.id, data: creditNoteData });
            } else {
                await createCreditNote.mutateAsync(creditNoteData);
            }

            // After successful creation, update the invoice totals
            if (issueNow) {
                const safeTotal = invoice.total || 0;
                const safeAmountPaid = invoice.amountPaid || 0;
                const newCreditsApplied = (invoice.totalCreditsApplied || 0) + (total || 0);
                const newBalanceDue = safeTotal - safeAmountPaid - newCreditsApplied;

                // Determine new status
                let newStatus = invoice.status;
                if (newBalanceDue <= 0) {
                    newStatus = safeAmountPaid > 0 ? 'paid' : 'refunded';
                } else if (newCreditsApplied > 0 || safeAmountPaid > 0) {
                    newStatus = 'partially_paid';
                }

                await updateInvoice.mutateAsync({
                    id: invoice.id,
                    data: {
                        balanceDue: Math.max(0, newBalanceDue),
                        totalCreditsApplied: newCreditsApplied,
                        status: newStatus as any,
                    }
                });
            }

            toast({ title: issueNow ? "Credit Note Issued" : "Credit Note Saved" });
            onOpenChange(false);
        } catch (error: any) {
            console.error("CreditNote Save Error:", error);
            const msg = error?.message || error?.toString() || "Unknown error occurred";
            toast({ title: "Error", description: `Failed to save credit note: ${msg}`, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!invoice) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Issue Credit Note for {invoice.invoiceNumber}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                        <div>
                            <Label className="text-muted-foreground text-xs">Original Invoice Total</Label>
                            <div className="font-semibold">${invoice.total.toFixed(2)}</div>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Current Balance Due</Label>
                            <div className="font-semibold">${invoice.balanceDue.toFixed(2)}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Reason for Credit <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="e.g. Refund for damaged goods, Overcharge, etc."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Refund Method <span className="text-red-500">*</span></Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={issueMethod}
                                onChange={(e) => setIssueMethod(e.target.value as CreditNoteMethod)}
                            >
                                <option value="account_credit">Leave on Account Balance</option>
                                <option value="original_payment_method">Refund to Original Payment Method</option>
                                <option value="manual_check">Manual Check / Standard Mail</option>
                                <option value="cash">Cash Refund</option>
                                <option value="other">Other / Alternative</option>
                            </select>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Credit Items</h3>
                            <p className="text-xs text-muted-foreground">Adjust quantities or rates being refunded</p>
                        </div>

                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[45%]">Description</TableHead>
                                        <TableHead className="w-[15%]">Qty</TableHead>
                                        <TableHead className="w-[15%]">Unit</TableHead>
                                        <TableHead className="w-[15%]">Rate</TableHead>
                                        <TableHead className="text-right w-[10%]">Amount</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lineItems.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="p-2">
                                                <Input
                                                    placeholder="Item description"
                                                    value={item.description}
                                                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                                                    className="h-8 shadow-none"
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={item.quantity || ''}
                                                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="h-8 shadow-none"
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    value={item.unit}
                                                    onChange={(e) => updateLineItem(index, 'unit', e.target.value)}
                                                    className="h-8 shadow-none"
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1.5 text-muted-foreground text-sm">$</span>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.rate || ''}
                                                        onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                                        className="h-8 pl-5 shadow-none"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-2 text-right font-medium">
                                                ${((item.quantity || 0) * (item.rate || 0)).toFixed(2)}
                                            </TableCell>
                                            <TableCell className="p-2 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                                    onClick={() => removeLineItem(index)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={addLineItem}
                            className="mt-2"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add Item
                        </Button>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end pt-4">
                        <div className="w-64 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            {taxRate > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                                    <span>${tax.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-lg pt-2 border-t text-primary">
                                <span>Total Credit</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                            {total > invoice.total && (
                                <p className="text-xs text-red-500 font-medium text-right">Credit cannot exceed original invoice total.</p>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label>Notes to Client</Label>
                            <Textarea
                                placeholder="Visible on the credit note..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="resize-none"
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Internal Notes</Label>
                            <Textarea
                                placeholder="Only visible to your org..."
                                value={internalNotes}
                                onChange={(e) => setInternalNotes(e.target.value)}
                                className="resize-none"
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>

                    <Button
                        variant="secondary"
                        onClick={() => handleSave(false)}
                        disabled={isSubmitting || total <= 0 || total > invoice.total || !reason.trim()}
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Draft
                    </Button>
                    <Button
                        onClick={() => handleSave(true)}
                        disabled={isSubmitting || total <= 0 || total > invoice.total || !reason.trim()}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Issue & Apply Credit
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
