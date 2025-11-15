import { RoomMeasurement } from "@/components/RoomMeasurement";
import { QuoteBuilder } from "@/components/QuoteBuilder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Quotes({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Quotes</h1>
        <p className="text-muted-foreground mt-2">Create and manage project quotes.</p>
      </div>

      <Tabs defaultValue="builder" className="w-full">
        <TabsList data-testid="tabs-quotes">
          <TabsTrigger value="measurements" data-testid="tab-measurements">
            Measurements
          </TabsTrigger>
          <TabsTrigger value="builder" data-testid="tab-builder">
            Quote Builder
          </TabsTrigger>
        </TabsList>
        <TabsContent value="measurements" className="mt-6">
          <RoomMeasurement projectId={projectId} />
        </TabsContent>
        <TabsContent value="builder" className="mt-6">
          <QuoteBuilder projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
