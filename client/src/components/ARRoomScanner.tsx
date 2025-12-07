import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { registerPlugin } from "@capacitor/core";

export interface ARScanData {
  length: number;
  width: number;
  height: number;
  name: string;
}

interface ARMeasurementPlugin {
  startScanning(): Promise<ARScanData>;
}

const ARMeasurement = registerPlugin<ARMeasurementPlugin>('ARMeasurement');

export type ARMode = 'hit-test' | 'plane-detection' | 'pose-based';

interface ARRoomScannerProps {
  modeToTry: ARMode;
  onClose: (status: 'completed' | 'failed' | 'cancelled', payload?: ARScanData | string) => void;
  roundingPreference: 'precise' | '2inch' | '6inch' | '1foot';
}

export function ARRoomScanner({
  onClose,
}: ARRoomScannerProps) {
  const [roomName, setRoomName] = useState("");
  const [ceilingHeight, setCeilingHeight] = useState("");
  const [currentStep, setCurrentStep] = useState<'name' | 'height' | 'scanning'>('name');
  const { toast } = useToast();

  const runNativeAR = async () => {
    try {
      console.log("🚀 Starting Native AR Scan...");
      const data = await ARMeasurement.startScanning();
      console.log("✅ Native AR Scan Complete:", data);

      // Add ceiling height from input if available
      const finalData = {
        ...data,
        height: ceilingHeight ? parseFloat(ceilingHeight) : 0
      };

      onClose('completed', finalData);
    } catch (error: any) {
      console.error("❌ Native AR Scan Failed:", error);
      toast({
        variant: "destructive",
        title: "AR Error",
        description: error.message || "Failed to start AR scanner",
      });
    }
  };

  const handleInitialNext = () => {
    if (currentStep === 'name' && roomName) {
      setCurrentStep('height');
    } else if (currentStep === 'height' && ceilingHeight) {
      setCurrentStep('scanning');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">AR Room Scanner <span className="text-xs text-muted-foreground ml-2">Native</span></h2>
            <Button variant="ghost" size="icon" onClick={() => onClose('cancelled')}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {currentStep === 'name' ? (
            <>
              <div className="space-y-2">
                <Label>Room Name</Label>
                <Input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g., Living Room"
                />
              </div>
              <Button onClick={handleInitialNext} disabled={!roomName} className="w-full">Next</Button>
            </>
          ) : currentStep === 'height' ? (
            <>
              <div className="space-y-2">
                <Label>Ceiling Height (ft)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={ceilingHeight}
                  onChange={(e) => setCeilingHeight(e.target.value)}
                  placeholder="e.g., 9"
                />
                <p className="text-sm text-muted-foreground">Measure from floor to ceiling for accuracy</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep('name')} className="flex-1">Back</Button>
                <Button onClick={handleInitialNext} disabled={!ceilingHeight} className="flex-1">Next</Button>
              </div>
            </>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-muted-foreground">Ready to start scanning. This will open the native AR camera.</p>
              <Button onClick={runNativeAR} size="lg" className="w-full">Start AR Session</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
