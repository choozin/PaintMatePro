import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Briefcase } from "lucide-react";
import { useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import { Timestamp } from "firebase/firestore";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type ViewMode = 'week' | 'month';

export function CrewScheduler() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const { data: projects = [], isLoading } = useProjects();
  const [, setLocation] = useLocation();

  const daysHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Helper: Get start of date's week (Sunday)
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 is Sunday
    const diff = d.getDate() - day; // subtract day index to get to Sunday (0)
    return new Date(d.setDate(diff));
  };

  // Helper: Get start of date's month
  const getStartOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  };

  // 1. Generate Calendar Dates Flattened
  const getFlattenedDates = () => {
    if (viewMode === 'week') {
      const start = getStartOfWeek(currentDate);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    } else {
      const startOfMonth = getStartOfMonth(currentDate);
      const startGrid = getStartOfWeek(startOfMonth);

      // Calculate how many weeks we need
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const endGrid = new Date(endOfMonth);
      // Adjust endGrid to end of that week
      const endDay = endGrid.getDay();
      endGrid.setDate(endGrid.getDate() + (6 - endDay));

      const totalDays = Math.ceil((endGrid.getTime() - startGrid.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      return Array.from({ length: totalDays }, (_, i) => {
        const d = new Date(startGrid);
        d.setDate(startGrid.getDate() + i);
        return d;
      });
    }
  };

  // 2. Group into Weeks
  const flattenedDates = getFlattenedDates();
  const weeks: Date[][] = [];
  for (let i = 0; i < flattenedDates.length; i += 7) {
    weeks.push(flattenedDates.slice(i, i + 7));
  }

  // 3. Status Colors Map
  const statusColors: Record<string, string> = {
    lead: "bg-blue-100 text-blue-800 border-blue-200",
    quoted: "bg-purple-100 text-purple-800 border-purple-200",
    booked: "bg-indigo-100 text-indigo-800 border-indigo-200",
    "in-progress": "bg-emerald-100 text-emerald-800 border-emerald-200",
    paused: "bg-amber-100 text-amber-800 border-amber-200",
    completed: "bg-slate-100 text-slate-600 border-slate-200 line-through decoration-slate-400",
    invoiced: "bg-yellow-50 text-yellow-700 border-yellow-200",
    paid: "bg-green-50 text-green-700 border-green-200 opacity-60",
    "on-hold": "bg-gray-100 text-gray-800 border-gray-200",
    pending: "bg-gray-50 text-gray-500 border-gray-100",
  };

  // Helper: Standardize date input to Date object
  const toDate = (input: any): Date => {
    if (!input) return new Date();
    if (typeof input.toDate === 'function') return input.toDate();
    return new Date(input);
  };

  // 4. Ribbon Layout Engine
  const getLayoutForWeek = (weekDates: Date[]) => {
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];

    // Normalize to midnight for comparison
    const sTime = new Date(weekStart).setHours(0, 0, 0, 0);
    const eTime = new Date(weekEnd).setHours(23, 59, 59, 999);

    // Filter projects touching this week
    const relevantProjects = projects.filter(p => {
      if (!p.startDate) return false;

      const pStart = toDate(p.startDate);
      // Default end to +3 days if missing
      const pEnd = p.estimatedCompletion
        ? toDate(p.estimatedCompletion)
        : new Date(pStart.getTime() + (3 * 86400000));

      const pSTime = pStart.setHours(0, 0, 0, 0);
      const pETime = pEnd.setHours(23, 59, 59, 999);

      return pSTime <= eTime && pETime >= sTime;
    });

    // Sort by start date, then duration (longer first for better packing)
    relevantProjects.sort((a, b) => {
      const aStart = toDate(a.startDate);
      const bStart = toDate(b.startDate);
      return aStart.getTime() - bStart.getTime();
    });

    // Assign tracks
    // Simple greedy packing: for each project, pick first available track
    const items: Array<{
      project: any,
      startDayIdx: number,
      duration: number,
      isStart: boolean,
      isEnd: boolean,
      trackIndex: number
    }> = [];

    // Tracks state: trackIndex -> occupiedUntilDayIdx
    const tracks: number[] = [];

    relevantProjects.forEach((project: any) => {
      const pStart = toDate(project.startDate);
      const pEnd = project.estimatedCompletion
        ? toDate(project.estimatedCompletion)
        : new Date(pStart.getTime() + (3 * 86400000));

      // Clamp to this week
      // Calculate 0-6 index
      // Start Index: if pStart < weekStart, then 0. Else (pStart - weekStart) in days
      let startIdx = 0;
      let isStart = false;
      if (pStart < weekStart) {
        startIdx = 0;
        isStart = false; // Continues from prev week
      } else {
        const diff = Math.floor((pStart.getTime() - weekStart.getTime()) / 86400000); // approx
        startIdx = Math.max(0, diff); // safety
        isStart = true;
      }

      // End Index
      let endIdx = 6;
      let isEnd = false;
      if (pEnd > weekEnd) {
        endIdx = 6;
        isEnd = false; // Continues to next week
      } else {
        // Calculate diff
        const diff = Math.floor((pEnd.getTime() - weekStart.getTime()) / 86400000);
        endIdx = Math.min(6, diff);
        isEnd = true;
      }

      const duration = endIdx - startIdx + 1;
      if (duration <= 0) return; // Should not happen given filter

      // Find Track
      // We need to know which tracks are free during [startIdx, endIdx]
      // Actually, simplified greedy for "Ribbons" usually just needs to clear previous items on the same track.

      let assignedTrack = 0;
      while (true) {
        // Check collision with existing items on this track
        const collision = items.find((item: any) =>
          item.trackIndex === assignedTrack &&
          !(item.startDayIdx + item.duration <= startIdx || item.startDayIdx >= startIdx + duration)
        );

        if (!collision) {
          break; // Found free track
        }
        assignedTrack++;
      }

      items.push({
        project,
        startDayIdx: startIdx,
        duration,
        isStart,
        isEnd,
        trackIndex: assignedTrack
      });
    });

    return { items, maxTrack: Math.max(...items.map(i => i.trackIndex), 0) };
  };

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getProjectsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return projects.filter(p => {
      if (!p.startDate) return false;
      let start: Date;
      if (p.startDate && typeof (p.startDate as any).toDate === 'function') {
        start = (p.startDate as any).toDate();
      } else {
        start = new Date(p.startDate as any);
      }

      let end: Date;
      if (p.estimatedCompletion) {
        if (typeof (p.estimatedCompletion as any).toDate === 'function') {
          end = (p.estimatedCompletion as any).toDate();
        } else {
          end = new Date(p.estimatedCompletion as any);
        }
      } else {
        end = new Date(start.getTime() + (3 * 24 * 60 * 60 * 1000));
      }

      const pStartStr = start.toISOString().split('T')[0];
      const pEndStr = end.toISOString().split('T')[0];

      return dateStr >= pStartStr && dateStr <= pEndStr;
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading schedule...</div>;
  }

  // Helper: Get status for a specific date based on timeline
  const getStatusForDate = (project: any, targetDate: Date) => {
    let currentStatus = project.status; // Default to current global status? Or initial status?
    // Actually, we should replay history to find status at that date.
    // If no timeline, use project.status.
    if (!project.timeline || project.timeline.length === 0) return project.status;

    // Timeline must be sorted by date ascending for replay
    const sortedEvents = [...project.timeline].sort((a: any, b: any) => {
      return (a.date?.seconds || 0) - (b.date?.seconds || 0);
    });

    // Find the last event that occurred before or on targetDate
    // Set targetDate to end of day to include events on that day? 
    // Usually status changes happen at specific times. Let's just compare dates.
    const targetTime = targetDate.getTime();

    // Default to 'lead' or 'booked' if before any events? 
    // Let's assume project.status is the *current* final status.
    // We want the status *at that time*.

    let activeStatus = 'lead'; // Default to lead if no events found

    for (const event of sortedEvents) {
      const eDate = toDate(event.date);
      if (eDate.getTime() <= targetTime + 86400000) { // Include events on the same day roughly
        if (event.type === 'lead_created') activeStatus = 'lead';
        if (event.type === 'quote_provided') activeStatus = 'quoted';
        if (event.type === 'quote_accepted') activeStatus = 'booked';
        if (event.type === 'started' || event.type === 'resumed') activeStatus = 'in-progress';
        if (event.type === 'paused') activeStatus = 'paused';
        if (event.type === 'finished') activeStatus = 'completed';
        if (event.type === 'invoice_issued') activeStatus = 'invoiced';
        if (event.type === 'payment_received') activeStatus = 'paid';
      }
    }

    // If it's on the schedule (has a date) but hasn't started yet, treat as "Scheduled" (booked)
    // even if it's technically just a Lead or Quoted.
    if (activeStatus === 'lead' || activeStatus === 'quoted') {
      activeStatus = 'booked';
    }

    return activeStatus;
  };



  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          <h2 className="text-2xl font-semibold">Project Schedule</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-md transition-all",
                viewMode === 'week' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-md transition-all",
                viewMode === 'month' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Month
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate('prev')} data-testid="button-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {viewMode === 'week'
                ? `Week of ${getStartOfWeek(currentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              }
            </span>
            <Button variant="outline" size="icon" onClick={() => navigate('next')} data-testid="button-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 select-none">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 border-b bg-muted/40 text-muted-foreground">
            {daysHeaders.map((day) => (
              <div key={day} className="py-2 text-center text-xs font-semibold uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Body */}
          <div className="border-l border-b">
            {weeks.map((week, weekIndex) => {
              // Calculate layout for this week
              const { items } = getLayoutForWeek(week);

              return (
                <div key={weekIndex} className="relative min-h-[120px] bg-background border-b hover:bg-muted/5 transition-colors group/week">
                  {/* Grid Lines (Background) */}
                  <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                    {week.map((date, dayIdx) => (
                      <div
                        key={dayIdx}
                        className={cn(
                          "border-r h-full transition-colors",
                          isToday(date) ? "bg-blue-50/40" : "",
                          viewMode === 'month' && !isCurrentMonth(date) ? "bg-muted/10 border-r-muted/50" : ""
                        )}
                      />
                    ))}
                  </div>

                  {/* Day Numbers Layer */}
                  <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                    {week.map((date, dayIdx) => (
                      <div key={dayIdx} className="p-2">
                        <span
                          className={cn(
                            "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                            isToday(date)
                              ? "bg-blue-600 text-white shadow-sm"
                              : viewMode === 'month' && !isCurrentMonth(date)
                                ? "text-muted-foreground/50"
                                : "text-muted-foreground group-hover/week:text-foreground"
                          )}
                        >
                          {date.getDate()}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Ribbon Layer */}
                  <div className="relative pt-10 pb-2 px-1 grid grid-cols-7 gap-y-1">
                    {items.map((item) => {
                      const projectDaysInWeek = Array.from({ length: item.duration }, (_, i) => {
                        const d = new Date(week[0]);
                        d.setDate(d.getDate() + item.startDayIdx + i);
                        return d;
                      });

                      const isHovered = hoveredProjectId === item.project.id;

                      return (
                        <div
                          key={`${item.project.id}-${weekIndex}`}
                          onMouseEnter={() => setHoveredProjectId(item.project.id)}
                          onMouseLeave={() => setHoveredProjectId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/projects/${item.project.id}`);
                          }}
                          className={cn(
                            "cursor-pointer relative h-10 transition-all duration-200",
                            isHovered ? "shadow-xl -translate-y-[2px] z-20" : "shadow-md", // Global hover effect
                            item.isStart ? "ml-1" : "-ml-1",
                            item.isEnd ? "mr-1" : "-mr-1",
                          )}
                          style={{
                            gridColumnStart: item.startDayIdx + 1,
                            gridColumnEnd: `span ${item.duration}`,
                            gridRow: item.trackIndex + 1,
                          }}
                          title={`${item.project.name} (${item.project.status})`}
                        >
                          {/* Segmented Background Layer */}
                          <div className="absolute inset-0 flex rounded-md overflow-hidden">
                            {projectDaysInWeek.map((dayDate, i) => {
                              const status = getStatusForDate(item.project, dayDate);
                              const colorClass = statusColors[status] || "bg-gray-100 border-gray-200";

                              const dayStart = new Date(dayDate).setHours(0, 0, 0, 0);
                              const dayEnd = new Date(dayDate).setHours(23, 59, 59, 999);

                              const eventsOnDay = item.project.timeline?.filter((e: any) => {
                                const eTime = toDate(e.date).getTime();
                                return eTime >= dayStart && eTime <= dayEnd;
                              }) || [];

                              const labelEvent = eventsOnDay.find((e: any) =>
                                ['paused', 'resumed', 'started', 'finished', 'completed'].includes(e.type)
                              ) || eventsOnDay[0];

                              return (
                                <div
                                  key={i}
                                  className={cn(
                                    "flex-1 h-full border-y border-r first:border-l relative group/segment",
                                    colorClass,
                                    "border-r-black/5"
                                  )}
                                  title={labelEvent ? `${labelEvent.label} (${status})` : status}
                                >
                                  {labelEvent && (
                                    <span className="absolute left-1.5 top-0.5 text-[9px] font-bold uppercase tracking-tight opacity-90 truncate max-w-[150%] z-10 text-foreground/80 pointer-events-none">
                                      {labelEvent.label}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Main Project Label Layer */}
                          {/* Always visible at the start of the ribbon segment (each row) */}
                          {/* Standardized padding: pl-1.5 to match the event label's left-1.5 */}
                          <div className="absolute inset-0 flex items-end px-0 py-1 pointer-events-none">
                            <span className="text-xs font-bold truncate leading-tight drop-shadow-sm text-foreground/90 pl-1.5">
                              {item.project.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
