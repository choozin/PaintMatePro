import { CrewScheduler } from "@/components/CrewScheduler";

export default function Schedule() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Schedule</h1>
        <p className="text-muted-foreground mt-2">Manage crew assignments and project timelines.</p>
      </div>

      <CrewScheduler />
    </div>
  );
}
