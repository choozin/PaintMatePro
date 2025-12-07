import React, { useMemo, useRef, useEffect } from "react";
import { Project, ProjectEvent } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ProjectLifecycleBarProps {
    project: Project;
    className?: string;
}

export function ProjectLifecycleBar({ project, className }: ProjectLifecycleBarProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 1. Data Preparation
    const events = useMemo(() => {
        // Start with existing timeline
        const allEvents = [...(project.timeline || [])].map(e => ({
            ...e,
            dateObj: e.date?.toDate ? e.date.toDate() : new Date()
        }));

        // Add implicit Start if missing
        if (!allEvents.some(e => e.type === 'started') && project.startDate) {
            allEvents.push({
                id: 'imp-start', type: 'started', label: 'Started',
                date: project.startDate,
                dateObj: project.startDate.toDate(),
                notes: ''
            });
        }

        // Add implicit Due if missing
        if (!allEvents.some(e => e.type === 'scheduled') && project.estimatedCompletion) {
            allEvents.push({
                id: 'imp-due', type: 'scheduled', label: 'Due',
                date: project.estimatedCompletion,
                dateObj: project.estimatedCompletion.toDate(),
                notes: ''
            });
        }

        // Ensure we have at least "Lead Created" or "Now"
        if (allEvents.length === 0) {
            const now = new Date();
            allEvents.push({
                id: 'init-now', type: 'custom', label: 'New Project',
                dateObj: now, date: null as any
            });
        }

        // Sort ascending
        return allEvents.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    }, [project]);

    // 2. Range Calculation
    const { minTime, maxTime, totalDuration } = useMemo(() => {
        if (events.length === 0) return { minTime: 0, maxTime: 0, totalDuration: 1 };

        let min = events[0].dateObj.getTime();
        let max = events[events.length - 1].dateObj.getTime();

        // If extremely short duration (e.g. same day), add 1 week buffer for visualization
        const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
        if (max - min < ONE_WEEK) {
            max = min + ONE_WEEK;
        }

        return { minTime: min, maxTime: max, totalDuration: max - min };
    }, [events]);

    const getPosition = (date: Date) => {
        const time = date.getTime();
        const percent = Math.max(0, Math.min(100, ((time - minTime) / totalDuration) * 100));
        return percent;
    };

    // 3. Mobile Auto-Center Logic
    useEffect(() => {
        if (scrollContainerRef.current) {
            // Find the "Latest" event logic or "Today" logic
            // For simplicity, center on the last event (current status)
            const container = scrollContainerRef.current;
            const lastDot = container.querySelector('[data-last-event="true"]');
            if (lastDot) {
                const scrollLeft = (lastDot as HTMLElement).offsetLeft - (container.clientWidth / 2) + 10; // +10 for half dot width
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        }
    }, [events]);

    // --- Renderers ---

    return (
        <div className={cn("w-full py-6", className)}>

            {/* DESKTOP VIEW: Absolute Positioning (Hidden on mobile) */}
            <div className="hidden md:block relative h-20 w-full px-4">
                {/* Base Line */}
                <div className="absolute top-8 left-0 w-full h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/20 w-full" />
                </div>

                {events.map((e, i) => {
                    const left = `${getPosition(e.dateObj)}%`;
                    return (
                        <div
                            key={e.id}
                            className="absolute top-8 transform -translate-x-1/2 flex flex-col items-center group"
                            style={{ left }}
                        >
                            {/* Dot */}
                            <div className={cn(
                                "w-3 h-3 rounded-full border-2 border-background z-10 transition-all",
                                i === events.length - 1 ? "bg-primary scale-125" : "bg-muted-foreground"
                            )} />

                            {/* Label (Top) */}
                            <div className="absolute bottom-4 whitespace-nowrap text-xs font-medium text-foreground opacity-70 group-hover:opacity-100 transition-opacity">
                                {e.label}
                            </div>

                            {/* Date (Bottom) */}
                            <div className="absolute top-4 whitespace-nowrap text-[10px] text-muted-foreground">
                                {format(e.dateObj, "MMM d")}
                            </div>
                        </div>
                    );
                })}
            </div>


            {/* MOBILE VIEW: Scrollable Container (Visible on mobile) */}
            {/* "Fade Edge" mask applied via class or style if complex, simple gradient text-color approach not enough for container */}
            <div
                ref={scrollContainerRef}
                className="md:hidden relative w-full overflow-x-auto no-scrollbar"
                style={{
                    maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
                }}
            >
                <div className="flex items-center min-w-[200%] px-[50%] h-32 relative">
                    {/* Timeline Line (Spanning full calculated width) */}
                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-muted -z-10 mx-4" />

                    {events.map((e, i) => {
                        // For mobile, we just flex them out or space them?
                        // User asked for "Relative spacing". 
                        // So we need a container of fixed large width (e.g. 1000px or 300vw) and place absolute dots on THAT.

                        // Let's make the track 3x screen width for enough scroll space
                        return (
                            // We can't map absolute inputs to a flex container easily.
                            // Instead, let's use a single relative container of fixed width.
                            null
                        );
                    })}

                    {/* Re-doing Mobile Render to use Absolute inside Scroll */}
                    <div className="w-[800px] h-full relative mx-auto">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-muted -translate-y-1/2" />

                        {events.map((e, i) => {
                            const left = `${getPosition(e.dateObj)}%`;
                            const isLast = i === events.length - 1;
                            return (
                                <div
                                    key={e.id}
                                    data-last-event={isLast}
                                    className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                                    style={{ left }}
                                >
                                    {/* Label (Rotated 45deg) */}
                                    <div
                                        className="mb-8 origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-medium text-foreground"
                                    >
                                        {e.label}
                                    </div>

                                    {/* Dot */}
                                    <div className={cn(
                                        "w-4 h-4 rounded-full border-2 border-background z-10 transition-all shadow-sm",
                                        isLast ? "bg-primary scale-110" : "bg-muted-foreground"
                                    )} />

                                    {/* Date */}
                                    <div className="mt-8 origin-top-left -rotate-45 whitespace-nowrap text-[10px] text-muted-foreground">
                                        {format(e.dateObj, "M/d")}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                </div>
            </div>

        </div>
    );
}
