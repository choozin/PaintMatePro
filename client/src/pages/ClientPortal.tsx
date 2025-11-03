import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, MapPin, Calendar } from "lucide-react";

export default function ClientPortal() {
  const quote = {
    projectName: "Residential Exterior Paint",
    clientName: "John Smith",
    location: "123 Main St, Oakland, CA",
    date: "January 15, 2025",
    validUntil: "February 15, 2025",
    lineItems: [
      { description: "Exterior wall paint", quantity: 1200, unit: "sq ft", rate: 3.50, amount: 4200 },
      { description: "Primer application", quantity: 1200, unit: "sq ft", rate: 1.25, amount: 1500 },
      { description: "Trim and detail work", quantity: 8, unit: "hour", rate: 75, amount: 600 },
      { description: "Paint materials", quantity: 15, unit: "gallon", rate: 45, amount: 675 },
    ],
    subtotal: 6975,
    tax: 610.31,
    total: 7585.31,
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center py-8">
          <h1 className="text-4xl font-bold mb-2">Demo Painting Co</h1>
          <p className="text-muted-foreground">Professional Painting Services</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl mb-2">{quote.projectName}</CardTitle>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{quote.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Quote Date: {quote.date}</span>
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="font-mono">
                FREE PLAN
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-4">Quote Details</h3>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">Description</th>
                        <th className="text-right p-3 text-sm font-medium">Qty</th>
                        <th className="text-right p-3 text-sm font-medium">Rate</th>
                        <th className="text-right p-3 text-sm font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.lineItems.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-3 text-sm">{item.description}</td>
                          <td className="p-3 text-sm text-right font-mono">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="p-3 text-sm text-right font-mono">
                            ${item.rate.toFixed(2)}
                          </td>
                          <td className="p-3 text-sm text-right font-mono">
                            ${item.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="space-y-2 max-w-sm ml-auto">
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono font-semibold">${quote.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base">
                    <span className="text-muted-foreground">Tax (8.75%)</span>
                    <span className="font-mono font-semibold">${quote.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="font-mono">${quote.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-md">
                <p className="text-sm text-muted-foreground">
                  This quote is valid until <strong>{quote.validUntil}</strong>. 
                  Please contact us if you have any questions.
                </p>
              </div>

              <div className="flex gap-3">
                <Button className="flex-1" data-testid="button-accept-quote">
                  Accept Quote
                </Button>
                <Button variant="outline" data-testid="button-download-pdf">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground py-6">
          <p>Powered by PaintPro • Professional Painting Business Management</p>
        </div>
      </div>
    </div>
  );
}
