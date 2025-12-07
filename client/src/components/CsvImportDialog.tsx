import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateClient } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Download } from "lucide-react";
import Papa from "papaparse";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface ImportedClient {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    leadStatus?: string;
    tags?: string; // CSV string "tag1, tag2"
}

export function CsvImportDialog({ trigger }: { trigger?: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<ImportedClient[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [importStats, setImportStats] = useState<{ success: number; failed: number } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const createClient = useCreateClient();
    const { t } = useTranslation();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const parseFile = (file: File) => {
        setIsParsing(true);
        setPreviewData([]);
        setImportStats(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setIsParsing(false);
                const data = results.data as any[];
                // Map keys loosely (lowercase, trim)
                const mappedData: ImportedClient[] = data.map(row => {
                    // Helper to find key case-insensitively
                    const findVal = (key: string) => {
                        const rowKey = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase());
                        return rowKey ? row[rowKey]?.trim() : "";
                    };

                    return {
                        name: findVal("name"),
                        email: findVal("email"),
                        phone: findVal("phone"),
                        address: findVal("address"),
                        leadStatus: findVal("status") || findVal("leadstatus"),
                        tags: findVal("tags"),
                    };
                }).filter(item => item.name); // Filter out rows without name

                setPreviewData(mappedData);
                if (mappedData.length === 0) {
                    toast({
                        variant: "destructive",
                        title: "Invalid CSV",
                        description: "Could not find any valid rows. Please ensure the CSV has a 'Name' column.",
                    });
                }
            },
            error: (error) => {
                setIsParsing(false);
                toast({
                    variant: "destructive",
                    title: "Error parsing CSV",
                    description: error.message,
                });
            }
        });
    };

    const handleImport = async () => {
        if (previewData.length === 0) return;

        setIsImporting(true);
        setProgress(0);
        let successCount = 0;
        let failedCount = 0;

        // Use a loop to process sequentially to update progress
        for (let i = 0; i < previewData.length; i++) {
            const item = previewData[i];
            try {
                const clientData: any = {
                    name: item.name,
                    email: item.email || "",
                    phone: item.phone || "",
                    address: item.address || "",
                    leadStatus: ['new', 'interested', 'cold', 'archived'].includes(item.leadStatus?.toLowerCase() || '')
                        ? item.leadStatus?.toLowerCase()
                        : 'new',
                };

                if (item.tags) {
                    clientData.tags = item.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t);
                }

                await createClient.mutateAsync(clientData);
                successCount++;
            } catch (error) {
                console.error("Failed to import row", i, error);
                failedCount++;
            }

            setProgress(Math.round(((i + 1) / previewData.length) * 100));
        }

        setIsImporting(false);
        setImportStats({ success: successCount, failed: failedCount });
        toast({
            title: "Import Complete",
            description: `Successfully imported ${successCount} leads. ${failedCount > 0 ? `${failedCount} failed.` : ''}`,
        });

        if (failedCount === 0) {
            setTimeout(() => setOpen(false), 1500);
        }
    };

    const downloadTemplate = () => {
        const csvContent = "Name,Email,Phone,Address,Status,Tags\nJohn Doe,john@example.com,555-0100,123 Main St,Interested,\"Referral, Summer Project\"";
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "lead_import_template.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetDialog = () => {
        setFile(null);
        setPreviewData([]);
        setImportStats(null);
        setProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) setTimeout(resetDialog, 300);
        }}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline">
                        <Upload className="mr-2 h-4 w-4" /> Import CSV
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Import Leads from CSV</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to bulk add leads.
                        <Button variant="link" className="h-auto p-0 ml-1 text-primary" onClick={downloadTemplate}>
                            Click here to download a template.
                        </Button>
                    </DialogDescription>
                </DialogHeader>

                {!importStats ? (
                    <div className="space-y-4">
                        <div className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                            onClick={() => fileInputRef.current?.click()}>
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            {isParsing ? (
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            ) : file ? (
                                <>
                                    <FileText className="h-8 w-8 text-primary mb-2" />
                                    <p className="font-medium">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                    <p className="font-medium">Click to upload CSV</p>
                                    <p className="text-xs text-muted-foreground">or drag and drop here</p>
                                </>
                            )}
                        </div>

                        {previewData.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium">Preview ({previewData.length} leads found)</p>
                                <div className="border rounded-md max-h-[200px] overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.slice(0, 5).map((row, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium">{row.name}</TableCell>
                                                    <TableCell>{row.email}</TableCell>
                                                    <TableCell>{row.leadStatus || '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                            {previewData.length > 5 && (
                                                <TableRow>
                                                    <TableCell colSpan={3} className="text-center text-muted-foreground text-xs p-2">
                                                        ...and {previewData.length - 5} more
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {isImporting && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span>Importing...</span>
                                    <span>{progress}%</span>
                                </div>
                                <Progress value={progress} />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-6 text-center space-y-4">
                        <div className="flex justify-center">
                            {importStats.failed === 0 ? (
                                <CheckCircle className="h-12 w-12 text-green-500" />
                            ) : (
                                <AlertCircle className="h-12 w-12 text-amber-500" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-medium">Import Finished</h3>
                            <p className="text-muted-foreground">
                                Success: {importStats.success} | Failed: {importStats.failed}
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {!importStats ? (
                        <>
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={isImporting}>
                                Cancel
                            </Button>
                            <Button onClick={handleImport} disabled={!file || previewData.length === 0 || isImporting}>
                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Import {previewData.length > 0 ? `${previewData.length} Leads` : ''}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setOpen(false)}>Close</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
