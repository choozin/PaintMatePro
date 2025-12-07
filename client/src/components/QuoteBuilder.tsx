import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, Wand2, Save, Download, Copy, PlusCircle, X, Eye, EyeOff, PenTool, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { SignaturePad } from "@/components/SignaturePad";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useQuotes, useCreateQuote, useUpdateQuote } from "@/hooks/useQuotes";
import { useRooms } from "@/hooks/useRooms";
import { useProject } from "@/hooks/useProjects";
import { useClient } from "@/hooks/useClients";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { orgOperations } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { Timestamp } from "firebase/firestore";
import type { Quote } from "@/lib/firestore";
import { useEntitlements } from "@/hooks/useEntitlements";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

interface QuoteBuilderProps {
  projectId: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  unitCost?: number;
}

interface QuoteOption {
  id: string;
  name: string;
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export function QuoteBuilder({ projectId }: QuoteBuilderProps) {
  const queryClient = useQueryClient();
  const { data: quotes = [], isLoading, error: quotesError } = useQuotes(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const { data: project } = useProject(projectId);
  const { data: client } = useClient(project?.clientId || null);
  const { currentOrgId, user } = useAuth();
  const { data: org } = useOrg(currentOrgId);
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const { toast } = useToast();
  const { hasFeature, entitlements } = useEntitlements();
  const showProfitMargin = hasFeature('quote.profitMargin');
  const showTiers = hasFeature('quote.tiers');
  const showDigitalSign = hasFeature('eSign');

  const [status, setStatus] = useState<'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'>('draft');
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [options, setOptions] = useState<QuoteOption[]>([]);
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState("8.75");
  const [validDays, setValidDays] = useState("30");
  const [showInternalData, setShowInternalData] = useState(false);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<Timestamp | null>(null);
  const [createdByName, setCreatedByName] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSignatureSave = (signatureData: string) => {
    setSignature(signatureData);
    setSignedAt(Timestamp.now());
    setIsSignatureDialogOpen(false);
    toast({ title: "Signed", description: "Signature captured successfully." });
  };

  const autoGenAttempted = useRef(false);

  useEffect(() => {
    if (quotes.length > 0 && !selectedQuoteId) {
      const firstQuote = quotes[0];
      setSelectedQuoteId(firstQuote.id);
      setStatus(firstQuote.status || 'draft');
      setNotes(firstQuote.notes || "");
      setDiscount(firstQuote.discount || 0);
      setDiscountType(firstQuote.discountType || 'fixed');

      setLineItems(firstQuote.lineItems || []);
      setOptions(firstQuote.options || []);
      setActiveOptionId(firstQuote.selectedOptionId || null);
      setCreatedByName(firstQuote.createdByName || "");

      if (firstQuote.signature) {
        setSignature(firstQuote.signature);
        setSignedAt(firstQuote.signedAt || null);
      }

      // Calculate days remaining
      if (firstQuote.validUntil) {
        const validDate = firstQuote.validUntil.toDate();
        const today = new Date();
        const diffTime = Math.abs(validDate.getTime() - today.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // Approximate, or just use the difference from creation equivalent? 
        // Actually, better to just use a default or try to reverse it. 
        // If validUntil is far in future, diffDays is correct.
        setValidDays(diffDays.toString());
      }

      // Back-calculate tax rate
      if (firstQuote.subtotal > 0 && firstQuote.tax > 0) {
        const discAmount = firstQuote.discountType === 'percent'
          ? firstQuote.subtotal * ((firstQuote.discount || 0) / 100)
          : (firstQuote.discount || 0);
        const taxable = Math.max(0, firstQuote.subtotal - discAmount);
        if (taxable > 0) {
          const rate = (firstQuote.tax / taxable) * 100;
          setTaxRate(rate.toFixed(2)); // e.g. "8.75"
        }
      }
    } else if (!isLoading && quotes.length === 0 && rooms.length > 0 && !autoGenAttempted.current) {
      // Auto-generate if no quotes exist yet
      console.log("Auto-generating quote from rooms...");
      autoGenAttempted.current = true;

      // Use a small timeout to avoid state updates during render phase if strictly strict mode
      setTimeout(() => generateFromRooms(true), 100);
    }

  }, [quotes, selectedQuoteId, isLoading, rooms]);



  // ... (existing logic)



  // ...


  // ... (PDF generation updates will be separate or included if small)
  // For now let's focus on the UI and Logic saving.




  // Sync current line items to active option whenever they change (debounce or on blur would be better, but this is simple)
  useEffect(() => {
    if (activeOptionId && options.length > 0) {
      setOptions(prev => prev.map(opt => {
        if (opt.id === activeOptionId) {
          return {
            ...opt,
            lineItems: lineItems,
            subtotal: subtotal,
            tax: tax,
            total: total
          };
        }
        return opt;
      }));
    }
  }, [lineItems, activeOptionId]); // Be careful with dependency loop here. 
  // Actually, updating options triggers re-render. If we only update when lineItems change, it's fine.
  // But switching tabs also changes lineItems.
  // We need to separate "saving state" from "switching tabs".

  // Better approach: Don't use useEffect for syncing. Sync explicitly on tab switch or save.
  // But we want the "options" state to be up-to-date for the UI (e.g. if we showed totals in tabs).
  // For now, let's sync on Save and Tab Switch.

  const handleTabChange = (newId: string) => {
    if (!activeOptionId) return;

    // Save current state to the old option
    const updatedOptions = options.map(opt => {
      if (opt.id === activeOptionId) {
        return {
          ...opt,
          lineItems: lineItems,
          subtotal: subtotal,
          tax: tax,
          total: total
        };
      }
      return opt;
    });

    setOptions(updatedOptions);

    // Load new state
    const newOption = updatedOptions.find(o => o.id === newId);
    if (newOption) {
      setLineItems(newOption.lineItems);
      setActiveOptionId(newId);
    }
  };

  const addOption = () => {
    const newId = crypto.randomUUID();
    const newOption: QuoteOption = {
      id: newId,
      name: `Option ${options.length + 1}`,
      lineItems: [...lineItems], // Copy current items
      subtotal,
      tax,
      total
    };

    // If this is the first option, we also need to create an option for the CURRENT state
    if (options.length === 0) {
      const currentOption: QuoteOption = {
        id: crypto.randomUUID(),
        name: "Option 1",
        lineItems: [...lineItems],
        subtotal,
        tax,
        total
      };
      // Rename new option to Option 2
      newOption.name = "Option 2";

      setOptions([currentOption, newOption]);
      setActiveOptionId(currentOption.id); // Stay on current for a moment? Or switch?
      // Let's switch to the new one to show it was created
      setLineItems(newOption.lineItems);
      setActiveOptionId(newId);
    } else {
      const updatedOptions = options.map(opt => {
        if (opt.id === activeOptionId) {
          return { ...opt, lineItems, subtotal, tax, total };
        }
        return opt;
      });
      setOptions([...updatedOptions, newOption]);
      setLineItems(newOption.lineItems);
      setActiveOptionId(newId);
    }
  };

  const removeOption = (e: React.MouseEvent, idToRemove: string) => {
    e.stopPropagation();
    if (options.length <= 1) {
      // If removing last option, revert to single quote mode?
      setOptions([]);
      setActiveOptionId(null);
      return;
    }

    const newOptions = options.filter(o => o.id !== idToRemove);
    setOptions(newOptions);

    if (activeOptionId === idToRemove) {
      // Switch to first available
      const first = newOptions[0];
      setLineItems(first.lineItems);
      setActiveOptionId(first.id);
    }
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      description: "",
      quantity: 0,
      unit: "sq ft",
      rate: 0,
      unitCost: 0,
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

  const generateFromRooms = (isAuto = false) => {
    if (rooms.length === 0) {
      if (!isAuto) {
        toast({
          variant: "destructive",
          title: "No Rooms Found",
          description: "Please add room measurements first",
        });
      }
      return;
    }

    const totalWallArea = rooms.reduce((sum, room) => {
      const wallArea = 2 * (room.length + room.width) * room.height;
      return sum + wallArea;
    }, 0);

    // Use project config or defaults
    const coverage = project?.supplyConfig?.coveragePerGallon || 400;
    const wallCoats = project?.supplyConfig?.wallCoats || 2;

    // Calculate paint needed
    const primerGallons = Math.ceil(totalWallArea / coverage);
    const paintGallons = Math.ceil((totalWallArea * wallCoats) / coverage);

    // Estimate labor hours
    const productionRate = project?.laborConfig?.productionRate || 150;
    const hourlyRate = project?.laborConfig?.hourlyRate || 65;
    const difficultyFactor = project?.laborConfig?.difficultyFactor || 1.0;

    const laborHours = Math.ceil((totalWallArea / productionRate) * difficultyFactor);

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
        description: `Interior wall paint (${wallCoats} coats)`,
        quantity: totalWallArea,
        unit: "sq ft",
        rate: 1.25,
      },
      {
        description: `Paint material (${paintGallons} gallons)`,
        quantity: paintGallons,
        unit: "gallon",
        rate: project?.supplyConfig?.pricePerGallon || org?.estimatingSettings?.defaultPricePerGallon || 45,
        unitCost: project?.supplyConfig?.costPerGallon || org?.estimatingSettings?.defaultCostPerGallon,
      },
      {
        description: "Labor",
        quantity: laborHours,
        unit: "hour",
        rate: hourlyRate,
        unitCost: org?.estimatingSettings?.defaultLaborRate ? (org.estimatingSettings.defaultLaborRate * 0.5) : 30, // Estimate labor cost as 50% of rate or default
      },
      {
        description: "Setup and cleanup",
        quantity: 1,
        unit: "unit",
        rate: 150,
        unitCost: 50, // Estimated cost
      },
    ];

    setLineItems(generatedItems);

    setLineItems(generatedItems);

    if (!isAuto) {
      toast({
        title: "Quote Generated",
        description: `Generated ${generatedItems.length} line items from ${rooms.length} rooms`,
      });
    }
    if (isAuto) {
      toast({
        title: "Quote Auto-Generated",
        description: "Based on project room measurements.",
      });
    }
  };

  const handleRegenerateClick = () => {
    if (lineItems.length > 0) {
      if (window.confirm("Are you sure? This will overwrite your current line items.")) {
        generateFromRooms(false);
      }
    } else {
      generateFromRooms(false);
    }
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => {
      return sum + item.quantity * item.rate;
    }, 0);
  };

  const calculateTotalCost = () => {
    return lineItems.reduce((sum, item) => {
      return sum + item.quantity * (item.unitCost || 0);
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const totalCost = calculateTotalCost();

  const calculateDiscountAmount = () => {
    if (discountType === 'percent') {
      return subtotal * (discount / 100);
    }
    return discount;
  };

  const discountAmount = calculateDiscountAmount();
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);

  const tax = taxableSubtotal * (parseFloat(taxRate) / 100);
  const total = taxableSubtotal + tax;
  const grossProfit = taxableSubtotal - totalCost; // Adjusted gross profit
  const margin = taxableSubtotal > 0 ? (grossProfit / taxableSubtotal) * 100 : 0;

  const saveQuote = async () => {
    if (lineItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please add at least one line item",
      });
      return;
    }

    setIsSaving(true);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + parseInt(validDays));

    const quoteData = {
      projectId,
      lineItems,
      subtotal,
      tax,
      total,
      validUntil: Timestamp.fromDate(validUntil),
      status,
      notes,
      discount,
      discountType,
      updatedBy: user?.uid,
      updatedByName: user?.displayName || user?.email || 'Unknown User',
      createdBy: selectedQuoteId ? undefined : user?.uid, // Only set on create
      createdByName: selectedQuoteId ? undefined : (user?.displayName || user?.email || 'Unknown User'),
      // Only set createdBy if new? actually we can merge it in create/update logic below


      options: options.length > 0 ? options.map(opt => {
        // Ensure the currently active option is updated with latest state
        if (opt.id === activeOptionId) {
          return {
            ...opt,
            lineItems,
            subtotal,
            tax,
            total
          };
        }
        return opt;
      }) : null,
      selectedOptionId: activeOptionId || null,
      signature: signature || null,
      signedAt: signedAt || null,
    };

    try {
      if (selectedQuoteId) {
        await updateQuote.mutateAsync({
          id: selectedQuoteId,
          data: quoteData,
        });
        await queryClient.invalidateQueries({ queryKey: ['quotes', projectId] });
        await queryClient.invalidateQueries({ queryKey: ['all-quotes'] });
        toast({
          title: "Quote Updated",
          description: "Quote has been successfully updated",
        });
      } else {
        const newQuoteId = await createQuote.mutateAsync(quoteData);

        // Invalidate specific project quotes
        await queryClient.invalidateQueries({ queryKey: ['quotes', projectId] });
        // Invalidate global quotes list (fuzzy match to catch ['all-quotes', orgId])
        await queryClient.invalidateQueries({ queryKey: ['all-quotes'] });

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
    } finally {
      setIsSaving(false);
    }
  };

  const generatePDF = async () => {
    if (!project || !currentOrgId) return;

    try {
      // Fetch org branding
      const org = await orgOperations.get(currentOrgId);
      const branding = org?.branding || {};
      const quoteSettings = org?.quoteSettings || {};
      const layout = quoteSettings.templateLayout || 'standard';

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Colors
      const primaryColor = branding.primaryColor || '#000000';
      const secondaryColor = branding.secondaryColor || '#666666';

      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };

      const primaryRgb = hexToRgb(primaryColor);
      const secondaryRgb = hexToRgb(secondaryColor);

      // Helper to add logo
      const addLogo = async (x: number, y: number, maxWidth: number, align: 'left' | 'right' | 'center' = 'left') => {
        const logoSource = branding.logoBase64 || branding.logoUrl;
        if (!logoSource) return 0;
        try {
          const img = await loadImage(logoSource);
          const ratio = img.height / img.width;
          const width = Math.min(maxWidth, 40);
          const height = width * ratio;

          let finalX = x;
          if (align === 'right') finalX = x - width;
          if (align === 'center') finalX = x - (width / 2);

          doc.addImage(img, 'PNG', finalX, y, width, height);
          return height;
        } catch (e) {
          console.warn('Failed to load logo', e);
          return 0;
        }
      };

      let finalY = 0;

      // --- TEMPLATE LOGIC ---

      if (layout === 'modern') {
        // MODERN LAYOUT
        // Logo Top Left, Info Top Right
        const logoHeight = await addLogo(20, 20, 50, 'left');

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);

        // Company Info (Right Aligned)
        let yPos = 25;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text(branding.companyName || '', pageWidth - 20, yPos, { align: 'right' });
        yPos += 7;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);

        if (branding.companyEmail) { doc.text(branding.companyEmail, pageWidth - 20, yPos, { align: 'right' }); yPos += 5; }
        if (branding.companyPhone) { doc.text(branding.companyPhone, pageWidth - 20, yPos, { align: 'right' }); yPos += 5; }
        if (branding.website) { doc.text(branding.website, pageWidth - 20, yPos, { align: 'right' }); yPos += 5; }

        // Divider
        yPos = Math.max(yPos, logoHeight + 30) + 10;
        doc.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.setLineWidth(1);
        doc.line(20, yPos, pageWidth - 20, yPos);
        yPos += 15;

        // Quote Details
        doc.setFontSize(24);
        doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.text('QUOTE', 20, yPos);

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + parseInt(validDays));

        doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 20, yPos, { align: 'right' });
        doc.text(`Valid Until: ${validUntil.toLocaleDateString()}`, pageWidth - 20, yPos + 5, { align: 'right' });

        yPos += 15;
        doc.text(`Project: ${project.name}`, 20, yPos);
        if (client) doc.text(`Client: ${client.name}`, 20, yPos + 5);

        // Table
        autoTable(doc, {
          startY: yPos + 15,
          head: [['Description', 'Quantity', 'Unit', 'Rate', 'Amount']],
          body: lineItems.map(item => [
            item.description,
            item.quantity.toFixed(2),
            item.unit,
            `$${item.rate.toFixed(2)}`,
            `$${(item.quantity * item.rate).toFixed(2)}`
          ]),
          theme: 'plain',
          headStyles: {
            fillColor: [245, 245, 245],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            lineColor: [200, 200, 200],
            lineWidth: 0.1
          },
          styles: { fontSize: 10, cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 25, halign: 'right' },
            2: { cellWidth: 25 },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' }
          }
        });

      } else if (layout === 'minimal') {
        // MINIMAL LAYOUT
        // Centered Logo & Header
        let yPos = 20;
        const logoHeight = await addLogo(pageWidth / 2, yPos, 40, 'center');
        yPos += logoHeight + 10;

        doc.setFont('courier', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text(branding.companyName || 'QUOTE', pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('courier', 'normal');
        if (branding.companyEmail) { doc.text(branding.companyEmail, pageWidth / 2, yPos, { align: 'center' }); yPos += 5; }

        yPos += 10;
        doc.line(40, yPos, pageWidth - 40, yPos);
        yPos += 10;

        // Info Grid
        doc.text(`PROJECT: ${project.name.toUpperCase()}`, 20, yPos);
        doc.text(`DATE: ${new Date().toLocaleDateString()}`, pageWidth - 20, yPos, { align: 'right' });
        yPos += 5;
        if (client) doc.text(`CLIENT: ${client.name.toUpperCase()}`, 20, yPos);

        // Table
        autoTable(doc, {
          startY: yPos + 15,
          head: [['ITEM', 'QTY', 'UNIT', 'RATE', 'AMT']],
          body: lineItems.map(item => [
            item.description,
            item.quantity.toFixed(2),
            item.unit,
            `$${item.rate.toFixed(2)}`,
            `$${(item.quantity * item.rate).toFixed(2)}`
          ]),
          theme: 'plain',
          styles: { font: 'courier', fontSize: 9 },
          headStyles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0] },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 25, halign: 'right' },
            2: { cellWidth: 25 },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' }
          }
        });

      } else {
        // STANDARD LAYOUT (Default)
        // Header Block
        doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.rect(0, 0, pageWidth, 30, 'F');

        // Company Name
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(branding.companyName || 'Quote', 20, 20);

        // Logo (Top Right inside header)
        await addLogo(pageWidth - 20, 5, 20, 'right');

        // Quote Title
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('QUOTE', 20, 45);

        // Info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + parseInt(validDays));

        doc.text(`Project: ${project.name}`, 20, 55);
        if (client) doc.text(`Client: ${client.name}`, 20, 62);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 69);
        doc.text(`Valid Until: ${validUntil.toLocaleDateString()}`, 20, 76);

        // Company Info (Right)
        if (branding.companyEmail || branding.companyPhone || branding.companyAddress) {
          doc.setTextColor(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);
          let yPos = 45;
          if (branding.companyEmail) { doc.text(branding.companyEmail, pageWidth - 20, yPos, { align: 'right' }); yPos += 7; }
          if (branding.companyPhone) { doc.text(branding.companyPhone, pageWidth - 20, yPos, { align: 'right' }); yPos += 7; }
          if (branding.companyAddress) {
            const addressLines = branding.companyAddress.split('\n');
            addressLines.forEach(line => {
              doc.text(line, pageWidth - 20, yPos, { align: 'right' });
              yPos += 7;
            });
          }
        }

        // Table
        autoTable(doc, {
          startY: 90,
          head: [['Description', 'Quantity', 'Unit', 'Rate', 'Amount']],
          body: lineItems.map(item => [
            item.description,
            item.quantity.toFixed(2),
            item.unit,
            `$${item.rate.toFixed(2)}`,
            `$${(item.quantity * item.rate).toFixed(2)}`
          ]),
          theme: 'striped',
          headStyles: {
            fillColor: [primaryRgb.r, primaryRgb.g, primaryRgb.b],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
          },
          styles: { fontSize: 10 },
          columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 25, halign: 'right' },
            2: { cellWidth: 25 },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' }
          }
        });
      }

      // --- TOTALS & FOOTER (Common) ---
      finalY = (doc as any).lastAutoTable.finalY + 10;

      // Calculate required space for Totals + Signature
      // Totals block: ~25 units
      // Signature block: ~40 units
      // Gap: ~5 units
      const requiredSpace = 70;

      if (finalY + requiredSpace > pageHeight - 20) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Subtotal:', pageWidth - 70, finalY);
      doc.text(`$${subtotal.toFixed(2)}`, pageWidth - 20, finalY, { align: 'right' });

      if (discount > 0) {
        doc.setTextColor(200, 0, 0);
        doc.text('Discount:', pageWidth - 70, finalY + 7);
        doc.text(`-$${discountAmount.toFixed(2)}`, pageWidth - 20, finalY + 7, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        finalY += 7;
      }

      doc.text(`Tax (${taxRate}%):`, pageWidth - 70, finalY + 7);
      doc.text(`$${tax.toFixed(2)}`, pageWidth - 20, finalY + 7, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Total:', pageWidth - 70, finalY + 17);
      doc.text(`$${total.toFixed(2)}`, pageWidth - 20, finalY + 17, { align: 'right' });

      // Signature
      if (signature) {
        let signatureY = finalY + 25; // Gap between totals and signature
        doc.setFontSize(10);
        doc.text('Customer Signature:', 20, signatureY);
        doc.addImage(signature, 'PNG', 20, signatureY + 5, 60, 20); // Adjust size as needed
        doc.text(`Signed At: ${signedAt ? new Date(signedAt.seconds * 1000).toLocaleString() : 'N/A'}`, 20, signatureY + 30);
      }

      // Notes
      if (notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        const notesY = Math.max(finalY + 25, pageHeight - 100);
        doc.text('Notes:', 20, notesY);
        const splitNotes = doc.splitTextToSize(notes, pageWidth - 40);
        doc.text(splitNotes, 20, notesY + 5);
      }

      // Terms
      if (quoteSettings.defaultTerms) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const termsY = Math.max(finalY + 30, pageHeight - 50);
        doc.text('Terms & Conditions:', 20, termsY);
        const splitTerms = doc.splitTextToSize(quoteSettings.defaultTerms, pageWidth - 40);
        doc.text(splitTerms, 20, termsY + 5);
      }

      // Footer
      if (layout !== 'minimal') {
        doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setTextColor(0, 0, 0);
        doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
      }

      // Page Numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 20, pageHeight - 10, { align: 'right' });

        if (branding.website) {
          doc.text(branding.website, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
      }

      // Save PDF
      const fileName = `Quote_${project.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF Generated",
        description: `Quote saved as ${fileName} (${layout} layout)`,
      });
    } catch (error: any) {
      console.error('PDF generation error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate PDF",
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
            onClick={handleRegenerateClick}
            disabled={rooms.length === 0}
            data-testid="button-generate-from-rooms"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Regenerate Quote from Project Data
          </Button>
          <Button onClick={addLineItem} data-testid="button-add-line-item">
            <Plus className="h-4 w-4 mr-2" />
            Add Line Item
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Label>Status</Label>
          <Select value={status} onValueChange={(val: any) => setStatus(val)}>
            <SelectTrigger className={
              status === 'accepted' ? 'border-green-500 text-green-700 bg-green-50' :
                status === 'sent' ? 'border-blue-500 text-blue-700 bg-blue-50' : ''
            }>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {createdByName && (
            <div className="mt-4">
              <Label className="text-muted-foreground text-xs">Created By</Label>
              <div className="text-sm font-medium">{createdByName}</div>
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <Label>Client Notes</Label>
          <Input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes for the customer (e.g. 'Includes 5% spring discount')"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button onClick={() => saveQuote()} disabled={isSaving} data-testid="button-save-quote">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Quote"}
          </Button>

          {showDigitalSign && (
            <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className={signature ? "border-green-500 text-green-600 hover:text-green-700" : ""}>
                  <PenTool className="h-4 w-4 mr-2" />
                  {signature ? "Signed" : "Sign Quote"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Customer Signature</DialogTitle>
                </DialogHeader>
                <SignaturePad onSave={handleSignatureSave} onCancel={() => setIsSignatureDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {signature && (
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-green-800 flex items-center gap-2">
                <Check className="h-4 w-4" />
                Quote Signed
              </h3>
              <p className="text-sm text-green-600">
                {signedAt ? new Date(signedAt.seconds * 1000).toLocaleString() : 'Just now'}
              </p>
            </div>
            <div className="border bg-white p-2 rounded">
              <img src={signature} alt="Customer Signature" className="h-12" />
            </div>
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { setSignature(null); setSignedAt(null); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {showProfitMargin && (
        <div className="flex items-center justify-end space-x-2">
          <Switch
            id="show-internal"
            checked={showInternalData}
            onCheckedChange={setShowInternalData}
          />
          <Label htmlFor="show-internal" className="text-sm text-muted-foreground flex items-center gap-2 cursor-pointer">
            {showInternalData ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Show Internal Data
          </Label>
        </div>
      )}

      {showTiers && (
        <div className="flex items-center gap-2">
          {options.length > 0 ? (
            <Tabs value={activeOptionId || undefined} onValueChange={handleTabChange} className="w-full">
              <div className="flex items-center justify-between mb-2">
                <TabsList>
                  {options.map(option => (
                    <TabsTrigger key={option.id} value={option.id} className="group relative pr-8">
                      {option.name}
                      <span
                        onClick={(e) => removeOption(e, option.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:text-destructive cursor-pointer p-0.5 rounded-full hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Button variant="outline" size="sm" onClick={addOption}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              </div>
            </Tabs>
          ) : (
            <div className="w-full flex justify-end">
              <Button variant="ghost" size="sm" onClick={addOption} className="text-muted-foreground hover:text-primary">
                <Copy className="h-4 w-4 mr-2" />
                Enable Tiered Options
              </Button>
            </div>
          )}
        </div>
      )}

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

      {showProfitMargin && showInternalData && lineItems.length > 0 && (
        <Card className="bg-muted/30 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Profit Analysis (Internal Only)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">${subtotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold text-orange-600">${totalCost.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Profit</p>
                <p className={`text-2xl font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${grossProfit.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Margin</p>
                <p className={`text-2xl font-bold ${margin >= 30 ? 'text-green-600' : margin >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {margin.toFixed(1)}%
                </p>
              </div>
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
                  <div className={`md:col-span-${showProfitMargin && showInternalData ? 3 : 5}`}>
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
                  {showProfitMargin && showInternalData && (
                    <div className="md:col-span-2">
                      <Label htmlFor={`cost-${index}`} className="text-orange-600">Unit Cost</Label>
                      <Input
                        id={`cost-${index}`}
                        type="number"
                        step="0.01"
                        value={item.unitCost || 0}
                        onChange={(e) => updateLineItem(index, "unitCost", parseFloat(e.target.value) || 0)}
                        className="font-mono border-orange-200 focus-visible:ring-orange-500"
                        placeholder="0.00"
                      />
                    </div>
                  )}

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
                  <span className="text-muted-foreground">Discount</span>
                  <div className="flex items-center border rounded-md overflow-hidden h-7">
                    <input
                      type="number"
                      value={discount}
                      onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-16 h-full px-2 text-sm font-mono border-none focus:outline-none"
                    />
                    <button
                      onClick={() => setDiscountType(discountType === 'fixed' ? 'percent' : 'fixed')}
                      className="bg-muted px-2 h-full text-xs hover:bg-muted/80 border-l"
                    >
                      {discountType === 'fixed' ? '$' : '%'}
                    </button>
                  </div>
                </div>
                <span className="font-mono font-semibold text-red-500">
                  -${discountAmount.toFixed(2)}
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

            {showDigitalSign && (
              <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className={`flex-1 ${signature ? "border-green-500 text-green-600 hover:text-green-700" : ""}`}>
                    <PenTool className="h-4 w-4 mr-2" />
                    {signature ? "Signed" : "Sign Quote"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Customer Signature</DialogTitle>
                  </DialogHeader>
                  <SignaturePad onSave={handleSignatureSave} onCancel={() => setIsSignatureDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            )}

            <Button
              variant="outline"
              className="flex-1"
              onClick={generatePDF}
              disabled={!project}
              data-testid="button-generate-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate PDF
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
