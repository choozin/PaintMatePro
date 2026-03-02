import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CreditCard, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateInvoice } from "@/hooks/useInvoices";
import { type Invoice, type PaymentMethod } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

interface RecordPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
    { value: 'cash', label: 'Cash', icon: '💵' },
    { value: 'check', label: 'Check', icon: '📄' },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
    { value: 'stripe_card', label: 'Credit/Debit Card (Stripe)', icon: '💳' },
    { value: 'stripe_ach', label: 'ACH/Bank (Stripe)', icon: '🏧' },
    { value: 'other', label: 'Other', icon: '📝' },
];

export function RecordPaymentDialog({ open, onOpenChange, invoice }: RecordPaymentDialogProps) {
    const { user } = useAuth();
    const updateInvoice = useUpdateInvoice();
    const { toast } = useToast();

    const [amount, setAmount] = useState(invoice.balanceDue || 0);
    const [method, setMethod] = useState<PaymentMethod>('check');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (amount <= 0) {
            toast({ title: "Error", description: "Payment amount must be greater than zero.", variant: "destructive" });
            return;
        }

        if (amount > invoice.balanceDue) {
            toast({ title: "Warning", description: "Payment exceeds balance due. Proceeding anyway.", variant: "default" });
        }

        setSaving(true);

        try {
            const newPayment = {
                id: `pay_${Date.now()}`,
                amount,
                date: Timestamp.fromDate(new Date(paymentDate)),
                method,
                referenceNumber: referenceNumber || undefined,
                notes: paymentNotes || undefined,
                recordedBy: user?.uid || undefined,
                createdAt: Timestamp.now(),
            };

            const existingPayments = invoice.payments || [];
            const updatedPayments = [...existingPayments, newPayment];
            const newAmountPaid = (invoice.amountPaid || 0) + amount;
            const newBalanceDue = Math.max(0, invoice.total - newAmountPaid);
            const newStatus = newBalanceDue <= 0 ? 'paid' : 'partially_paid';

            const updateData: Partial<Invoice> = {
                payments: updatedPayments as any,
                amountPaid: newAmountPaid,
                balanceDue: newBalanceDue,
                status: newStatus as any,
            };

            if (newStatus === 'paid') {
                updateData.paidAt = Timestamp.now();
            }

            await updateInvoice.mutateAsync({ id: invoice.id, data: updateData });

            toast({
                title: "Payment Recorded",
                description: `$${amount.toFixed(2)} payment recorded for invoice ${invoice.invoiceNumber}. ${newStatus === 'paid' ? 'Invoice is now fully paid!' : `Remaining balance: $${newBalanceDue.toFixed(2)}`}`,
            });

            onOpenChange(false);
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to record payment.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Record Payment
                    </DialogTitle>
                    <DialogDescription>
                        Invoice {invoice.invoiceNumber} — Balance due: <strong>${invoice.balanceDue?.toFixed(2)}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Payment Amount *</Label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(Number(e.target.value))}
                                className="pl-9"
                                step={0.01}
                                min={0.01}
                            />
                        </div>
                        <div className="flex gap-2 mt-1">
                            <Button variant="outline" size="sm" className="text-xs" onClick={() => setAmount(invoice.balanceDue)}>
                                Full Balance (${invoice.balanceDue?.toFixed(2)})
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs" onClick={() => setAmount(Math.round(invoice.balanceDue / 2 * 100) / 100)}>
                                Half
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Payment Method</Label>
                        <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {PAYMENT_METHODS.map(m => (
                                    <SelectItem key={m.value} value={m.value}>
                                        <span className="flex items-center gap-2">{m.icon} {m.label}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Payment Date</Label>
                        <Input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Reference # (optional)</Label>
                        <Input
                            value={referenceNumber}
                            onChange={(e) => setReferenceNumber(e.target.value)}
                            placeholder="Check #, transaction ID, etc."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            placeholder="Payment notes..."
                            rows={2}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving || amount <= 0}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Record ${amount.toFixed(2)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
