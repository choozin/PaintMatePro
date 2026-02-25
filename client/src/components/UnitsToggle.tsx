import React from 'react';
import { useUnits } from '@/hooks/useUnits';
import { Button } from '@/components/ui/button';
import { Ruler } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UnitsToggle() {
    const { units, setUnits } = useUnits();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                    <Ruler className="h-4 w-4" />
                    <span className="sr-only">Toggle Units</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    onClick={() => setUnits('imperial')}
                    className={units === 'imperial' ? 'bg-accent' : ''}
                >
                    Imperial (ft, sq ft, gal)
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setUnits('metric')}
                    className={units === 'metric' ? 'bg-accent' : ''}
                >
                    Metric (m, sqm, L)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
