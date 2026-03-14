import { useState, useEffect } from "react";
import { Project, Client, Quote, orgOperations } from "@/lib/firestore";
import { useQuotes } from "@/hooks/useQuotes";
import { useOrg } from "@/hooks/useOrg";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle2, FileText, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateTaxLines } from "@/lib/financeUtils";
import { formatCurrency } from "@/lib/currency";

// Helper to load image for PDF
const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
};

interface QuoteViewerProps {
    project: Project;
    client: Client | null;
    onApprove?: () => void;
}

export function QuoteViewer({ project, client, onApprove }: QuoteViewerProps) {
    const { data: quotes = [], isLoading } = useQuotes(project.id);
    const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
    const { data: org } = useOrg(project.orgId);
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (quotes.length > 0) {
            // Find accepted quote or latest one
            const accepted = quotes.find(q => q.status === 'accepted');
            if (accepted) {
                setActiveQuote(accepted);
            } else {
                // Defines "latest" by created date if possible, but firestore sort is robust
                setActiveQuote(quotes[0]);
            }
        }
    }, [quotes]);

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!activeQuote) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4 opacity-20" />
                    <p>No quotes have been generated for this project yet.</p>
                </CardContent>
            </Card>
        );
    }

    const { lineItems = [], subtotal = 0, taxTotal = 0, total = 0, taxLines = [], currency = 'USD' } = activeQuote;
    const legacyTax = (activeQuote as any).tax || 0;

    // Ensure we have calculated taxes if they weren't stored (migration fallback)
    const displayTaxes = taxLines.length > 0
        ? taxLines
        : (legacyTax > 0 ? [{ name: 'Tax', amount: legacyTax, rate: (activeQuote as any).taxRate || 0 }] : []);

    const displayTaxTotal = taxTotal || legacyTax;

    const generatePDF = async () => {
        if (!project || !org) return;

        setIsGenerating(true);
        try {
            const branding = org?.branding || {};
            const quoteSettings = org?.quoteSettings || {};
            const layout = quoteSettings.templateLayout || 'standard';

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            // const pageHeight = doc.internal.pageSize.getHeight();

            const primaryColor = branding.primaryColor || '#000000';
            const secondaryColor = branding.secondaryColor || '#666666';

            const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : { r: 59, g: 130, b: 246 }; // Default to blue-500 if invalid
            };

            const primaryRgb = hexToRgb(primaryColor);
            const secondaryRgb = hexToRgb(secondaryColor);

            const addLogo = async (x: number, y: number, maxHeight: number, align: 'left' | 'right' | 'center' = 'left') => {
                const logoSource = branding.logoBase64 || branding.logoUrl;
                if (!logoSource) return 0;
                try {
                    const img = await loadImage(logoSource);
                    const ratio = img.width / img.height;
                    const height = Math.min(img.height, maxHeight);
                    const width = height * ratio;

                    const finalWidth = Math.min(width, 60);
                    const finalHeight = finalWidth / ratio;

                    let finalX = x;
                    if (align === 'right') finalX = x - finalWidth;
                    if (align === 'center') finalX = x - (finalWidth / 2);

                    doc.addImage(img, 'PNG', finalX, y, finalWidth, finalHeight);
                    return finalHeight;
                } catch (e) {
                    console.warn('Failed to load logo formatting', e);
                    return 0;
                }
            };

            // --- MODERN HEADER ---
            doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
            doc.rect(0, 0, pageWidth, 5, 'F'); // Top accent bar

            let currentY = 25;

            // Fetch Logo (Left Aligned)
            const logoHeight = await addLogo(20, 15, 25, 'left');

            doc.setTextColor(0, 0, 0);

            // Right Aligned Company Info
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text(branding.companyName || 'Painting Quote', pageWidth - 20, currentY, { align: 'right' });

            currentY += 6;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);

            if (branding.companyPhone) {
                doc.text(branding.companyPhone, pageWidth - 20, currentY, { align: 'right' });
                currentY += 5;
            }
            if (branding.companyEmail) {
                doc.text(branding.companyEmail, pageWidth - 20, currentY, { align: 'right' });
                currentY += 5;
            }
            if (branding.website) {
                doc.text(branding.website, pageWidth - 20, currentY, { align: 'right' });
                currentY += 5;
            }
            if (branding.companyAddress) {
                doc.text(branding.companyAddress.replace('\n', ', '), pageWidth - 20, currentY, { align: 'right' });
                currentY += 5;
            }
            if (org?.businessNumber) {
                doc.text(`Business No: ${org.businessNumber}`, pageWidth - 20, currentY, { align: 'right' });
                currentY += 5;
            }

            // Determine the starting point for the content based on the tallest header element
            let headerBottomY = Math.max(currentY, (logoHeight > 0 ? 15 + logoHeight : 25)) + 12;

            // Divider Line
            doc.setDrawColor(220, 220, 220); // Soft gray
            doc.setLineWidth(0.5);
            doc.line(20, headerBottomY, pageWidth - 20, headerBottomY);

            headerBottomY += 15;

            // --- CLIENT & PROJECT INFO SECTION ---
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
            doc.text('Prepared For:', 20, headerBottomY);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(12);
            doc.text(client?.name || 'Valued Client', 20, headerBottomY + 6);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            if (client?.email) doc.text(client.email, 20, headerBottomY + 11);
            if (client?.phone) doc.text(client.phone, 20, headerBottomY + 16);
            if (client?.address) doc.text(client.address, 20, headerBottomY + 21);

            // Project Details (Right Side)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
            doc.text('Quote Details:', pageWidth - 20, headerBottomY, { align: 'right' });

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`Project Name: ${project.name}`, pageWidth - 20, headerBottomY + 6, { align: 'right' });
            doc.text(`Date Prepared: ${new Date().toLocaleDateString()}`, pageWidth - 20, headerBottomY + 11, { align: 'right' });
            doc.text(`Quote ID: ${activeQuote?.id?.slice(0, 8) || 'DRAFT'}`, pageWidth - 20, headerBottomY + 16, { align: 'right' });

            let yPos = headerBottomY + 35; // Start of table generator

            autoTable(doc, {
                startY: yPos,
                head: [['Description', 'Quantity', 'Rate', 'Total']],
                body: lineItems.map(item => {
                    if (item.isHeader) {
                        return [item.description, '', '', '', item.amount ? `$${Number(item.amount).toFixed(2)}` : ''];
                    }
                    return [
                        item.description,
                        item.quantity.toFixed(2),
                        item.unit,
                        formatCurrency(item.rate, currency),
                        formatCurrency(item.quantity * item.rate, currency)
                    ];
                }),
                theme: 'plain',
                headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
                styles: { fontSize: 10, cellPadding: 3 },
                columnStyles: {
                    0: { cellWidth: 80 },
                    4: { cellWidth: 30, halign: 'right' }
                }
            });

            // Totals
            const finalY = (doc as any).lastAutoTable.finalY + 10;
            doc.text(`Subtotal: ${formatCurrency(subtotal, currency)}`, pageWidth - 20, finalY, { align: 'right' });

            let currentTaxY = finalY + 7;
            displayTaxes.forEach(tl => {
                doc.text(`${tl.name} (${tl.rate}%): ${formatCurrency(tl.amount, currency)}`, pageWidth - 20, currentTaxY, { align: 'right' });
                currentTaxY += 7;
            });

            doc.setFont('helvetica', 'bold');
            doc.text(`Total: ${formatCurrency(total, currency)}`, pageWidth - 20, currentTaxY + 7, { align: 'right' });

            // Sanitize filename to prevent browser fallback to hash string
            const safeProjectName = project.name.replace(/[^a-zA-Z0-9-]/g, '_');
            const fileName = `${safeProjectName}_Quote.pdf`;

            doc.save(fileName);

            toast({ title: "Downloaded", description: "Quote PDF has been downloaded." });
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Failed to generate PDF." });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold">Project Quote</h2>
                    <p className="text-muted-foreground text-sm">
                        Generated on {activeQuote.createdAt?.toDate().toLocaleDateString()}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={generatePDF} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                        Download PDF
                    </Button>

                    {activeQuote.status === 'accepted' || project.status === 'booked' ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 px-4 py-2 text-sm flex gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Quote Approved
                        </Badge>
                    ) : (
                        onApprove && (
                            <Button onClick={onApprove} className="bg-green-600 hover:bg-green-700 text-white">
                                Approve Quote
                            </Button>
                        )
                    )}
                </div>
            </div>

            <Card>
                <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Quote Details</CardTitle>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-primary">{formatCurrency(total, currency)}</div>
                            <div className="text-xs text-muted-foreground">Total Estimate</div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative w-full max-w-full overflow-x-auto">
                        <table className="w-full min-w-[600px] caption-bottom text-sm text-left">
                            <thead className="[&_tr]:border-b">
                                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[40%]">Description</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Quantity</th>
                                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Unit</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Rate</th>
                                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="[&_tr:last-child]:border-0">
                                {lineItems.map((item, i) => (
                                    <tr key={i} className={`border-b transition-colors hover:bg-muted/50 ${item.isHeader ? "bg-muted/50 font-semibold" : ""}`}>
                                        <td className="p-4 align-middle">
                                            {item.description}
                                        </td>
                                        {item.isHeader ? (
                                            <>
                                                <td colSpan={3}></td>
                                                <td className="p-4 align-middle text-right">
                                                    {item.amount ? `$${Number(item.amount).toFixed(2)}` : ''}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-4 align-middle text-right">{item.quantity}</td>
                                                <td className="p-4 align-middle">{item.unit}</td>
                                                <td className="p-4 align-middle text-right">{formatCurrency(item.rate, currency)}</td>
                                                <td className="p-4 align-middle text-right">{formatCurrency(item.quantity * item.rate, currency)}</td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 bg-muted/10 border-t flex flex-col items-end gap-2">
                        <div className="flex justify-between w-full max-w-xs text-sm">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>{formatCurrency(subtotal, currency)}</span>
                        </div>
                        {displayTaxes.map((tl, idx) => (
                            <div key={idx} className="flex justify-between w-full max-w-xs text-sm">
                                <span className="text-muted-foreground">{tl.name} ({tl.rate}%):</span>
                                <span>{formatCurrency(tl.amount, currency)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between w-full max-w-xs font-bold text-lg pt-2 border-t mt-2">
                            <span>Total:</span>
                            <span>{formatCurrency(total, currency)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
