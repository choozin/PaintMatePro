import { useAllQuotes } from "@/hooks/useAllQuotes";
import { useProjects } from "@/hooks/useProjects";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, Loader2, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function AllQuotes() {
    const { data: quotes, isLoading } = useAllQuotes();
    const { data: projects = [] } = useProjects();
    const { t } = useTranslation();
    const [, setLocation] = useLocation();

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold">{t('nav.quotes')}</h1>
                <p className="text-muted-foreground mt-2">Manage all quotes across your organization.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Quotes</CardTitle>
                    <CardDescription>View and manage all project quotes.</CardDescription>
                </CardHeader>
                <CardContent>
                    {quotes && quotes.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotes.map((quote) => (
                                    <TableRow key={quote.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-sans text-sm">
                                                    {projects.find(p => p.id === quote.projectId)?.name || 'Unknown Project'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>${quote.total.toFixed(2)}</TableCell>
                                        <TableCell>
                                            {quote.signature ? (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Signed</Badge>
                                            ) : (
                                                <Badge variant="outline">Draft</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {quote.createdAt ? new Date(quote.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setLocation(`/projects/${quote.projectId}/quotes`)}
                                            >
                                                View
                                                <ArrowRight className="h-4 w-4 ml-2" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                            <h3 className="mt-4 text-lg font-semibold">No Quotes Found</h3>
                            <p className="text-muted-foreground">Create a quote from a project page.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
