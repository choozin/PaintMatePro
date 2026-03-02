import { Project, Client, Room, type Invoice, type InvoiceStatus } from "@/lib/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Calendar, DollarSign, FileText, Home, MapPin, CreditCard, CheckCircle2, AlertTriangle, Loader2, Send, Eye, Ban } from "lucide-react";
import { RoomCard } from "./RoomCard";
import { DocumentsTab } from "./DocumentsTab";
import { QuoteViewer } from "./QuoteViewer";
import { Timestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useState } from "react";

interface PortalDashboardProps {
    project: Project;
    client: Client | null;
    rooms: Room[];
    invoices?: Invoice[];
    onApproveQuote?: () => void;
}

export function PortalDashboard({ project, client, rooms, invoices = [], onApproveQuote }: PortalDashboardProps) {
    const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    // Calculate financials from real invoices
    const financials = {
        total: invoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
        paid: invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0),
        balance: invoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0),
    };

    const handlePayNow = async (invoice: Invoice) => {
        setPayingInvoiceId(invoice.id);
        try {
            const functions = getFunctions();
            const createCheckout = httpsCallable(functions, 'createCheckoutSession');
            const result = await createCheckout({
                invoiceId: invoice.id,
                baseUrl: window.location.origin,
                successUrl: `${window.location.href}?payment=success`,
                cancelUrl: `${window.location.href}?payment=cancelled`,
            });
            const { url } = result.data as { url: string };
            if (url) window.location.href = url;
        } catch (err: any) {
            console.error('Checkout error:', err);
            alert(err.message || 'Payment failed. Please try again.');
        } finally {
            setPayingInvoiceId(null);
        }
    };

    const formatDate = (ts: any) => {
        if (!ts) return 'N/A';
        const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString();
    };

    const statusBadge = (status: InvoiceStatus) => {
        switch (status) {
            case 'paid': return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
            case 'overdue': return <Badge className="bg-red-100 text-red-800 border-red-200"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
            case 'partially_paid': return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><DollarSign className="h-3 w-3 mr-1" />Partial</Badge>;
            case 'sent': return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
            case 'viewed': return <Badge className="bg-purple-100 text-purple-800 border-purple-200"><Eye className="h-3 w-3 mr-1" />Viewed</Badge>;
            case 'void': return <Badge className="bg-gray-100 text-gray-500 border-gray-200"><Ban className="h-3 w-3 mr-1" />Void</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">

            {/* 1. Hero Section */}
            <section className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">
                        {project.name}
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{project.address}</span>
                        <span className="text-border">|</span>
                        <Badge variant="outline" className="capitalize">{project.status}</Badge>
                    </div>
                </div>

                <div className="flex gap-4">
                    {/* Quick Stats Cards could go here */}
                </div>
            </section>

            {/* 2. Main Content Tabs */}
            <Tabs defaultValue="rooms" className="space-y-6">
                <TabsList className="bg-muted/50 p-1 h-12 w-full justify-start md:w-auto overflow-x-auto">
                    <TabsTrigger value="rooms" className="px-6 h-10 gap-2">
                        <Home className="h-4 w-4" /> Rooms & Areas
                    </TabsTrigger>
                    <TabsTrigger value="quote" className="px-6 h-10 gap-2">
                        <FileText className="h-4 w-4" /> Quote
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="px-6 h-10 gap-2" disabled>
                        <Calendar className="h-4 w-4" /> Timeline (Coming Soon)
                    </TabsTrigger>
                    <TabsTrigger value="documents" className="px-6 h-10 gap-2">
                        <FileText className="h-4 w-4" /> Documents
                    </TabsTrigger>
                    <TabsTrigger value="color" className="px-6 h-10 gap-2">
                        <div className="h-3 w-3 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500" />
                        Color Lounge
                    </TabsTrigger>
                    <TabsTrigger value="billing" className="px-6 h-10 gap-2">
                        <DollarSign className="h-4 w-4" /> Billing
                    </TabsTrigger>
                </TabsList>

                {/* ROOMS TAB */}
                <TabsContent value="rooms" className="space-y-8">
                    {/* Interior Section */}
                    {rooms.filter(r => r.type !== 'exterior').length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Home className="h-5 w-5 text-muted-foreground" />
                                <h3 className="font-semibold text-lg text-muted-foreground">Interior Spaces</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {rooms.filter(r => r.type !== 'exterior').map(room => (
                                    <RoomCard key={room.id} room={room} projectId={project.id} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Exterior Section */}
                    {rooms.filter(r => r.type === 'exterior').length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-5 w-5 flex items-center justify-center rounded bg-green-100 text-green-700 font-bold text-[10px]">Ex</div>
                                <h3 className="font-semibold text-lg text-muted-foreground">Exterior Surfaces</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {rooms.filter(r => r.type === 'exterior').map(room => (
                                    <RoomCard key={room.id} room={room} projectId={project.id} />
                                ))}
                            </div>
                        </div>
                    )}

                    {rooms.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            No spaces or areas have been added to this project yet.
                        </div>
                    )}
                </TabsContent>

                {/* QUOTE TAB */}
                <TabsContent value="quote">
                    <QuoteViewer
                        project={project}
                        client={client}
                        onApprove={onApproveQuote}
                    />
                </TabsContent>

                {/* DOCUMENTS TAB */}
                <TabsContent value="documents">
                    <DocumentsTab projectId={project.id} />
                </TabsContent>

                {/* COLOR LOUNGE TAB */}
                <TabsContent value="color">
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 space-y-4">
                            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-20 flex items-center justify-center">
                                <span className="text-4xl">🎨</span>
                            </div>
                            <h2 className="text-2xl font-bold">Color Lounge</h2>
                            <p className="text-muted-foreground max-w-md">
                                Coming Soon: Visualize your space with different colors, see real-time previews, and select your perfect palette.
                            </p>
                            <Button variant="outline">Join Waitlist</Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* BILLING TAB */}
                <TabsContent value="billing" className="space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="pt-6 text-center">
                                <p className="text-sm text-muted-foreground">Total Invoiced</p>
                                <p className="text-2xl font-bold">${financials.total.toFixed(2)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6 text-center">
                                <p className="text-sm text-muted-foreground">Amount Paid</p>
                                <p className="text-2xl font-bold text-green-600">${financials.paid.toFixed(2)}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6 text-center">
                                <p className="text-sm text-muted-foreground">Balance Due</p>
                                <p className="text-2xl font-bold text-red-600">${financials.balance.toFixed(2)}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Invoice List */}
                    {invoices.length > 0 ? (
                        <div className="space-y-3">
                            {invoices.filter(inv => inv.status !== 'draft' && inv.status !== 'void').map(invoice => (
                                <Card key={invoice.id} className={invoice.status === 'overdue' ? 'border-red-200 bg-red-50/30' : ''}>
                                    <CardContent className="pt-6">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-mono font-semibold">{invoice.invoiceNumber}</span>
                                                    {statusBadge(invoice.status)}
                                                </div>
                                                <div className="text-sm text-muted-foreground space-x-3">
                                                    <span>Due: {formatDate(invoice.dueDate)}</span>
                                                    <span>•</span>
                                                    <span>Total: ${invoice.total?.toFixed(2)}</span>
                                                    {invoice.amountPaid > 0 && (
                                                        <><span>•</span><span className="text-green-600">Paid: ${invoice.amountPaid?.toFixed(2)}</span></>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSelectedInvoice(selectedInvoice?.id === invoice.id ? null : invoice)}
                                                >
                                                    {selectedInvoice?.id === invoice.id ? 'Hide Details' : 'View Details'}
                                                </Button>
                                                {!['paid', 'void'].includes(invoice.status) && invoice.balanceDue > 0 && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handlePayNow(invoice)}
                                                        disabled={payingInvoiceId === invoice.id}
                                                        className="gap-2"
                                                    >
                                                        {payingInvoiceId === invoice.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <CreditCard className="h-4 w-4" />
                                                        )}
                                                        Pay ${invoice.balanceDue?.toFixed(2)}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Detail */}
                                        {selectedInvoice?.id === invoice.id && (
                                            <div className="mt-4 pt-4 border-t space-y-4">
                                                {/* Line Items */}
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-2">Line Items</h4>
                                                    <div className="space-y-1">
                                                        {invoice.lineItems?.map((item, idx) => (
                                                            <div key={idx} className="flex justify-between text-sm">
                                                                <span>{item.description}</span>
                                                                <span className="font-medium">${(item.quantity * item.rate).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <Separator className="my-2" />
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Subtotal</span>
                                                        <span>${invoice.subtotal?.toFixed(2)}</span>
                                                    </div>
                                                    {invoice.taxRate > 0 && (
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
                                                            <span>${invoice.tax?.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between font-bold">
                                                        <span>Total</span>
                                                        <span>${invoice.total?.toFixed(2)}</span>
                                                    </div>
                                                    {invoice.balanceDue > 0 && invoice.balanceDue !== invoice.total && (
                                                        <div className="flex justify-between font-bold text-red-600">
                                                            <span>Balance Due</span>
                                                            <span>${invoice.balanceDue?.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Payment History */}
                                                {invoice.payments && invoice.payments.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-semibold mb-2">Payment History</h4>
                                                        {invoice.payments.map((payment, idx) => (
                                                            <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-50">
                                                                <span className="text-muted-foreground">
                                                                    {formatDate(payment.date)} — {payment.method?.replace(/_/g, ' ')}
                                                                </span>
                                                                <span className="text-green-600 font-medium">${payment.amount?.toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {invoice.notes && (
                                                    <p className="text-sm text-muted-foreground italic">{invoice.notes}</p>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center min-h-[300px] text-center p-8 space-y-4">
                                <div className="h-16 w-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                    <DollarSign className="h-8 w-8" />
                                </div>
                                <h2 className="text-xl font-bold">No Invoices Yet</h2>
                                <p className="text-muted-foreground max-w-md">
                                    There are no invoices for this project yet. You'll be notified when an invoice is ready.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

        </div>
    );
}
