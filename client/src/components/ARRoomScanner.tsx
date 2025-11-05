import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ARRoomScannerProps {
  projectId: string;
  onClose: () => void;
  onScanComplete: (data: ARScanData) => void;
  roundingPreference: 'precise' | '2inch' | '6inch' | '1foot';
  roundingDirection: 'up' | 'down';
}

export interface ARScanData {
  name: string;
  length: number;
  width: number;
  height: number;
  measurementMethod: 'camera';
  confidence: number;
}

export function ARRoomScanner({ 
  onClose, 
  onScanComplete,
  roundingPreference,
  roundingDirection 
}: ARRoomScannerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">AR Room Scanner</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-ar-scanner"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Camera View - Placeholder */}
        <div className="flex-1 relative bg-muted flex items-center justify-center">
          <div className="text-center space-y-4 p-6">
            <p className="text-lg font-semibold">AR Camera Scanner</p>
            <p className="text-sm text-muted-foreground max-w-md">
              AR scanning feature will be implemented here.
              <br />
              WebXR integration with corner tapping workflow.
            </p>
            <p className="text-xs text-muted-foreground">
              Rounding: {roundingPreference} ({roundingDirection})
            </p>
          </div>
        </div>

        {/* Instructions Overlay - Placeholder */}
        <div className="p-4 border-t bg-background">
          <p className="text-sm text-muted-foreground text-center">
            Implementation coming in next task
          </p>
        </div>
      </div>
    </div>
  );
}
