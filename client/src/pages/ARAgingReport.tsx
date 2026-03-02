import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, AlertTriangle, FileText, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import type { Invoice, Client, Project } from "@/lib/firestore";
import { Timestamp } from "firebase/firestore";

interface ClientAgingBucket {
    clientId: string;
    clientName: string;
    current: number;    // Not due yet, or due today
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
    totalBalance: number;
    invoices: Invoice[]; // Unpaid invoices
}

export default function ARAgingReport() {
    const { data: invoices = [] } = useInvoices();
    const { data: clients = [] } = useClients();
    const { data: projects = [] } = useProjects();

    const [searchQuery, setSearchQuery] = useState('');
    const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

    const toggleExpanded = (clientId: string) => {
        setExpandedClients(prev => ({
            ...prev,
            [clientId]: !prev[clientId]
        }));
    };

    const agingData = useMemo(() => {
        const buckets: Record<string, ClientAgingBucket> = {};
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Process only unpaid, non-draft invoices
        const activeInvoices = invoices.filter(inv =>
            !['draft', 'paid', 'void', 'refunded'].includes(inv.status) && inv.balanceDue > 0
        );

        activeInvoices.forEach(inv => {
            const client = clients.find(c => c.id === inv.clientId);
            if (!client) return; // Orphan invoice shouldn't happen, but just in case

            if (!buckets[client.id]) {
                buckets[client.id] = {
                    clientId: client.id,
                    clientName: client.name,
                    current: 0,
                    days1_30: 0,
                    days31_60: 0,
                    days61_90: 0,
                    days90Plus: 0,
                    totalBalance: 0,
                    invoices: []
                };
            }

            const bucket = buckets[client.id];
            bucket.invoices.push(inv);
            bucket.totalBalance += inv.balanceDue;

            const dueDate = inv.dueDate instanceof Timestamp ? inv.dueDate.toDate() : new Date(inv.dueDate as any);
            dueDate.setHours(0, 0, 0, 0);

            const isOverdue = dueDate < now;

            if (!isOverdue) {
                bucket.current += inv.balanceDue;
            } else {
                const diffTime = Math.abs(now.getTime() - dueDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 30) {
                    bucket.days1_30 += inv.balanceDue;
                } else if (diffDays <= 60) {
                    bucket.days31_60 += inv.balanceDue;
                } else if (diffDays <= 90) {
                    bucket.days61_90 += inv.balanceDue;
                } else {
                    bucket.days90Plus += inv.balanceDue;
                }
            }
        });

        // Filter by search, convert to array, sort by total balance descending
        const q = searchQuery.toLowerCase();
        return Object.values(buckets)
            .filter(b => b.clientName.toLowerCase().includes(q))
            .sort((a, b) => b.totalBalance - a.totalBalance);

    }, [invoices, clients, searchQuery]);

    // Grand totals
    const totals = useMemo(() => {
        return agingData.reduce((acc, curr) => ({
            current: acc.current + curr.current,
            days1_30: acc.days1_30 + curr.days1_30,
            days31_60: acc.days31_60 + curr.days31_60,
            days61_90: acc.days61_90 + curr.days61_90,
            days90Plus: acc.days90Plus + curr.days90Plus,
            total: acc.total + curr.totalBalance,
        }), { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90Plus: 0, total: 0 });
    }, [agingData]);

    const handleExportCSV = () => {
        const rows = [
            ['Client Name', 'Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total Balance']
        ];

        agingData.forEach(bucket => {
            rows.push([
                bucket.clientName,
                bucket.current.toFixed(2),
                bucket.days1_30.toFixed(2),
                bucket.days31_60.toFixed(2),
                bucket.days61_90.toFixed(2),
                bucket.days90Plus.toFixed(2),
                bucket.totalBalance.toFixed(2)
            ]);
        });

        // Add totals row
        rows.push([
            'TOTALS',
            totals.current.toFixed(2),
            totals.days1_30.toFixed(2),
            totals.days31_60.toFixed(2),
            totals.days61_90.toFixed(2),
            totals.days90Plus.toFixed(2),
            totals.total.toFixed(2)
        ]);

        const csvContent = rows.map(r => r.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `ar_aging_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-bold">Outstanding Balances</h1>
                    <p className="text-muted-foreground mt-2">Track unpaid invoices and past-due balances by client.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleExportCSV} className="gap-2">
                        <Download className="h-4 w-4" /> Export CSV
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Card className="col-span-2 md:col-span-2 border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Outstanding</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold">${totals.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-amber-600 uppercase tracking-wider">1-30 Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-amber-700">${totals.days1_30.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-orange-600 uppercase tracking-wider">31-90 Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-orange-700">${(totals.days31_60 + totals.days61_90).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-medium text-red-600 uppercase tracking-wider">90+ Days</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold text-red-700">${totals.days90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Detail Table */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Aging Details by Client</CardTitle>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search clients..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="w-[30px]"></TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead className="text-right">Current</TableHead>
                                <TableHead className="text-right">1-30 Days</TableHead>
                                <TableHead className="text-right">31-60 Days</TableHead>
                                <TableHead className="text-right">61-90 Days</TableHead>
                                <TableHead className="text-right text-red-600">90+ Days</TableHead>
                                <TableHead className="text-right font-bold w-[120px]">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {agingData.length > 0 ? (
                                agingData.map((bucket) => (
                                    <React.Fragment key={bucket.clientId}>
                                        <TableRow
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => toggleExpanded(bucket.clientId)}
                                        >
                                            <TableCell className="p-2 text-center">
                                                {expandedClients[bucket.clientId] ?
                                                    <ChevronDown className="h-4 w-4 mx-auto text-muted-foreground" /> :
                                                    <ChevronRight className="h-4 w-4 mx-auto text-muted-foreground" />
                                                }
                                            </TableCell>
                                            <TableCell className="font-medium text-base">{bucket.clientName}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">${bucket.current.toFixed(2)}</TableCell>
                                            <TableCell className={`text-right ${bucket.days1_30 > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>${bucket.days1_30.toFixed(2)}</TableCell>
                                            <TableCell className={`text-right ${bucket.days31_60 > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}`}>${bucket.days31_60.toFixed(2)}</TableCell>
                                            <TableCell className={`text-right ${bucket.days61_90 > 0 ? 'text-orange-600 font-bold' : 'text-muted-foreground'}`}>${bucket.days61_90.toFixed(2)}</TableCell>
                                            <TableCell className={`text-right ${bucket.days90Plus > 0 ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>${bucket.days90Plus.toFixed(2)}</TableCell>
                                            <TableCell className="text-right font-bold text-base">${bucket.totalBalance.toFixed(2)}</TableCell>
                                        </TableRow>

                                        {/* Expandable Rows (Invoices for this client) */}
                                        {expandedClients[bucket.clientId] && bucket.invoices.map(inv => {
                                            const project = projects.find(p => p.id === inv.projectId);
                                            const dueDate = inv.dueDate instanceof Timestamp ? inv.dueDate.toDate() : new Date(inv.dueDate as any);

                                            return (
                                                <TableRow key={inv.id} className="bg-muted/20 border-b-0 hover:bg-muted/30">
                                                    <TableCell></TableCell>
                                                    <TableCell className="pl-6 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="h-3 w-3 text-muted-foreground" />
                                                            <a href="/invoices" className="text-sm font-medium hover:underline text-primary">
                                                                {inv.invoiceNumber}
                                                            </a>
                                                            <span className="text-xs text-muted-foreground ml-2">({project?.name || 'No Project'})</span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground pl-5">
                                                            Due: {dueDate.toLocaleDateString()}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell colSpan={5}></TableCell>
                                                    <TableCell className="text-right text-sm py-2">
                                                        ${inv.balanceDue.toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </React.Fragment>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                                        Looks like there are no unpaid invoices right now!
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
