import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { CreateClientDialog } from "./CreateClientDialog";
import { Client } from "@/lib/firestore";

interface ClientComboSelectorProps {
    clients: Client[] & { id: string }[]; // Ensure clients have IDs
    value: string;
    onChange: (value: string) => void;
}

export function ClientComboSelector({ clients, value, onChange }: ClientComboSelectorProps) {
    const [open, setOpen] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [search, setSearch] = useState("");

    const selectedClient = clients.find((client) => client.id === value);

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                        data-testid="combo-client-trigger"
                    >
                        {value
                            ? clients.find((client) => client.id === value)?.name
                            : "Select a Lead or Client"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                        <CommandInput
                            placeholder="Search leads..."
                            value={search}
                            onValueChange={setSearch}
                            data-testid="combo-client-input"
                        />
                        <CommandList>
                            <CommandEmpty>
                                <div className="p-2">
                                    <p className="text-sm text-muted-foreground mb-2">No lead found.</p>
                                    <Button
                                        variant="ghost"
                                        className="w-full justify-start h-8 font-normal text-primary"
                                        onClick={() => {
                                            setCreateDialogOpen(true);
                                            setOpen(false);
                                        }}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create "{search}"
                                    </Button>
                                </div>
                            </CommandEmpty>
                            <CommandGroup>
                                {clients.map((client: any) => (
                                    <CommandItem
                                        key={client.id}
                                        value={client.name}
                                        onSelect={() => {
                                            onChange(client.id);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === client.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {client.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            <CommandGroup className="border-t pt-1 mt-1">
                                <CommandItem
                                    value="create-new-lead-action"
                                    onSelect={() => {
                                        setCreateDialogOpen(true);
                                        setOpen(false);
                                    }}
                                    className="text-primary font-medium cursor-pointer"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add New Lead
                                </CommandItem>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <CreateClientDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                initialName={search}
                onSuccess={(newClientId) => {
                    onChange(newClientId);
                }}
            />
        </>
    );
}
