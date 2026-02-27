import React from 'react';
import { Lock } from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { cn } from '@/lib/utils';

interface FeatureLockProps {
    feature: string;
    teaseMessage?: string;
    className?: string;
    children: React.ReactNode;
}

export function FeatureLock({
    feature,
    teaseMessage = 'Unlock by upgrading your account.',
    className,
    children,
}: FeatureLockProps) {
    const { hasFeature } = useEntitlements();

    // If they have the feature, render children normally
    if (hasFeature(feature)) {
        return <>{children}</>;
    }

    // If they do NOT have the feature, render the protected content with a frosted overlay and tooltip
    return (
        <div
            className={cn('relative group overflow-hidden rounded-md cursor-not-allowed', className)}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
            {/* The protected content (less blurred and faded for visibility) */}
            <div className="opacity-60 blur-[1px] select-none pointer-events-none transition-all duration-300">
                {children}
            </div>

            {/* Centered expanding pill overlay on hover/tap */}
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-slate-900 dark:text-slate-100 p-2.5 rounded-full shadow-lg border border-slate-200/60 dark:border-slate-800/60 flex items-center transition-all duration-300 opacity-80 group-hover:opacity-100 group-hover:scale-105">
                    <Lock className="h-4 w-4 text-slate-500 dark:text-slate-400 transition-all duration-300 group-hover:mr-2 group-hover:text-slate-800 dark:group-hover:text-slate-200" />
                    <span className="font-medium text-sm max-w-0 overflow-hidden opacity-0 group-hover:max-w-xs group-hover:opacity-100 transition-all duration-500 whitespace-nowrap">
                        {teaseMessage}
                    </span>
                </div>
            </div>
        </div>
    );
}
