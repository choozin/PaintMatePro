import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, Wand2, Save, Download, Copy, PlusCircle, X, Eye, EyeOff, PenTool, Check, Settings2, Mail, RefreshCw, User, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { SignaturePad } from "@/components/SignaturePad";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useQuotes, useCreateQuote, useUpdateQuote } from "@/hooks/useQuotes";
import { useRooms } from "@/hooks/useRooms";
import { useProject, useUpdateProject } from "@/hooks/useProjects";
import { useClient } from "@/hooks/useClients";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { orgOperations } from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { useCatalog } from "@/hooks/useCatalog";
import { Timestamp } from "firebase/firestore";
import type { Quote } from "@/lib/firestore";
import { useEntitlements } from "@/hooks/useEntitlements";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { QuoteConfiguration, DEFAULT_QUOTE_CONFIG } from "@/types/quote-config";
import { generateQuoteLinesV2, flattenQuoteLines } from "@/lib/quote-generator-v2";
import { QuoteConfigWizard } from "./QuoteConfiguration/QuoteConfigWizard";
import { FeatureLock } from "@/components/FeatureLock";
import { calculateTaxLines, TaxLine } from "@/lib/financeUtils";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency";

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
  isHeader?: boolean;
  amount?: number;
}

interface QuoteOption {
  id: string;
  name: string;
  lineItems: LineItem[];
  subtotal: number;
  tax?: number; // Keep for legacy compatibility 
  taxTotal: number;
  taxLines?: TaxLine[];
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
  const updateProject = useUpdateProject();
  const { toast } = useToast();
  const { hasFeature, entitlements } = useEntitlements();
  const showProfitMargin = hasFeature('quote.profitMargin');
  const showTiers = hasFeature('quote.tiers');
  const showDigitalSign = hasFeature('eSign');

  const { items: catalogItems } = useCatalog();

  const [status, setStatus] = useState<'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'>('draft');
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [options, setOptions] = useState<QuoteOption[]>([]);
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  const [taxLines, setTaxLines] = useState<Array<{ name: string; rate: number }>>([]);
  const [validDays, setValidDays] = useState("30");
  const [showInternalData, setShowInternalData] = useState(false);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<Timestamp | null>(null);
  const [createdByName, setCreatedByName] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Template State
  const [activeTemplateId, setActiveTemplateId] = useState<string>("");
  const [customConfig, setCustomConfig] = useState<QuoteConfiguration | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // Initialize Template Selection
  useEffect(() => {
    if (!activeTemplateId) {
      // Default to Project's template priority, then Org's default, then fallback to empty (Standard)
      if (project?.quoteTemplateId) {
        setActiveTemplateId(project.quoteTemplateId);
      } else if (org?.defaultQuoteTemplateId) {
        setActiveTemplateId(org.defaultQuoteTemplateId);
      }
      // If neither, we stay empty, which implies Standard Template (DEFAULT_QUOTE_CONFIG)
    }
  }, [project?.quoteTemplateId, org, activeTemplateId]);

  // Initialize tax and currency from org defaults
  useEffect(() => {
    if (org) {
      if (taxLines.length === 0 && !selectedQuoteId) {
        if (org.quoteSettings?.defaultTaxLines) {
          setTaxLines(org.quoteSettings.defaultTaxLines);
        } else if (org.estimatingSettings?.defaultTaxRate !== undefined) {
          setTaxLines([{ name: 'Tax', rate: org.estimatingSettings.defaultTaxRate }]);
        }
      }
    }
  }, [org, taxLines.length, selectedQuoteId]);

  const handleEmailPDF = () => {
    if (!client || !client.email) {
      toast({
        variant: "destructive",
        title: "No Email Found",
        description: "This client has no email address on file.",
      });
      return;
    }

    const subject = `Quote for ${project?.name || 'Project'}`;
    const body = `Hi ${client.name},\n\nPlease find attached the quote for ${project?.name}.\n\nBest regards,\n${user?.displayName || 'The Team'}`;

    // Step 1: Open mailto
    const mailtoLink = `mailto:${client.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;

    toast({
      title: "Email Client Opened",
      description: "Please download the PDF from the top right and attach it manually.",
    });
  };

  const handleSignatureSave = async (signatureData: string) => {
    setSignature(signatureData);
    setSignedAt(Timestamp.now());
    setIsSignatureDialogOpen(false);

    // Trigger Timeline Event for Acceptance
    if (project?.timeline && !project.timeline.some(e => e.type === 'quote_accepted')) {
      const newEvent: any = {
        id: crypto.randomUUID(),
        type: 'quote_accepted',
        label: 'Quote Accepted',
        date: Timestamp.now(),
        notes: 'Signed via Digital Signature'
      };
      const newTimeline = [...project.timeline, newEvent];

      try {
        await updateProject.mutateAsync({
          id: projectId,
          data: {
            timeline: newTimeline,
          }
        });
        toast({ title: "Signed & Accepted", description: "Quote signed. Project status updated." });
      } catch (err) {
        console.error(err);
        toast({ variant: "destructive", title: "Update Failed", description: "Saved signature but failed to update status." });
      }
    } else {
      toast({ title: "Signed", description: "Signature captured successfully." });
    }
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

      // Calculate days remaining (negative = expired)
      if (firstQuote.validUntil) {
        const validDate = firstQuote.validUntil.toDate();
        const today = new Date();
        const diffTime = validDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        setValidDays(Math.max(0, diffDays).toString());
      }

      // Restore tax lines
      if (firstQuote.taxLines && firstQuote.taxLines.length > 0) {
        setTaxLines(firstQuote.taxLines.map(tl => ({ name: tl.name, rate: tl.rate })));
      } else if ((firstQuote as any).taxRate !== undefined) {
        setTaxLines([{ name: 'Tax', rate: (firstQuote as any).taxRate }]);
      } else if (firstQuote.subtotal > 0 && firstQuote.tax && firstQuote.tax > 0) {
        const discAmount = firstQuote.discountType === 'percent'
          ? firstQuote.subtotal * ((firstQuote.discount || 0) / 100)
          : (firstQuote.discount || 0);
        const taxable = Math.max(0, firstQuote.subtotal - discAmount);
        if (taxable > 0) {
          const rate = (firstQuote.tax / taxable) * 100;
          setTaxLines([{ name: 'Tax', rate: parseFloat(rate.toFixed(2)) }]);
        }
      }
    } else if (!isLoading && quotes.length === 0 && rooms.length > 0 && !autoGenAttempted.current) {
      // Auto-generate if no quotes exist yet
      console.log("Auto-generating quote from rooms...");
      autoGenAttempted.current = true;
      setTimeout(() => generateFromRooms(true), 100);
    }

  }, [quotes, selectedQuoteId, isLoading, rooms]);

  useEffect(() => {
    if (activeOptionId && options.length > 0) {
      setOptions(prev => prev.map(opt => {
        if (opt.id === activeOptionId) {
          return {
            ...opt,
            lineItems: lineItems,
            subtotal: subtotal,
            tax: taxTotal, // Keeping legacy field for safety but using total
            taxTotal: taxTotal,
            taxLines: calculatedTaxes,
            total: total
          };
        }
        return opt;
      }));
    }
  }, [lineItems, activeOptionId]);

  const handleTabChange = (newId: string) => {
    if (!activeOptionId) return;

    // Save current state to the old option
    const updatedOptions = options.map(opt => {
      if (opt.id === activeOptionId) {
        return {
          ...opt,
          lineItems: lineItems,
          subtotal: subtotal,
          tax: taxTotal,
          taxTotal: taxTotal,
          taxLines: calculatedTaxes,
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
      tax: taxTotal,
      taxTotal,
      taxLines: calculatedTaxes,
      total
    };

    if (options.length === 0) {
      const currentOption: QuoteOption = {
        id: crypto.randomUUID(),
        name: "Option 1",
        lineItems: [...lineItems],
        subtotal,
        tax: taxTotal,
        taxTotal,
        taxLines: calculatedTaxes,
        total
      };
      newOption.name = "Option 2";

      setOptions([currentOption, newOption]);
      setLineItems(newOption.lineItems);
      setActiveOptionId(newId);
    } else {
      const updatedOptions = options.map(opt => {
        if (opt.id === activeOptionId) {
          return { ...opt, lineItems, subtotal, tax: taxTotal, taxTotal, taxLines: calculatedTaxes, total };
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
      setOptions([]);
      setActiveOptionId(null);
      return;
    }

    const newOptions = options.filter(o => o.id !== idToRemove);
    setOptions(newOptions);

    if (activeOptionId === idToRemove) {
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
    const newItems = lineItems.filter((_, i) => i !== index);
    setLineItems(recalculateHeaders(newItems));
  };

  // Helper to recalculate header totals
  const recalculateHeaders = (items: LineItem[]) => {
    let currentHeaderIndex = -1;
    let currentHeaderTotal = 0;
    const newItems = [...items];

    // First pass: identify headers and reset their amounts
    // Second pass: sum up
    // Actually single pass is tricky if we want to modify in place or copy
    // Let's iterate and keep track

    for (let i = 0; i < newItems.length; i++) {
      if (newItems[i].isHeader) {
        // If we were processing a previous header, update it now? 
        // No, simpler: When we hit a header, we set the *previous* header's total? 
        // Or better: Just sum accumulated total to the currentHeaderIndex

        if (currentHeaderIndex !== -1) {
          newItems[currentHeaderIndex] = { ...newItems[currentHeaderIndex], amount: currentHeaderTotal };
        }

        // Start new section
        currentHeaderIndex = i;
        currentHeaderTotal = 0;
      } else {
        // Add to total
        const qty = newItems[i].quantity || 0;
        const rate = newItems[i].rate || 0;
        currentHeaderTotal += (qty * rate);
      }
    }

    // Update last header
    if (currentHeaderIndex !== -1) {
      newItems[currentHeaderIndex] = { ...newItems[currentHeaderIndex], amount: currentHeaderTotal };
    }

    return newItems;
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updatedItems = lineItems.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });

    // Only recalculate if we changed quantity or rate, or if it's a structural change?
    // Rate/Quantity changes affect totals.
    if (field === 'quantity' || field === 'rate' || field === 'amount') {
      setLineItems(recalculateHeaders(updatedItems));
    } else {
      setLineItems(updatedItems);
    }
  };

  // ... existing code ...



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

    if (!project) return;

    let activeConfig = customConfig || DEFAULT_QUOTE_CONFIG;

    if (!customConfig && org && org.quoteTemplates) {
      const targetId = activeTemplateId || project?.quoteTemplateId || org.defaultQuoteTemplateId;
      if (targetId) {
        const tmpl = org.quoteTemplates.find(t => t.id === targetId);
        if (tmpl) activeConfig = tmpl.config;
      }
    }

    const generatedItems = generateQuoteLinesV2(project as any, rooms as any[], activeConfig, catalogItems);
    const flatItems = flattenQuoteLines(generatedItems);

    setLineItems(flatItems);

    if (!isAuto) {
      toast({
        title: "Quote Generated",
        description: `Generated items based on ${rooms.length} rooms using ${'listingStrategy' in activeConfig ? activeConfig.listingStrategy : 'Standard'} format.`,
      });
    }
  };

  const handleRegenerateClick = () => {
    if (lineItems.length > 0) {
      toast({
        title: "Overwrite line items?",
        description: "This will replace all current line items with auto-generated ones.",
        action: (
          <Button size="sm" variant="destructive" onClick={() => generateFromRooms(false)}>
            Confirm
          </Button>
        ),
      });
    } else {
      generateFromRooms(false);
    }
  };

  const handleTemplateChange = async (templateId: string) => {
    setActiveTemplateId(templateId);
    setCustomConfig(null); // Reset custom config when template changes
    try {
      await updateProject.mutateAsync({
        id: projectId,
        data: { quoteTemplateId: templateId }
      });
      toast({ title: "Template Preference Saved" });

      if (lineItems.length > 0) {
        toast({
          title: "Regenerate quote?",
          description: "Template changed. Regenerate to match new format? (This overwrites current items)",
          action: (
            <Button size="sm" variant="destructive" onClick={() => setTimeout(() => generateFromRooms(false), 0)}>
              Regenerate
            </Button>
          ),
        });
      }
    } catch (e) {
      console.error(e);
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

  const { taxLines: calculatedTaxes, taxTotal } = calculateTaxLines(taxableSubtotal, taxLines);
  const total = taxableSubtotal + taxTotal;
  const grossProfit = taxableSubtotal - totalCost;
  const margin = taxableSubtotal > 0 ? (grossProfit / taxableSubtotal) * 100 : 0;
  const currency = org?.currency || 'USD';
  const symbol = getCurrencySymbol(currency);

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
      tax: taxTotal,
      taxTotal,
      taxLines: calculatedTaxes,
      total,
      currency,
      validUntil: Timestamp.fromDate(validUntil),
      status,
      notes,
      discount,
      discountType,
      updatedBy: user?.uid,
      updatedByName: user?.displayName || user?.email || 'Unknown User',
      createdBy: selectedQuoteId ? undefined : user?.uid,
      createdByName: selectedQuoteId ? undefined : (user?.displayName || user?.email || 'Unknown User'),
      taxRate: taxLines.length > 0 ? taxLines[0].rate : 0, // Legacy fallback

      options: options.length > 0 ? options.map(opt => {
        if (opt.id === activeOptionId) {
          return {
            ...opt,
            lineItems,
            subtotal,
            tax: taxTotal,
            taxTotal,
            taxLines: calculatedTaxes,
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
        await queryClient.invalidateQueries({ queryKey: ['quotes', projectId] });
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
      const org = await orgOperations.get(currentOrgId);
      const branding = org?.branding || {};
      const quoteSettings = org?.quoteSettings || {};
      const layout = quoteSettings.templateLayout || 'standard';

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

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
          // Scale based on height to maintain header proportions
          const height = Math.min(img.height, maxHeight);
          const width = height * ratio;

          // Limit width so it doesn't span the whole page if it's super wide
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

      let finalY = 0;

      if (layout === 'modern') {
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

        // Determine the starting point for the content based on the tallest header element
        let headerBottomY = Math.max(currentY, (logoHeight > 0 ? 15 + logoHeight : 25)) + 12;

        // Divider Line
        doc.setDrawColor(220, 220, 220); // Soft gray
        doc.setLineWidth(0.5);
        doc.line(20, headerBottomY, pageWidth - 20, headerBottomY);

        headerBottomY += 15;

        // --- CLIENT & PROJECT INFO SECTION ---
        // We don't need this old line drawing since we did it above

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
        doc.text(`Quote ID: ${selectedQuoteId?.slice(0, 8) || 'DRAFT'}`, pageWidth - 20, headerBottomY + 16, { align: 'right' });

        let yPos = headerBottomY + 35; // Start of table generator
        doc.line(20, yPos, pageWidth - 20, yPos);
        yPos += 15;
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
        autoTable(doc, {
          startY: yPos + 15,
          head: [['Description', 'Quantity', 'Unit', 'Rate', 'Amount']],
          body: lineItems.map(item => {
            if ((item as any).isHeader) {
              const amt = (item as any).amount;
              return [
                item.description,
                '',
                '',
                '',
                amt ? `$${Number(amt).toFixed(2)}` : ''
              ];
            }
            return [
              item.description,
              item.quantity.toFixed(2),
              item.unit,
              `$${item.rate.toFixed(2)}`,
              `$${(item.quantity * item.rate).toFixed(2)}`
            ];
          }),
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
        doc.text(`PROJECT: ${project.name.toUpperCase()}`, 20, yPos);
        doc.text(`DATE: ${new Date().toLocaleDateString()}`, pageWidth - 20, yPos, { align: 'right' });
        yPos += 5;
        if (client) doc.text(`CLIENT: ${client.name.toUpperCase()}`, 20, yPos);
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
        // --- STANDARD LAYOUT ---
        let currentY = 20;

        const logoHeight = await addLogo(pageWidth / 2, currentY, 40, 'center');
        currentY = logoHeight > 0 ? currentY + logoHeight + 10 : 25;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.text(branding.companyName || 'QUOTE', pageWidth / 2, currentY, { align: 'center' });

        currentY += 8;

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        if (branding.companyEmail) { doc.text(branding.companyEmail, pageWidth / 2, currentY, { align: 'center' }); currentY += 5; }
        if (branding.companyPhone) { doc.text(branding.companyPhone, pageWidth / 2, currentY, { align: 'center' }); currentY += 5; }
        if (branding.website) { doc.text(branding.website, pageWidth / 2, currentY, { align: 'center' }); currentY += 5; }
        if (branding.companyAddress) { doc.text(branding.companyAddress.replace('\n', ', '), pageWidth / 2, currentY, { align: 'center' }); currentY += 5; }

        currentY += 5;
        doc.setDrawColor(200, 200, 200);
        doc.line(20, currentY, pageWidth - 20, currentY);
        currentY += 15;

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(`Prepared for: ${client?.name || 'Valued Client'}`, 20, currentY);
        currentY += 6;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Project Name: ${project.name}`, 20, currentY); currentY += 5;
        if (client?.email) { doc.text(client.email, 20, currentY); currentY += 5; }
        if (client?.address) {
          const splitAddress = doc.splitTextToSize(`Address: ${client.address}`, pageWidth / 2 - 20);
          doc.text(splitAddress, 20, currentY);
          currentY += splitAddress.length * 5;
        }

        currentY += 5;

        const tableColumn = ["Description", "Quantity", "Rate", "Total"];
        const tableRows: any[] = [];

        lineItems.forEach(item => {
          let desc = item.description;
          // Assuming 'internalDescription' might be a field, or just using description
          // if (item.internalDescription) {
          //   desc += `\n${item.internalDescription}`;
          // }
          tableRows.push([
            desc,
            `${item.quantity.toFixed(2)} ${item.unit}`,
            `$${item.rate.toFixed(2)}`,
            `$${(item.quantity * item.rate).toFixed(2)}`
          ]);
        });

        autoTable(doc, {
          startY: currentY,
          head: [tableColumn],
          body: tableRows,
          theme: 'grid',
          headStyles: { fillColor: [primaryRgb.r, primaryRgb.g, primaryRgb.b], textColor: 255, fontStyle: 'bold' },
          styles: { fontSize: 9, cellPadding: 5 },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 30, halign: 'center' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' },
          }
        });

        finalY = (doc as any).lastAutoTable.finalY + 15;

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Subtotal:`, pageWidth - 60, finalY);
        doc.text(formatCurrency(subtotal, currency), pageWidth - 20, finalY, { align: 'right' });

        let currentTaxY = finalY + 6;
        calculatedTaxes.forEach(tl => {
          doc.text(`${tl.name} (${tl.rate}%):`, pageWidth - 60, currentTaxY);
          doc.text(formatCurrency(tl.amount, currency), pageWidth - 20, currentTaxY, { align: 'right' });
          currentTaxY += 6;
        });

        doc.setDrawColor(200, 200, 200);
        doc.line(pageWidth - 60, currentTaxY + 4, pageWidth - 20, currentTaxY + 4);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Total:`, pageWidth - 60, currentTaxY + 12);
        doc.text(formatCurrency(total, currency), pageWidth - 20, currentTaxY + 12, { align: 'right' });
      }

      finalY = (doc as any).lastAutoTable.finalY + 15;

      // --- MODERN TOTALS SECTION ---
      doc.setFillColor(249, 250, 251); // Gray-50 background for totals
      doc.rect(pageWidth - 90, finalY - 5, 70, 45, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.rect(pageWidth - 90, finalY - 5, 70, 45, 'S');

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Subtotal:', pageWidth - 85, finalY + 5);
      doc.text(formatCurrency(subtotal, currency), pageWidth - 25, finalY + 5, { align: 'right' });

      let modernTaxY = finalY + 15;
      calculatedTaxes.forEach(tl => {
        doc.text(`${tl.name} (${tl.rate}%):`, pageWidth - 85, modernTaxY);
        doc.text(formatCurrency(tl.amount, currency), pageWidth - 25, modernTaxY, { align: 'right' });
        modernTaxY += 10;
      });

      doc.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.setLineWidth(0.5);
      doc.line(pageWidth - 85, modernTaxY - 3, pageWidth - 25, modernTaxY - 3);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Total:', pageWidth - 85, modernTaxY + 7);
      doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.text(formatCurrency(total, currency), pageWidth - 25, modernTaxY + 7, { align: 'right' });

      // --- COMMON FOOTER (TERMS, NOTES, SIGNATURE) ---
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');

      let nextY = finalY + 45; // Start below the totals

      if (signature) {
        let signatureY = nextY;
        doc.setFontSize(10);
        doc.text('Customer Signature:', 20, signatureY);
        doc.addImage(signature, 'PNG', 20, signatureY + 5, 60, 20);
        doc.text(`Signed At: ${signedAt ? new Date(signedAt.seconds * 1000).toLocaleString() : 'N/A'}`, 20, signatureY + 30);
        nextY = signatureY + 40;
      }

      if (notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        const notesY = Math.max(finalY + 25, pageHeight - 100);
        doc.text('Notes:', 20, notesY);
        const splitNotes = doc.splitTextToSize(notes, pageWidth - 40);
        doc.text(splitNotes, 20, notesY + 5);
      }

      if (quoteSettings.defaultTerms) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const termsY = Math.max(finalY + 30, pageHeight - 50);
        doc.text('Terms & Conditions:', 20, termsY);
        const splitTerms = doc.splitTextToSize(quoteSettings.defaultTerms, pageWidth - 40);
        doc.text(splitTerms, 20, termsY + 5);
      }

      if (layout !== 'minimal') {
        doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setTextColor(0, 0, 0);
        doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
      }

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

      const safeProjectName = project.name.replace(/[^a-zA-Z0-9-]/g, '_');
      const fileName = `Quote_${safeProjectName}_${new Date().toISOString().split('T')[0]}.pdf`;

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

      <div className="flex flex-col space-y-4">
        {/* Top Controls Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-card p-4 rounded-xl shadow-sm border border-border/40">
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleRegenerateClick}
              className="bg-amber-400 hover:bg-amber-500 text-amber-950 font-semibold shadow-sm border border-amber-500/20"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Items
            </Button>

            <Dialog open={showWizard} onOpenChange={setShowWizard}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900 shadow-sm">
                  <Settings2 className="h-4 w-4 mr-2 text-slate-500" />
                  Template Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50/50 backdrop-blur-sm">
                <QuoteConfigWizard
                  onComplete={async (newConfig) => {
                    setShowWizard(false);
                    setCustomConfig(newConfig);
                    // Defer generation to ensure state update, though strictly not necessary if passing direct, 
                    // but we want the "Regenerate" button to work later too.
                    setTimeout(() => generateFromRooms(false), 0);
                  }}
                  onCancel={() => setShowWizard(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className={`text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500 font-medium uppercase tracking-wider ${status === 'accepted' ? 'bg-green-100 text-green-700' : ''}`}>
              {status}
            </span>
            {showTiers && (
              <div className="flex border rounded-lg p-0.5 bg-muted/20">
                {/* Tier tabs would go here if cleaner implementation needed, reused existing logic below for now */}
              </div>
            )}
          </div>
        </div>

        {/* Main Quote Content */}
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden ring-1 ring-slate-900/5">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 opacity-80" />

          <CardContent className="p-0">
            {/* Header Section */}
            <div className="p-8 pb-4 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h1 className="text-3xl font-light tracking-tight text-slate-900">
                  Quote
                  <span className="text-slate-300 mx-3 font-thin">/</span>
                  <span className="text-xl font-normal text-slate-500">{project?.name}</span>
                </h1>
                <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                  {client && <p className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> {client.name}</p>}
                  <p className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex justify-start md:justify-end items-start">
                {/* Option Tabs (Pill Design) */}
                {showTiers && options.length > 0 && (
                  <div className="flex bg-slate-100/80 p-1 rounded-xl">
                    {options.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => handleTabChange(opt.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeOptionId === opt.id
                          ? 'bg-white text-primary shadow-sm ring-1 ring-black/5'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
                          }`}
                      >
                        {opt.name}
                      </button>
                    ))}
                    <FeatureLock feature="quote.tiers">
                      <button onClick={addOption} className="px-3 py-2 text-slate-400 hover:text-primary transition-colors">
                        <Plus className="h-4 w-4" />
                      </button>
                    </FeatureLock>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mt-4 w-full max-w-full overflow-x-auto pb-6">
              <div className="min-w-[500px]">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 md:gap-4 px-4 md:px-8 py-3 bg-slate-50/50 border-y border-slate-100 text-xs font-semibold uppercase tracking-widest text-slate-500">
                  <div className="col-span-4 md:col-span-4">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 md:col-span-2">Unit</div>
                  <div className="col-span-2 md:col-span-2 text-right">Rate</div>
                  <div className="col-span-2 text-right">Amount</div>
                  {/* Action Col Placeholder */}
                  <div className="hidden md:block w-8"></div>
                </div>

                {/* Items */}
                <div className="divide-y divide-slate-50">
                  {lineItems.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground bg-slate-50/20">
                      <Wand2 className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                      <p>No items yet. Generate from rooms to start.</p>
                    </div>
                  ) : (
                    lineItems.map((item, index) => {
                      const isHeader = item.isHeader;

                      if (isHeader) {
                        return (
                          <div key={index} className="grid grid-cols-12 gap-2 md:gap-4 px-4 md:px-8 py-4 bg-slate-50/80 mt-2 first:mt-0 group transition-colors hover:bg-slate-100/50">
                            <div className="col-span-8 md:col-span-8 font-bold text-slate-700 flex items-center tracking-tight">
                              {item.description}
                            </div>
                            <div className="col-span-4 md:col-span-4 text-right font-semibold text-slate-900">
                              {/* Header Total */}
                              ${(item.amount || 0).toFixed(2)}
                            </div>

                          </div>
                        );
                      }

                      return (
                        <div key={index} className="grid grid-cols-12 gap-2 md:gap-4 px-4 md:px-8 py-2 items-center group transition-colors hover:bg-blue-50/30">
                          <div className="col-span-4 md:col-span-4">
                            <input
                              className="w-full bg-transparent border border-transparent rounded px-2 py-1 text-slate-700 placeholder:text-slate-300 focus:border-primary/20 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-sm"
                              value={item.description}
                              onChange={(e) => updateLineItem(index, "description", e.target.value)}
                              placeholder="Desc"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              className="w-full bg-transparent border border-transparent rounded px-1 py-1 text-right text-slate-600 focus:border-primary/20 focus:bg-white focus:outline-none font-mono text-sm"
                              value={item.quantity || ''}
                              onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                            />
                          </div>

                          <div className="col-span-2 md:col-span-2">
                            <select
                              className="w-full bg-transparent border border-transparent rounded px-0 py-1 text-xs text-slate-500 focus:border-primary/20 focus:bg-white focus:outline-none"
                              value={item.unit}
                              onChange={(e) => updateLineItem(index, "unit", e.target.value)}
                            >
                              <option value="sqft">sqft</option>
                              <option value="gal">gal</option>
                              <option value="ea">ea</option>
                              <option value="hr">hr</option>
                              <option value="lf">lf</option>
                              <option value="set">set</option>
                            </select>
                          </div>

                          <div className="col-span-2 md:col-span-2">
                            <input
                              type="number"
                              className="w-full bg-transparent border border-transparent rounded px-1 py-1 text-right text-slate-600 focus:border-primary/20 focus:bg-white focus:outline-none font-mono text-sm"
                              value={item.rate || ''}
                              onChange={(e) => updateLineItem(index, "rate", parseFloat(e.target.value) || 0)}
                            />
                          </div>

                          <div className="col-span-2 text-right font-mono text-sm text-slate-700">
                            ${((item.quantity || 0) * (item.rate || 0)).toFixed(2)}
                          </div>

                          <div className="hidden md:absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-white shadow-sm border rounded-full">
                            {/* Only show delete on desktop hover or handle differently mobile */}
                            <button onClick={() => removeLineItem(index)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {/* Add Item Row */}
                  <div className="px-8 py-3 border-t border-slate-100 bg-slate-50/30">
                    <Button variant="ghost" size="sm" onClick={addLineItem} className="text-primary/70 hover:text-primary hover:bg-primary/5">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Add Line Item
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer / Totals Section */}
            <div className="bg-slate-50 border-t border-slate-100 px-8 py-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Notes & Terms */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
                    <textarea
                      className="w-full min-h-[100px] rounded-lg border-slate-200 bg-white p-3 text-sm focus:border-primary focus:ring-primary/20"
                      placeholder="Add notes for the client..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Valid For (Days)</Label>
                      <input
                        type="number"
                        value={validDays}
                        onChange={e => setValidDays(e.target.value)}
                        className="w-16 rounded border-slate-200 text-center text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Totals Calculation */}
                <div className="space-y-4">
                  <FeatureLock feature="quote.profitMargin">
                    <div className="flex justify-between items-center py-2 px-3 bg-indigo-50/50 border border-indigo-100 rounded-lg group">
                      <div className="flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm text-indigo-900 font-medium">AI Margin Optimizer</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-indigo-400">Target</span>
                        <input className="w-14 h-6 text-xs text-right border-indigo-200 rounded focus:ring-indigo-500 bg-white" placeholder="45%" defaultValue="45%" />
                      </div>
                    </div>
                  </FeatureLock>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-mono text-lg text-slate-700">${subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 group">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Discount</span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-white border rounded">
                        <input
                          type="number"
                          value={discount}
                          onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                          className="w-12 h-6 text-xs text-center border-none focus:ring-0"
                        />
                        <button
                          onClick={() => setDiscountType(discountType === 'fixed' ? 'percent' : 'fixed')}
                          className="px-1 text-xs bg-slate-100 border-l text-slate-500"
                        >
                          {discountType === 'fixed' ? '$' : '%'}
                        </button>
                      </div>
                    </div>
                    <span className="font-mono text-red-500">-${discountAmount.toFixed(2)}</span>
                  </div>

                  {taxLines.map((tl, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 group">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setTaxLines(taxLines.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <input
                          value={tl.name}
                          onChange={e => {
                            const newLines = [...taxLines];
                            newLines[idx].name = e.target.value;
                            setTaxLines(newLines);
                          }}
                          className="text-slate-500 bg-transparent border-none p-0 w-16 focus:ring-0"
                        />
                        <div className="flex items-center text-xs bg-slate-100 rounded px-1.5 py-0.5 ml-1">
                          <input
                            type="number"
                            value={tl.rate}
                            onChange={e => {
                              const newLines = [...taxLines];
                              newLines[idx].rate = parseFloat(e.target.value) || 0;
                              setTaxLines(newLines);
                            }}
                            className="w-8 bg-transparent border-none p-0 text-center focus:ring-0"
                          />
                          %
                        </div>
                      </div>
                      <span className="font-mono text-slate-700">{symbol}{calculatedTaxes[idx].amount.toFixed(2)}</span>
                    </div>
                  ))}

                  <button
                    onClick={() => setTaxLines([...taxLines, { name: 'Tax', rate: 0 }])}
                    className="text-[10px] text-slate-400 hover:text-primary flex items-center gap-1 mt-1"
                  >
                    <Plus className="h-3 w-3" /> Add Tax Line
                  </button>

                  <div className="border-t border-slate-200 my-4"></div>

                  <div className="flex justify-between items-end">
                    <span className="text-xl font-light text-slate-900">Total Estimate</span>
                    <span className="text-4xl font-light tracking-tight text-primary">
                      {formatCurrency(total, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar (Sticky Bottom) */}
            <div className="px-8 py-6 bg-white border-t border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div>
                {signature && (
                  <div className="flex items-center gap-3 bg-green-50 text-green-700 px-4 py-2 rounded-full border border-green-100">
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-medium">Signed by Client</span>
                    <button onClick={() => setSignature(null)} className="ml-2 hover:bg-green-100 p-1 rounded-full"><X className="h-3 w-3" /></button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <FeatureLock feature="pdf.watermark">
                  <div className="flex items-center gap-2 px-2">
                    <Switch id="watermark" />
                    <Label htmlFor="watermark" className="text-xs text-muted-foreground cursor-pointer">Remove branding</Label>
                  </div>
                </FeatureLock>

                {(!signature) && (
                  <FeatureLock feature="eSign">
                    <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex-1 md:flex-none border-dashed bg-blue-50/50 text-blue-700 border-blue-200 hover:bg-blue-100/50 hover:text-blue-800">
                          <PenTool className="h-4 w-4 mr-2" />
                          Request e-Signature
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Sign Quote</DialogTitle></DialogHeader>
                        <SignaturePad onSave={handleSignatureSave} onCancel={() => setIsSignatureDialogOpen(false)} />
                      </DialogContent>
                    </Dialog>
                  </FeatureLock>
                )}

                <FeatureLock feature="quote.visualScope">
                  <Button variant="outline" className="flex-1 md:flex-none">
                    <Eye className="h-4 w-4 mr-2" />
                    Visual Scope
                  </Button>
                </FeatureLock>

                <Button variant="outline" onClick={handleEmailPDF} className="flex-1 md:flex-none">
                  <Mail className="h-4 w-4 mr-2" />
                  Email PDF
                </Button>

                <Button variant="outline" onClick={generatePDF} className="flex-1 md:flex-none">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>

                <Button onClick={saveQuote} disabled={isSaving} className="flex-1 md:flex-none min-w-[140px] shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/90 hover:to-primary">
                  {isSaving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Quote
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

