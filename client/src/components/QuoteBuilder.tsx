import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText } from "lucide-react";
import { useState } from "react";

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
}

export function QuoteBuilder() {
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", description: "Interior wall paint", quantity: "800", unit: "sq ft", rate: "3.50" },
    { id: "2", description: "Primer application", quantity: "800", unit: "sq ft", rate: "1.25" },
  ]);

  const addLineItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      description: "",
      quantity: "",
      unit: "sq ft",
      rate: "",
    };
    setLineItems([...lineItems, newItem]);
    console.log('Add line item triggered');
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter((item) => item.id !== id));
    console.log('Remove line item triggered', id);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string) => {
    setLineItems(
      lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      return sum + quantity * rate;
    }, 0);
  };

  const subtotal = calculateTotal();
  const tax = subtotal * 0.0875;
  const total = subtotal + tax;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-2xl font-semibold">Quote Builder</h2>
        </div>
        <Button onClick={addLineItem} data-testid="button-add-line-item">
          <Plus className="h-4 w-4 mr-2" />
          Add Line Item
        </Button>
      </div>

      <div className="space-y-4">
        {lineItems.map((item) => (
          <Card key={item.id} data-testid={`card-line-item-${item.id}`}>
            <CardContent className="pt-6">
              <div className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-5">
                    <Label htmlFor={`desc-${item.id}`}>Description</Label>
                    <Input
                      id={`desc-${item.id}`}
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                      placeholder="Paint, primer, labor..."
                      data-testid={`input-description-${item.id}`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor={`qty-${item.id}`}>Quantity</Label>
                    <Input
                      id={`qty-${item.id}`}
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, "quantity", e.target.value)}
                      className="font-mono"
                      data-testid={`input-quantity-${item.id}`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor={`unit-${item.id}`}>Unit</Label>
                    <Select
                      value={item.unit}
                      onValueChange={(value) => updateLineItem(item.id, "unit", value)}
                    >
                      <SelectTrigger data-testid={`select-unit-${item.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sq ft">sq ft</SelectItem>
                        <SelectItem value="gallon">gallon</SelectItem>
                        <SelectItem value="hour">hour</SelectItem>
                        <SelectItem value="unit">unit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor={`rate-${item.id}`}>Rate ($)</Label>
                    <Input
                      id={`rate-${item.id}`}
                      type="number"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateLineItem(item.id, "rate", e.target.value)}
                      className="font-mono"
                      data-testid={`input-rate-${item.id}`}
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(item.id)}
                      disabled={lineItems.length === 1}
                      data-testid={`button-remove-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">Amount: </span>
                  <span className="font-mono text-lg font-semibold">
                    ${((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono font-semibold" data-testid="text-subtotal">
                ${subtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-base">
              <span className="text-muted-foreground">Tax (8.75%)</span>
              <span className="font-mono font-semibold" data-testid="text-tax">
                ${tax.toFixed(2)}
              </span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-xl font-semibold">Total</span>
                <span className="font-mono text-3xl font-bold" data-testid="text-total">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button variant="outline" className="flex-1" data-testid="button-save-draft">
            Save Draft
          </Button>
          <Button className="flex-1" data-testid="button-generate-pdf">
            Generate PDF
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
