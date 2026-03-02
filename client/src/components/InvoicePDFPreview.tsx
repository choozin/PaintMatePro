import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, Download, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import type { Invoice } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";

interface InvoicePDFPreviewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice;
}

function formatDate(ts: Timestamp | string | undefined): string {
    if (!ts) return 'N/A';
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts as any);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function statusColor(status: string): string {
    switch (status) {
        case 'paid': return 'text-green-600';
        case 'overdue': return 'text-red-600';
        case 'void': return 'text-gray-400';
        default: return 'text-blue-600';
    }
}

export function InvoicePDFPreview({ open, onOpenChange, invoice }: InvoicePDFPreviewProps) {
    const { org } = useAuth();
    const { data: clients = [] } = useClients();
    const { data: projects = [] } = useProjects();

    const client = clients.find(c => c.id === invoice.clientId);
    const project = projects.find(p => p.id === invoice.projectId);

    const branding = org?.branding;
    const primaryColor = branding?.primaryColor || '#1e40af';

    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto print:max-w-none print:shadow-none">
                <DialogHeader className="print:hidden">
                    <DialogTitle>Invoice Preview</DialogTitle>
                </DialogHeader>

                {/* Printable Invoice */}
                <div className="bg-white dark:bg-slate-950 p-8 rounded-lg border print:border-none print:p-0" id="invoice-preview">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            {branding?.logoBase64 ? (
                                <img src={branding.logoBase64} alt="Logo" className="h-12 mb-2" />
                            ) : (
                                <h2 className="text-2xl font-bold" style={{ color: primaryColor }}>
                                    {branding?.companyName || org?.name || 'Your Company'}
                                </h2>
                            )}
                            {branding?.companyAddress && (
                                <p className="text-sm text-muted-foreground mt-1">{branding.companyAddress}</p>
                            )}
                            {branding?.companyPhone && (
                                <p className="text-sm text-muted-foreground">{branding.companyPhone}</p>
                            )}
                            {branding?.companyEmail && (
                                <p className="text-sm text-muted-foreground">{branding.companyEmail}</p>
                            )}
                        </div>
                        <div className="text-right">
                            <h1 className="text-3xl font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                                Invoice
                            </h1>
                            <p className="text-lg font-mono mt-1">{invoice.invoiceNumber}</p>
                            <p className={`text-sm font-semibold uppercase mt-1 ${statusColor(invoice.status)}`}>
                                {invoice.status}
                            </p>
                        </div>
                    </div>

                    {/* Bill To & Details */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bill To</p>
                            <p className="font-semibold">{client?.name || '—'}</p>
                            {client?.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
                            {client?.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
                            {client?.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
                        </div>
                        <div className="text-right">
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Issue Date:</span>
                                    <span>{formatDate(invoice.issuedDate)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Due Date:</span>
                                    <span className={invoice.status === 'overdue' ? 'text-red-600 font-semibold' : ''}>
                                        {formatDate(invoice.dueDate)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Project:</span>
                                    <span>{project?.name || '—'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Terms:</span>
                                    <span className="capitalize">{invoice.paymentTerms?.replace(/_/g, ' ')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Line Items Table */}
                    <div className="mb-8">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b-2" style={{ borderColor: primaryColor }}>
                                    <th className="text-left py-2 text-sm font-semibold">Description</th>
                                    <th className="text-right py-2 text-sm font-semibold w-20">Qty</th>
                                    <th className="text-right py-2 text-sm font-semibold w-20">Rate</th>
                                    <th className="text-right py-2 text-sm font-semibold w-24">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.lineItems?.map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                                        <td className="py-2 text-sm">{item.description}</td>
                                        <td className="py-2 text-sm text-right">{item.quantity} {item.unit}</td>
                                        <td className="py-2 text-sm text-right">${item.rate?.toFixed(2)}</td>
                                        <td className="py-2 text-sm text-right font-medium">
                                            ${(item.quantity * item.rate).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end mb-8">
                        <div className="w-64">
                            <div className="flex justify-between py-1 text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>${invoice.subtotal?.toFixed(2)}</span>
                            </div>
                            {invoice.taxRate > 0 && (
                                <div className="flex justify-between py-1 text-sm">
                                    <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
                                    <span>${invoice.tax?.toFixed(2)}</span>
                                </div>
                            )}
                            <Separator className="my-1" />
                            <div className="flex justify-between py-1 font-bold text-lg">
                                <span>Total</span>
                                <span>${invoice.total?.toFixed(2)}</span>
                            </div>
                            {invoice.amountPaid > 0 && (
                                <div className="flex justify-between py-1 text-sm text-green-600">
                                    <span>Paid</span>
                                    <span>-${invoice.amountPaid?.toFixed(2)}</span>
                                </div>
                            )}
                            {invoice.balanceDue > 0 && (
                                <>
                                    <Separator className="my-1" />
                                    <div className="flex justify-between py-1 font-bold text-lg" style={{ color: primaryColor }}>
                                        <span>Balance Due</span>
                                        <span>${invoice.balanceDue?.toFixed(2)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Payment History */}
                    {invoice.payments && invoice.payments.length > 0 && (
                        <div className="mb-8">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment History</p>
                            <div className="space-y-1">
                                {invoice.payments.map((payment, idx) => {
                                    const payDate = payment.date instanceof Timestamp
                                        ? payment.date.toDate()
                                        : new Date(payment.date as any);
                                    return (
                                        <div key={idx} className="flex justify-between text-sm border-b border-gray-50 dark:border-gray-900 py-1">
                                            <span className="text-muted-foreground">
                                                {payDate.toLocaleDateString()} — {payment.method?.replace(/_/g, ' ')}
                                                {payment.referenceNumber ? ` (#${payment.referenceNumber})` : ''}
                                            </span>
                                            <span className="font-medium text-green-600">${payment.amount?.toFixed(2)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {invoice.notes && (
                        <div className="mb-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-center text-xs text-muted-foreground mt-8 pt-4 border-t">
                        Thank you for your business!
                        {branding?.website && <span> • {branding.website}</span>}
                    </div>
                </div>

                <DialogFooter className="print:hidden">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    <Button variant="outline" onClick={handlePrint} className="gap-2">
                        <Printer className="h-4 w-4" />Print
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
