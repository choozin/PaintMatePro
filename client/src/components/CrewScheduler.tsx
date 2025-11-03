import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";

interface ScheduledJob {
  id: string;
  projectName: string;
  crew: string;
  time: string;
  duration: string;
}

export function CrewScheduler() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const crews = ["Crew A", "Crew B", "Crew C"];

  const scheduledJobs: Record<string, ScheduledJob[]> = {
    "Mon-Crew A": [
      { id: "1", projectName: "Residential Exterior", crew: "Crew A", time: "8:00 AM", duration: "8h" },
    ],
    "Tue-Crew A": [
      { id: "2", projectName: "Office Interior", crew: "Crew A", time: "9:00 AM", duration: "6h" },
    ],
    "Wed-Crew B": [
      { id: "3", projectName: "Commercial Building", crew: "Crew B", time: "7:00 AM", duration: "10h" },
    ],
  };

  const prevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
    console.log('Previous week triggered');
  };

  const nextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
    console.log('Next week triggered');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          <h2 className="text-2xl font-semibold">Crew Schedule</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevWeek} data-testid="button-prev-week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">
            Week of {currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <Button variant="outline" size="icon" onClick={nextWeek} data-testid="button-next-week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 gap-2">
            <div className="font-medium text-sm p-3"></div>
            {days.map((day) => (
              <div key={day} className="font-medium text-sm text-center p-3 bg-muted rounded-md">
                {day}
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-2">
            {crews.map((crew) => (
              <Card key={crew} data-testid={`card-crew-${crew.replace(' ', '-').toLowerCase()}`}>
                <CardContent className="p-0">
                  <div className="grid grid-cols-8 gap-2">
                    <div className="flex items-center justify-center p-3 font-medium text-sm bg-card">
                      {crew}
                    </div>
                    {days.map((day) => {
                      const key = `${day}-${crew}`;
                      const jobs = scheduledJobs[key] || [];
                      
                      return (
                        <div
                          key={day}
                          className="min-h-[100px] p-2 border rounded-md hover-elevate"
                          data-testid={`cell-${day}-${crew.replace(' ', '-').toLowerCase()}`}
                        >
                          {jobs.map((job) => (
                            <Badge
                              key={job.id}
                              variant="secondary"
                              className="w-full mb-1 justify-start text-left cursor-pointer"
                              onClick={() => console.log('Job clicked', job.id)}
                              data-testid={`job-${job.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate">{job.projectName}</div>
                                <div className="text-xs text-muted-foreground">{job.time}</div>
                              </div>
                            </Badge>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
