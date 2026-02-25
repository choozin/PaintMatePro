import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DocumentsTab({ projectId }: { projectId: string }) {
    // Phase 2 MVP: Just a placeholder list
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-lg">Project Documents</h3>
                </div>

                <div className="space-y-4">
                    {/* Mock Document */}
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/10 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-medium">Preliminary Estimate.pdf</p>
                                <p className="text-xs text-muted-foreground">Uploaded Jan 15, 2025 • 1.2 MB</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/10 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-medium">Color Selection Sheet.pdf</p>
                                <p className="text-xs text-muted-foreground">Uploaded Jan 20, 2025 • 850 KB</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
