import { RoomMeasurement } from "@/components/RoomMeasurement";
import { QuoteBuilder } from "@/components/QuoteBuilder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useTranslation } from "react-i18next";

export default function Quotes({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">{t('quotes.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('quotes.subtitle')}</p>
      </div>

      <Tabs defaultValue="builder" className="w-full">
        <TabsList data-testid="tabs-quotes">
          <TabsTrigger value="measurements" data-testid="tab-measurements">
            {t('quotes.tabs.measurements')}
          </TabsTrigger>
          <TabsTrigger value="builder" data-testid="tab-builder">
            {t('quotes.tabs.builder')}
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
