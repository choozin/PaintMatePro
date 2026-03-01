import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Briefcase, Clock, Lock } from "lucide-react";
import { useState, useEffect } from "react";
import { useProjects } from "@/hooks/useProjects";
import { Timestamp } from "firebase/firestore";
import { useLocation } from "wouter";
import { cn, getContrastColor } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Crew, crewOperations, employeeOperations, Project, ProjectStatus } from "@/lib/firestore";
import { QuickAddDialog } from "./QuickAddDialog";
import { TaskDetailsDialog } from "./TaskDetailsDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasPermission } from "@/lib/permissions";

import { Users } from "lucide-react";
import { CREW_PALETTES, PAUSE_STYLE } from "@/lib/crew-palettes";
import { format } from "date-fns";

type ViewMode = 'week' | 'month' | 'day';

export function CrewScheduler() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const { data: projects = [], isLoading } = useProjects();
  const [, setLocation] = useLocation();
  const { currentOrgId, org, claims, user, currentPermissions } = useAuth();
  const enableTeam = org?.enableTeamFeatures !== false; // Default true

  // PERMISSION CHECK: Use granular permission instead of role check
  const canManageSchedule = hasPermission(currentPermissions, 'manage_schedule') ||
    claims?.globalRole === 'platform_owner' ||
    claims?.globalRole === 'platform_admin';

  const [selectedCrewId, setSelectedCrewId] = useState<string>("all");

  const { data: crews = [] } = useQuery({
    queryKey: ['crews', currentOrgId],
    queryFn: () => currentOrgId ? crewOperations.getByOrg(currentOrgId) : Promise.resolve([]),
    enabled: !!currentOrgId && enableTeam
  });

  // Self-Correction for Field Workers:
  // If user cannot manage schedule, force select their assigned crew
  useQuery({
    queryKey: ['myEmployeeRecord', user?.uid],
    queryFn: async () => {
      if (!user?.email || !currentOrgId) return null;
      const employees = await employeeOperations.getByOrg(currentOrgId);
      // Find employee by email - simplistic but works for now. Ideally userId link.
      const me = employees.find(e => e.email === user.email);
      if (me && !canManageSchedule) {
        // Find crew this employee belongs to
        const myCrew = crews.find(c => c.memberIds?.includes(me.id));
        if (myCrew) {
          setSelectedCrewId(myCrew.id);
        } else {
          // Determine if we should show "Unassigned" or empty
          setSelectedCrewId("mine_only");
        }
      }
      return me;
    },
    enabled: !!user && !!currentOrgId && !canManageSchedule && crews.length > 0
  });

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
    if (viewMode === 'day') return [currentDate]; // Not used for day view but safe fallback
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
  if (viewMode !== 'day') {
    for (let i = 0; i < flattenedDates.length; i += 7) {
      weeks.push(flattenedDates.slice(i, i + 7));
    }
  }

  // 3. Status Colors Map
  const statusColors: Record<string, string> = {
    new: "bg-teal-100 text-teal-800 border-teal-200",
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

    // Filter projects touching this week AND match crew filter
    const relevantProjects = projects.filter(p => {
      // Role & Filter Check
      if (enableTeam && selectedCrewId !== "all") {
        // If specific crew selected (or forced)
        if (p.assignedCrewId !== selectedCrewId) return false;
      }
      // If "mine_only" and no crew found, maybe logic to show nothing or unassigned? 
      // For now, simplify: if "mine_only", effectively shows nothing unless logic improved to find individual assigns.
      if (selectedCrewId === 'mine_only') return false;

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
    const items: Array<{
      project: any,
      startDayIdx: number,
      duration: number,
      isStart: boolean,
      isEnd: boolean,
      trackIndex: number,
      isIndefinite: boolean,
      isSingleDay: boolean,
      startTimeDisplay?: string
    }> = [];

    // Tracks state: trackIndex -> occupiedUntilDayIdx
    const tracks: number[] = [];

    relevantProjects.forEach((project: any) => {
      const pStart = toDate(project.startDate);
      const pEnd = project.estimatedCompletion
        ? toDate(project.estimatedCompletion)
        : new Date(pStart.getTime() + (3 * 86400000));

      const isIndefinite = !project.estimatedCompletion;

      // Determine Single Day status (Start and End on same calendar day)
      const isSingleDay = pStart.toDateString() === pEnd.toDateString();

      // Format Time if available (and not 00:00)
      let startTimeDisplay = undefined;
      if (pStart.getHours() !== 0 || pStart.getMinutes() !== 0) {
        startTimeDisplay = pStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }

      // Clamp to this week
      // Calculate 0-6 index
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
        const diff = Math.floor((pEnd.getTime() - weekStart.getTime()) / 86400000);
        endIdx = Math.min(6, diff);
        isEnd = true;
      }

      const duration = endIdx - startIdx + 1;
      if (duration <= 0) return; // Should not happen given filter

      // Find Track
      // We need to know which tracks are free during [startIdx, endIdx]
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
        trackIndex: assignedTrack,
        isIndefinite,
        isSingleDay,
        startTimeDisplay
      });
    });


    return { items, maxTrack: Math.max(...items.map(i => i.trackIndex), 0) };
  };

  const navigate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setViewMode('day');
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isWeekend = (date: Date) => {
    const d = date.getDay();
    return d === 0 || d === 6; // Sun or Sat
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

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

    // Check for explicit pauses in the pauses array
    if (project.pauses) {
      const tTime = targetDate.setHours(12, 0, 0, 0); // compare mid-day
      for (const pause of project.pauses) {
        const pStart = toDate(pause.startDate).setHours(0, 0, 0, 0);
        const pEnd = pause.endDate ? toDate(pause.endDate).setHours(23, 59, 59, 999) : pStart + 86400000; // default 1 day if fallback
        if (tTime >= pStart && tTime <= pEnd) {
          return 'paused';
        }
      }
    }
    return activeStatus;
  };

  /* --- DAY VIEW RENDERER --- */
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState("");

  // Task Details
  const [selectedTask, setSelectedTask] = useState<Project | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleTimeSlotClick = (date: Date, hour: number) => {
    if (!canManageSchedule) return;
    const targetDate = new Date(date);
    // Convert to simplified YYYY-MM-DD for the form
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    setQuickAddDate(dateStr);
    setQuickAddOpen(true);
  };

  const handleItemClick = (e: React.MouseEvent, item: Project) => {
    e.stopPropagation();
    if (!item.type || item.type === 'project') {
      setLocation(`/projects/${item.id}`);
    } else {
      setSelectedTask(item);
      setDetailsOpen(true);
    }
  };

  const renderDayView = () => {
    // Filter items for this day
    const dayStart = new Date(currentDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(currentDate); dayEnd.setHours(23, 59, 59, 999);

    const items = projects.filter(p => {
      if (enableTeam && selectedCrewId !== "all" && p.assignedCrewId !== selectedCrewId) return false;
      if (!p.startDate) return false;
      const pStart = toDate(p.startDate);
      const pEnd = p.estimatedCompletion ? toDate(p.estimatedCompletion) : new Date(pStart.getTime() + 3 * 86400000);
      return pStart <= dayEnd && pEnd >= dayStart;
    });

    // Split into "All Day" vs "Time Specific"
    const allDayItems = items.filter(p => {
      const pStart = toDate(p.startDate);
      const pEnd = p.estimatedCompletion ? toDate(p.estimatedCompletion) : pStart;

      const isStartDay = pStart.toDateString() === currentDate.toDateString();
      const hasSpecificTime = pStart.getHours() !== 0 || pStart.getMinutes() !== 0;

      // If it doesn't have a specific time, it's always all-day.
      if (!hasSpecificTime) return true;

      // If it HAS a specific time, but it's a multi-day task,
      // and we are NOT on the start day, show it as all-day. It spans multiple days.
      if (!isStartDay) return true;

      // If we ARE on the start day, and it has a specific time, show in hourly grid.
      return false;
    });

    const timedItems = items.filter(p => !allDayItems.includes(p));
    timedItems.sort((a, b) => toDate(a.startDate).getTime() - toDate(b.startDate).getTime());

    const hours = Array.from({ length: 14 }, (_, i) => i + 6); // 6am to 7pm

    return (
      <>
        <Card>
          <CardContent className="p-0 min-h-[600px] flex flex-col">
            {/* Header All Day Section */}
            {allDayItems.length > 0 && (
              <div className="p-4 border-b bg-muted/20">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">All Day / Multi-Day</h3>
                <div className="space-y-2">
                  {allDayItems.map(p => (
                    <div key={p.id} onClick={(e) => handleItemClick(e, p)} className={cn("p-2 rounded border cursor-pointer hover:shadow-md transition-all flex items-center justify-between", statusColors[getStatusForDate(p, currentDate)] || "bg-white")}>
                      <span className="font-medium text-sm">{p.name}</span>
                      {p.assignedCrewId && enableTeam && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: crews.find(c => c.id === p.assignedCrewId)?.color || '#ccc' }} />
                          <span className="text-xs text-muted-foreground">{crews.find(c => c.id === p.assignedCrewId)?.name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hourly Grid (6am to 7pm = 13 hours total) */}
            <div className="flex-1 flex overflow-y-auto">
              {/* Time Labels Sidebar */}
              <div className="w-16 flex-shrink-0 border-r bg-muted/5">
                {hours.map(hour => (
                  <div key={hour} className="h-[60px] text-right pr-4 py-2 text-xs text-muted-foreground font-medium relative">
                    <span className="absolute right-3 -translate-y-1/2 bg-muted/5 px-1 rounded-sm">
                      {hour > 12 ? `${hour - 12} PM` : hour === 12 ? `12 PM` : `${hour} AM`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day Track (Relative Container) */}
              <div className="flex-1 relative min-h-[780px]"> {/* 13 hours * 60px */}

                {/* Horizontal Grid Lines */}
                {hours.map((hour, idx) => (
                  <div
                    key={hour}
                    className="absolute w-full border-t border-muted/50 pointer-events-none"
                    style={{ top: `${(idx / 13) * 100}%` }}
                    onClick={() => handleTimeSlotClick(currentDate, hour)}
                  />
                ))}

                {/* Clickable Background for Empty Slots */}
                <div
                  className="absolute inset-0 z-0 grid"
                  style={{ gridTemplateRows: 'repeat(13, 1fr)' }}
                >
                  {hours.map(hour => (
                    <div
                      key={hour}
                      className={cn("w-full transition-colors", canManageSchedule ? "cursor-pointer hover:bg-muted/10" : "")}
                      onClick={() => handleTimeSlotClick(currentDate, hour)}
                      title={canManageSchedule ? "Click to add item" : ""}
                    />
                  ))}
                </div>

                {/* Render Events */}
                {(() => {
                  // 1. Filter and compute actual render bounds
                  const renderableItems = timedItems.map(p => {
                    const pStart = toDate(p.startDate);
                    const pEnd = p.estimatedCompletion ? toDate(p.estimatedCompletion) : new Date(pStart.getTime() + 60 * 60 * 1000);

                    const renderStart = new Date(currentDate);
                    renderStart.setHours(6, 0, 0, 0);
                    const renderEnd = new Date(currentDate);
                    renderEnd.setHours(19, 0, 0, 0);

                    let actualStart = pStart < renderStart ? renderStart : pStart;
                    let actualEnd = pEnd > renderEnd ? renderEnd : pEnd;

                    return { p, actualStart, actualEnd };
                  }).filter(item => !(item.actualEnd <= item.actualStart)); // Filter out things outside the window

                  // 2. Sort by start time, then by end time (longest first)
                  renderableItems.sort((a, b) => {
                    const diff = a.actualStart.getTime() - b.actualStart.getTime();
                    if (diff !== 0) return diff;
                    return b.actualEnd.getTime() - a.actualEnd.getTime();
                  });

                  // 3. Calculate Layout Columns (Google Calendar style)
                  type RenderableItem = typeof renderableItems[0];
                  type LayoutItem = RenderableItem & { column?: number; totalColumns?: number };

                  const layoutItems: LayoutItem[] = [];
                  let columns: LayoutItem[][] = [];
                  let lastEventEnding: Date | null = null;

                  for (let i = 0; i < renderableItems.length; i++) {
                    const ev = renderableItems[i] as LayoutItem;

                    // If this event starts after ALL previous events in the group have ended, start a new group
                    if (lastEventEnding !== null && ev.actualStart >= lastEventEnding) {
                      // Apply totalColumns to previous group
                      columns.forEach(col => col.forEach(e => e.totalColumns = columns.length));
                      columns = [];
                      lastEventEnding = null;
                    }

                    // Find first available column
                    let placed = false;
                    for (let c = 0; c < columns.length; c++) {
                      const lastColEvent = columns[c][columns[c].length - 1];
                      if (ev.actualStart >= lastColEvent.actualEnd) {
                        columns[c].push(ev);
                        ev.column = c;
                        placed = true;
                        break;
                      }
                    }

                    // If no column available, create a new one
                    if (!placed) {
                      columns.push([ev]);
                      ev.column = columns.length - 1;
                    }

                    if (lastEventEnding === null || ev.actualEnd > lastEventEnding) {
                      lastEventEnding = ev.actualEnd;
                    }

                    layoutItems.push(ev);
                  }
                  // Apply totalColumns to final group
                  columns.forEach(col => col.forEach(e => e.totalColumns = columns.length));

                  // 4. Render
                  return layoutItems.map(({ p, actualStart, actualEnd, column = 0, totalColumns = 1 }) => {
                    const startHourOffset = actualStart.getHours() + (actualStart.getMinutes() / 60) - 6;
                    const topPercent = (startHourOffset / 13) * 100;

                    const durationHours = (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60);
                    const heightPercent = (durationHours / 13) * 100;

                    // Width & Left based on columns
                    const widthPercent = (100 / totalColumns) * 0.95; // 95% to leave a tiny gap
                    const leftPercentOffset = (column / totalColumns) * 100;

                    return (
                      <div
                        key={p.id}
                        onClick={(e) => handleItemClick(e, p)}
                        className={cn(
                          "absolute rounded p-2 text-xs border cursor-pointer hover:scale-[1.01] hover:z-20 transition-all shadow-sm z-10 flex flex-col overflow-hidden",
                          (p.assignedCrewId && crews.find(c => c.id === p.assignedCrewId)?.paletteId)
                            ? CREW_PALETTES.find(palette => palette.id === crews.find(c => c.id === p.assignedCrewId)?.paletteId)?.class
                            : statusColors[getStatusForDate(p, currentDate)]
                        )}
                        style={{
                          top: `${topPercent}%`,
                          height: `${heightPercent}%`,
                          minHeight: '24px',
                          left: `calc(${leftPercentOffset}% + 8px)`,
                          width: `calc(${widthPercent}% - 16px)`
                        }}
                      >
                        <div className="font-bold flex items-center gap-2 truncate">
                          <span className="opacity-75 shrink-0 block sm:hidden md:block">
                            {(() => {
                              const pStart = toDate(p.startDate);
                              const pEnd = p.estimatedCompletion ? toDate(p.estimatedCompletion) : pStart;
                              const fStart = pStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                              const isSameDay = pStart.toDateString() === pEnd.toDateString();
                              const hasDuration = pEnd.getTime() > pStart.getTime();

                              if (!hasDuration) return fStart;

                              if (isSameDay) {
                                return `${fStart} - ${pEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
                              } else {
                                return `${fStart} - ${pEnd.toLocaleDateString([], { weekday: 'short' })} ${pEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
                              }
                            })()}
                          </span>
                          <span className="truncate">{p.name}</span>
                        </div>
                        {p.assignedCrewId && <div className="mt-1 text-[10px] opacity-80 truncate">{crews.find(c => c.id === p.assignedCrewId)?.name}</div>}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
        <QuickAddDialog
          open={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          defaultDate={quickAddDate}
          onSuccess={() => { }}
        />
        <TaskDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          task={selectedTask}
        />
      </>
    );
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading schedule...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          <h2 className="text-2xl font-semibold">Project Schedule</h2>
        </div>

        <div className="flex items-center gap-4">
          {enableTeam && (
            <div className="w-[200px]">
              <Select
                value={selectedCrewId}
                onValueChange={setSelectedCrewId}
                disabled={!canManageSchedule} // Lock validation
              >
                <SelectTrigger className="h-9">
                  <div className="flex items-center gap-2">
                    {canManageSchedule ? <Users className="h-4 w-4 text-muted-foreground" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
                    <SelectValue placeholder="All Crews" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {canManageSchedule && <SelectItem value="all">All Crews</SelectItem>}
                  <SelectItem value="mine_only" disabled className="hidden">My Assignments</SelectItem> {/* Hidden fallback */}
                  {crews.map(crew => (
                    <SelectItem key={crew.id} value={crew.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: crew.color }} />
                        {crew.name}
                      </div>
                    </SelectItem>
                  ))}
                  {!canManageSchedule && crews.map(crew => (
                    /* Only render current crew if locked? Or just rely on value being set */
                    <div key="noop"></div>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('day')}
              className={cn(
                "px-3 py-1 text-sm font-medium rounded-md transition-all",
                viewMode === 'day' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Day
            </button>
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
              {viewMode === 'day'
                ? currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })
                : viewMode === 'week'
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

      {viewMode === 'day' ? renderDayView() : (
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
                    {/* Layer 1: Visual Grid Lines (Background) */}
                    <div className="absolute inset-0 grid grid-cols-7 pointer-events-none z-0">
                      {week.map((date, dayIdx) => (
                        <div
                          key={dayIdx}
                          className={cn(
                            "border-r h-full transition-colors relative",
                            isToday(date) ? "bg-blue-50/30 w-full border-l-2 border-l-red-500" : "",
                            isWeekend(date) ? "bg-slate-100/60" : "", // Darker weekend shading
                            viewMode === 'month' && !isCurrentMonth(date) ? "bg-muted/10 border-r-muted/50" : ""
                          )}
                        />
                      ))}
                    </div>

                    {/* Layer 2: Click Capture Overlay (Transparent, Interactive) */}
                    <div className="absolute inset-0 grid grid-cols-7 z-[5]">
                      {week.map((date, dayIdx) => (
                        <div
                          key={dayIdx}
                          onClick={() => handleDayClick(date)}
                          className="cursor-pointer hover:bg-black/5 transition-colors"
                          title="Click to view full day"
                        />
                      ))}
                    </div>

                    {/* Layer 3: Day Numbers (Visual, Non-Interactive) */}
                    <div className="absolute inset-0 grid grid-cols-7 pointer-events-none z-[10]">
                      {week.map((date, dayIdx) => (
                        <div key={dayIdx} className={cn("p-2 border-t-2 border-transparent", isToday(date) && "border-primary")}>
                          <span
                            className={cn(
                              "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                              isToday(date)
                                ? "bg-primary text-primary-foreground shadow-sm"
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

                    {/* Layer 4: Ribbons (Interactive Content) */}
                    <div className="relative pt-10 pb-2 px-1 grid grid-cols-7 gap-y-1 pointer-events-none z-[20]">
                      {items.map((item) => {
                        // Determines rendering style: Chip (Single) vs Ribbon (Multi)

                        const isHovered = hoveredProjectId === item.project.id;

                        const projectDaysInWeek = Array.from({ length: item.duration }, (_, i) => {
                          const d = new Date(week[0]);
                          d.setDate(d.getDate() + item.startDayIdx + i);
                          return d;
                        });

                        return (
                          <div
                            key={`${item.project.id}-${weekIndex}`}
                            onMouseEnter={() => setHoveredProjectId(item.project.id)}
                            onMouseLeave={() => setHoveredProjectId(null)}
                            onClick={(e) => handleItemClick(e, item.project)}
                            className={cn(
                              "cursor-pointer relative h-8 transition-all duration-200 text-xs pointer-events-auto", // Enable pointer info
                              isHovered ? "z-30 scale-[1.01]" : "z-10",
                              // Styling specific to Type
                              item.isSingleDay
                                ? "rounded-full mx-1 shadow-sm hover:shadow-md border"
                                : cn("shadow-md", item.isStart ? "rounded-l-md ml-1" : "-ml-1", item.isEnd ? "rounded-r-md mr-1" : "-mr-1")
                            )}
                            style={{
                              gridColumnStart: item.startDayIdx + 1,
                              gridColumnEnd: `span ${item.duration}`,
                              gridRow: item.trackIndex + 1,
                            }}
                          >
                            {/* --- SINGLE DAY RENDERER --- */}
                            {item.isSingleDay ? (
                              <div className={cn(
                                "flex items-center h-full px-2 gap-2 overflow-hidden pointer-events-auto",
                                // Helper to get color class - reuse logic
                                (() => {
                                  const status = getStatusForDate(item.project, projectDaysInWeek[0]);
                                  if (['booked', 'in-progress'].includes(status) && item.project.assignedCrewId) {
                                    const crew = crews.find(c => c.id === item.project.assignedCrewId);
                                    if (crew?.paletteId) {
                                      const scale = CREW_PALETTES.find(p => p.id === crew.paletteId);
                                      return scale ? scale.class : "bg-primary/10 text-primary border-primary/20";
                                    }
                                  }
                                  // Default fallback or status colors
                                  return statusColors[status] || "bg-gray-100 border-gray-200 text-gray-700";
                                })()
                              )}>
                                {item.startTimeDisplay && (
                                  <span className="font-mono font-bold opacity-80 shrink-0 text-[10px]">
                                    {item.startTimeDisplay}
                                  </span>
                                )}
                                <span className="font-semibold truncate pr-1">{item.project.name}</span>
                                {/* Single Day Assignment Count */}
                                {item.project.assignments && item.project.assignments[format(projectDaysInWeek[0], "yyyy-MM-dd")] && (
                                  <div title={`${item.project.assignments[format(projectDaysInWeek[0], "yyyy-MM-dd")].length} assigned`} className="flex items-center gap-0.5 text-[9px] bg-white/60 px-1 rounded-sm backdrop-blur-sm self-center leading-none py-0.5 shrink-0 ml-auto mr-1 shadow-sm">
                                    <Users className="w-2.5 h-2.5" />
                                    {item.project.assignments[format(projectDaysInWeek[0], "yyyy-MM-dd")].length}
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* --- MULTI DAY RENDERER (Ribbon segments) --- */
                              <div className="absolute inset-0 flex overflow-hidden rounded-inherit">
                                {projectDaysInWeek.map((dayDate, i) => {
                                  const status = getStatusForDate(item.project, dayDate);
                                  let colorClass = statusColors[status] || "bg-gray-100 border-gray-200";

                                  if (status === 'paused') {
                                    colorClass = PAUSE_STYLE;
                                  } else if (['booked', 'in-progress'].includes(status) && item.project.assignedCrewId) {
                                    const crew = crews.find(c => c.id === item.project.assignedCrewId);
                                    if (crew?.paletteId) {
                                      const palette = CREW_PALETTES.find(p => p.id === crew.paletteId);
                                      if (palette) colorClass = palette.class;
                                    }
                                  }

                                  return (
                                    <div
                                      key={i}
                                      onClick={(e) => handleItemClick(e, item.project)}
                                      className={cn(
                                        "flex-1 h-full border-y border-r first:border-l relative group/segment flex items-center px-1 pointer-events-auto cursor-pointer",
                                        colorClass,
                                        "border-r-black/5"
                                      )}
                                    >
                                      {/* Content only on the first day of this specific ribbon segment */}
                                      {i === 0 && (
                                        <div className="flex items-center gap-2 overflow-hidden w-full whitespace-nowrap">
                                          {item.startTimeDisplay && item.isStart && (
                                            <span className="font-mono font-bold opacity-80 shrink-0 text-[10px]">
                                              {item.startTimeDisplay}
                                            </span>
                                          )}
                                          <span className="font-semibold truncate pr-1">
                                            {!item.isStart && <span className="text-[10px] opacity-75 mr-1 font-normal italic">(Cont.)</span>}
                                            {item.project.name}
                                          </span>
                                        </div>
                                      )}

                                      {/* Multi Day Assignment Count for this day segment */}
                                      {item.project.assignments && item.project.assignments[format(dayDate, "yyyy-MM-dd")] && (
                                        <div title={`${item.project.assignments[format(dayDate, "yyyy-MM-dd")].length} assigned`} className={`flex items-center gap-0.5 text-[9px] bg-white/40 px-1 rounded-sm backdrop-blur-sm self-center leading-none py-0.5 ml-auto mr-1 shadow-sm shrink-0 ${(i === 0 && item.isStart) ? '' : 'absolute right-0'}`}>
                                          <Users className="w-2.5 h-2.5" />
                                          {item.project.assignments[format(dayDate, "yyyy-MM-dd")].length}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
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
      )}
    </div>
  );
}
