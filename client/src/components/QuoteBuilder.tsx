import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, Wand2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuotes, useCreateQuote, useUpdateQuote } from "@/hooks/useQuotes";
import { useRooms } from "@/hooks/useRooms";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import type { Quote } from "@/lib/firestore";

interface QuoteBuilderProps {
  projectId: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
}

export function QuoteBuilder({ projectId }: QuoteBuilderProps) {
  const { data: quotes = [], isLoading } = useQuotes(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const { toast } = useToast();

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [taxRate, setTaxRate] = useState("8.75");
  const [validDays, setValidDays] = useState("30");

  // Load the first quote or create empty state
  useEffect(() => {
    if (quotes.length > 0 && !selectedQuoteId) {
      const firstQuote = quotes[0];
      setSelectedQuoteId(firstQuote.id);
      setLineItems(firstQuote.lineItems);
    }
  }, [quotes, selectedQuoteId]);

  const addLineItem = () => {
    const newItem: LineItem = {
      description: "",
      quantity: 0,
      unit: "sq ft",
      rate: 0,
    };
    setLineItems([...lineItems, newItem]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems(
      lineItems.map((item, i) => {
        if (i === index) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const generateFromRooms = () => {
    if (rooms.length === 0) {
      toast({
        variant: "destructive",
        title: "No Rooms Found",
        description: "Please add room measurements first",
      });
      return;
    }

    const totalWallArea = rooms.reduce((sum, room) => {
      const wallArea = 2 * (room.length + room.width) * room.height;
      return sum + wallArea;
    }, 0);

    // Calculate paint needed (400 sq ft per gallon coverage)
    const primerGallons = Math.ceil(totalWallArea / 400);
    const paintGallons = Math.ceil((totalWallArea * 2) / 400); // 2 coats

    // Estimate labor hours (150 sq ft per hour for walls)
    const laborHours = Math.ceil(totalWallArea / 150);

    const generatedItems: LineItem[] = [
      {
        description: "Primer application",
        quantity: totalWallArea,
        unit: "sq ft",
        rate: 0.75,
      },
      {
        description: `Primer material (${primerGallons} gallons)`,
        quantity: primerGallons,
        unit: "gallon",
        rate: 35,
      },
      {
        description: "Interior wall paint (2 coats)",
        quantity: totalWallArea,
        unit: "sq ft",
        rate: 1.25,
      },
      {
        description: `Paint material (${paintGallons} gallons)`,
        quantity: paintGallons,
        unit: "gallon",
        rate: 45,
      },
      {
        description: "Labor",
        quantity: laborHours,
        unit: "hour",
        rate: 65,
      },
      {
        description: "Setup and cleanup",
        quantity: 1,
        unit: "unit",
        rate: 150,
      },
    ];

    setLineItems(generatedItems);
    
    toast({
      title: "Quote Generated",
      description: `Generated ${generatedItems.length} line items from ${rooms.length} rooms`,
    });
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => {
      return sum + item.quantity * item.rate;
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const tax = subtotal * (parseFloat(taxRate) / 100);
  const total = subtotal + tax;

  const saveQuote = async () => {
    if (lineItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please add at least one line item",
      });
      return;
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + parseInt(validDays));

    const quoteData = {
      projectId,
      lineItems,
      subtotal,
      tax,
      total,
      validUntil: Timestamp.fromDate(validUntil),
    };

    try {
      if (selectedQuoteId) {
        await updateQuote.mutateAsync({
          id: selectedQuoteId,
          data: quoteData,
        });
        toast({
          title: "Quote Updated",
          description: "Quote has been successfully updated",
        });
      } else {
        const newQuoteId = await createQuote.mutateAsync(quoteData);
        setSelectedQuoteId(newQuoteId);
        toast({
          title: "Quote Created",
          description: "Quote has been successfully created",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save quote",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading quotes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="text-2xl font-semibold">Quote Builder</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={generateFromRooms}
            disabled={rooms.length === 0}
            data-testid="button-generate-from-rooms"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Generate from Rooms
          </Button>
          <Button onClick={addLineItem} data-testid="button-add-line-item">
            <Plus className="h-4 w-4 mr-2" />
            Add Line Item
          </Button>
        </div>
      </div>

      {lineItems.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center space-y-3">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No line items yet</p>
              <p className="text-sm text-muted-foreground">
                {rooms.length > 0 
                  ? "Click 'Generate from Rooms' to auto-create a quote from room measurements"
                  : "Add room measurements first, then generate a quote automatically"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {lineItems.map((item, index) => (
          <Card key={index} data-testid={`card-line-item-${index}`}>
            <CardContent className="pt-6">
              <div className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-5">
                    <Label htmlFor={`desc-${index}`}>Description</Label>
                    <Input
                      id={`desc-${index}`}
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      placeholder="Paint, primer, labor..."
                      data-testid={`input-description-${index}`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor={`qty-${index}`}>Quantity</Label>
                    <Input
                      id={`qty-${index}`}
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                      className="font-mono"
                      data-testid={`input-quantity-${index}`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor={`unit-${index}`}>Unit</Label>
                    <Select
                      value={item.unit}
                      onValueChange={(value) => updateLineItem(index, "unit", value)}
                    >
                      <SelectTrigger data-testid={`select-unit-${index}`}>
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
                    <Label htmlFor={`rate-${index}`}>Rate ($)</Label>
                    <Input
                      id={`rate-${index}`}
                      type="number"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => updateLineItem(index, "rate", parseFloat(e.target.value) || 0)}
                      className="font-mono"
                      data-testid={`input-rate-${index}`}
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      data-testid={`button-remove-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">Amount: </span>
                  <span className="font-mono text-lg font-semibold">
                    ${(item.quantity * item.rate).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {lineItems.length > 0 && (
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
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tax</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-20 h-7 text-sm font-mono"
                    data-testid="input-tax-rate"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
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
              <div className="flex items-center gap-2 pt-2">
                <Label htmlFor="valid-days" className="text-sm text-muted-foreground">
                  Valid for
                </Label>
                <Input
                  id="valid-days"
                  type="number"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                  className="w-20 h-8 font-mono"
                  data-testid="input-valid-days"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              onClick={saveQuote}
              disabled={createQuote.isPending || updateQuote.isPending}
              className="flex-1"
              data-testid="button-save-quote"
            >
              <Save className="h-4 w-4 mr-2" />
              {createQuote.isPending || updateQuote.isPending ? "Saving..." : "Save Quote"}
            </Button>
            <Button variant="outline" className="flex-1" data-testid="button-generate-pdf">
              <FileText className="h-4 w-4 mr-2" />
              Generate PDF
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
