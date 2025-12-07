import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit2, Package } from 'lucide-react';
import { SupplyRule, CatalogItem } from '@/lib/firestore';
import { useCatalog } from '@/hooks/useCatalog';
import { DEFAULT_SUPPLY_RULES } from '@/lib/defaultRules';

interface SupplyRulesEditorProps {
    rules: SupplyRule[];
    onChange: (rules: SupplyRule[]) => void;
    disabled?: boolean;
}

export function SupplyRulesEditor({ rules, onChange, disabled }: SupplyRulesEditorProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<SupplyRule | null>(null);
    const { items: catalogItems } = useCatalog();

    // Form State
    const [name, setName] = useState('');
    const [category, setCategory] = useState('Application');
    const [unit, setUnit] = useState('each');
    const [unitPrice, setUnitPrice] = useState(0);
    const [condition, setCondition] = useState<SupplyRule['condition']>('always');
    const [quantityType, setQuantityType] = useState<SupplyRule['quantityType']>('fixed');
    const [quantityBase, setQuantityBase] = useState(1);

    const resetForm = () => {
        setName('');
        setCategory('Application');
        setUnit('each');
        setUnitPrice(0);
        setCondition('always');
        setQuantityType('fixed');
        setQuantityBase(1);
        setEditingRule(null);
    };

    const handleLoadDefaults = () => {
        if (rules.length > 0) {
            if (!confirm("This will overwrite your existing rules with the system defaults. Are you sure?")) {
                return;
            }
        }
        // Generate new IDs to avoid conflicts if added multiple times (though we overwrite here)
        const newRules = DEFAULT_SUPPLY_RULES.map(r => ({ ...r, id: crypto.randomUUID() }));
        onChange(newRules);
    };

    const handleEdit = (rule: SupplyRule) => {
        setEditingRule(rule);
        setName(rule.name);
        setCategory(rule.category);
        setUnit(rule.unit);
        setUnitPrice(rule.unitPrice);
        setCondition(rule.condition);
        setQuantityType(rule.quantityType);
        setQuantityBase(rule.quantityBase);
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        onChange(rules.filter(r => r.id !== id));
    };

    const handleSave = () => {
        const newRule: SupplyRule = {
            id: editingRule ? editingRule.id : crypto.randomUUID(),
            name,
            category,
            unit,
            unitPrice,
            condition,
            quantityType,
            quantityBase
        };

        if (editingRule) {
            onChange(rules.map(r => r.id === editingRule.id ? newRule : r));
        } else {
            onChange([...rules, newRule]);
        }
        setIsDialogOpen(false);
        resetForm();
    };

    const handleCatalogSelect = (itemId: string) => {
        const item = catalogItems.find(i => i.id === itemId);
        if (item) {
            setName(item.name);
            setCategory(item.category);
            setUnit(item.unit);
            setUnitPrice(item.unitPrice);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Supply Generation Rules</h3>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleLoadDefaults} disabled={disabled}>
                        <Package className="h-4 w-4 mr-2" /> Load Defaults
                    </Button>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) resetForm();
                    }}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline" disabled={disabled}>
                                <Plus className="h-4 w-4 mr-2" /> Add Rule
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Supply Rule'}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label>Item Source</Label>
                                    <Select onValueChange={handleCatalogSelect}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select from Catalog (Optional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {catalogItems.map(item => (
                                                <SelectItem key={item.id} value={item.id || ''}>{item.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Name</Label>
                                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Item Name" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Category</Label>
                                        <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Category" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Unit</Label>
                                        <Input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit (e.g. each, pack)" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Unit Price ($)</Label>
                                        <Input type="number" value={unitPrice} onChange={e => setUnitPrice(parseFloat(e.target.value))} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Condition</Label>
                                    <Select value={condition} onValueChange={(v: any) => setCondition(v)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="always">Always Include</SelectItem>
                                            <SelectItem value="if_ceiling">If Ceiling Included</SelectItem>
                                            <SelectItem value="if_trim">If Trim Included</SelectItem>
                                            <SelectItem value="if_primer">If Primer Included</SelectItem>
                                            <SelectItem value="if_floor_area">If Floor Area &gt; 0</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Quantity Logic</Label>
                                        <Select value={quantityType} onValueChange={(v: any) => setQuantityType(v)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fixed">Fixed Quantity</SelectItem>
                                                <SelectItem value="per_sqft_wall">Per Sq Ft (Wall)</SelectItem>
                                                <SelectItem value="per_sqft_floor">Per Sq Ft (Floor)</SelectItem>
                                                <SelectItem value="per_gallon_total">Per Gallon (Total)</SelectItem>
                                                <SelectItem value="per_gallon_primer">Per Gallon (Primer)</SelectItem>
                                                <SelectItem value="per_linear_ft_perimeter">Per Linear Ft</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>
                                            {quantityType === 'fixed' ? 'Quantity' : `1 Item per X ${quantityType === 'per_gallon_total' ? 'Gallons' : 'Units'}`}
                                        </Label>
                                        <Input type="number" value={quantityBase} onChange={e => setQuantityBase(parseFloat(e.target.value))} />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleSave} disabled={!name}>Save Rule</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Condition</TableHead>
                            <TableHead>Quantity Rule</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                    No rules defined. Default logic will be used.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rules.map(rule => (
                                <TableRow key={rule.id}>
                                    <TableCell>
                                        <div className="font-medium">{rule.name}</div>
                                        <div className="text-xs text-muted-foreground">{rule.category} • ${rule.unitPrice}/{rule.unit}</div>
                                    </TableCell>
                                    <TableCell className="capitalize">{rule.condition.replace(/_/g, ' ')}</TableCell>
                                    <TableCell>
                                        {rule.quantityType === 'fixed'
                                            ? `${rule.quantityBase} (Fixed)`
                                            : `1 per ${rule.quantityBase} ${rule.quantityType.split('_').pop()}`}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)} disabled={disabled}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)} disabled={disabled}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
