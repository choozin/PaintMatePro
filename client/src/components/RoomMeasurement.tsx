import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ruler, Plus, Trash2, Save, Camera as CameraIcon, AlertCircle, RefreshCw } from "lucide-react";
import { Camera } from "@capacitor/camera";
import { useState, useEffect, useRef } from "react";
import { useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom } from "@/hooks/useRooms";
import { useToast } from "@/hooks/use-toast";
import type { Room } from "@/lib/firestore";
import { isIOS } from "@/lib/deviceDetection";
import { ARRoomScanner, type ARScanData, type ARMode } from "./ARRoomScanner";

const ALL_AR_MODES: ARMode[] = ['hit-test', 'plane-detection', 'pose-based'];

interface RoomMeasurementProps {
  projectId: string;
}

interface LocalRoom {
  id?: string;
  name: string;
  length: string;
  width: string;
  height: string;
  isNew?: boolean;
  hasChanges?: boolean;
}

function FallbackPrompt({ onTryNext, onManual, nextMode }: { onTryNext: () => void; onManual: () => void; nextMode?: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="text-destructive" />
            AR Mode Failed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">The previous camera mode was not supported by your device.</p>
          <div className="flex flex-col gap-2">
            {nextMode && <Button onClick={onTryNext}><RefreshCw className="h-4 w-4 mr-2" />Try Next Mode ({nextMode})</Button>}
            <Button variant="outline" onClick={onManual}>Continue with Manual Entry</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RoomMeasurement({ projectId }: RoomMeasurementProps) {
  const { data: rooms = [], isLoading } = useRooms(projectId);
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();
  const { toast } = useToast();

  const [localRooms, setLocalRooms] = useState<LocalRoom[]>([]);
  const [showARScanner, setShowARScanner] = useState(false);
  const [roundingPreference, setRoundingPreference] = useState<'precise' | '2inch' | '6inch' | '1foot'>('2inch');
  const [isIOSDevice] = useState(isIOS());
  
  const [isArDiscouraged, setIsArDiscouraged] = useState(() => sessionStorage.getItem('ar-unsupported') === 'true');
  const [arAttemptIndex, setArAttemptIndex] = useState(0);
  const [showFallbackPrompt, setShowFallbackPrompt] = useState(false);
  const manualEntryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && rooms) {
      setLocalRooms(rooms.map(room => ({ ...room, id: room.id || '', length: String(room.length), width: String(room.width), height: String(room.height) })));
    }
  }, [isLoading, rooms]);

  const addRoom = () => {
    setLocalRooms(prev => [...prev, { name: `Room ${prev.length + 1}`, length: "", width: "", height: "", isNew: true }]);
  };

  const removeRoom = async (index: number) => {
    const room = localRooms[index];
    if (room.id && !room.isNew) {
      await deleteRoom.mutateAsync(room.id);
      toast({ title: "Room Deleted" });
    } else {
      setLocalRooms(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateLocalRoom = (index: number, field: keyof LocalRoom, value: string) => {
    setLocalRooms(prev => prev.map((room, i) => i === index ? { ...room, [field]: value, hasChanges: !room.isNew } : room));
  };

  const saveRoom = async (index: number) => {
    const room = localRooms[index];
    if (!room.name || !room.length || !room.width || !room.height) {
      return toast({ variant: "destructive", title: "Validation Error", description: "Please fill in all room measurements" });
    }
    const roomData = { projectId, name: room.name, length: parseFloat(room.length), width: parseFloat(room.width), height: parseFloat(room.height) };
    if (room.isNew) await createRoom.mutateAsync(roomData);
    else if (room.id) await updateRoom.mutateAsync({ id: room.id, data: roomData });
  };

  const calculateArea = (room: LocalRoom) => {
    const l = parseFloat(room.length) || 0, w = parseFloat(room.width) || 0, h = parseFloat(room.height) || 0;
    const floorArea = l * w;
    const wallArea = 2 * (l + w) * h;
    return { floorArea, wallArea, totalArea: floorArea + wallArea };
  };

  const calculatePaintNeeded = (wallArea: number) => Math.ceil((wallArea * 2) / 400);

  const setFinalArFailure = () => {
    sessionStorage.setItem('ar-unsupported', 'true');
    setIsArDiscouraged(true);
    setShowFallbackPrompt(false);
    toast({ variant: "destructive", title: "AR Scanning Not Supported", description: "Your device does not support camera-based measurements." });
    setTimeout(() => manualEntryRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleARClose = (status: 'completed' | 'failed' | 'cancelled', data?: ARScanData) => {
    setShowARScanner(false);
    if (status === 'completed' && data) {
      setLocalRooms(prev => [...prev, { name: data.name, length: data.length.toString(), width: data.width.toString(), height: data.height.toString(), isNew: true }]);
      toast({ title: "Room Scanned", description: `${data.name} measurements captured.` });
    } else if (status === 'failed') {
      if (arAttemptIndex < ALL_AR_MODES.length - 1) {
        setShowFallbackPrompt(true);
      } else {
        setFinalArFailure();
      }
    }
  };

  const handleTryNextMode = () => {
    setShowFallbackPrompt(false);
    setArAttemptIndex(prev => prev + 1);
    setShowARScanner(true);
  };

  const handleScanButtonClick = async () => {
    try {
      const permissions = await Camera.requestPermissions({ permissions: ['camera'] });
      if (permissions.camera !== 'granted') {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "Camera access is required for AR measurements.",
        });
        return;
      }
      setArAttemptIndex(0);
      setShowARScanner(true);
    } catch (error) {
      console.error("Camera permission error:", error);
      toast({
        variant: "destructive",
        title: "Permission Error",
        description: "Could not request camera permission.",
      });
    }
  };

  if (isLoading) return <p className="text-muted-foreground text-center p-12">Loading room measurements...</p>;

  return (
    <>
      {showARScanner && <ARRoomScanner projectId={projectId} onClose={handleARClose} roundingPreference={roundingPreference} modeToTry={ALL_AR_MODES[arAttemptIndex]} />}
      {showFallbackPrompt && <FallbackPrompt onTryNext={handleTryNextMode} onManual={setFinalArFailure} nextMode={ALL_AR_MODES[arAttemptIndex + 1]} />}

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Camera-Assisted Measurement</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <Label className="text-sm font-semibold">Measurement Precision</Label>
              <Select value={roundingPreference} onValueChange={(value: any) => setRoundingPreference(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="precise">Precise (0.1 ft)</SelectItem>
                  <SelectItem value="2inch">2 Inches</SelectItem>
                  <SelectItem value="6inch">6 Inches</SelectItem>
                  <SelectItem value="1foot">1 Foot</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Button onClick={handleScanButtonClick} disabled={isIOSDevice || isArDiscouraged} size="lg" variant={isArDiscouraged ? "outline" : "default"} className="w-full">
                {isArDiscouraged ? <AlertCircle className="h-5 w-5 mr-2" /> : <CameraIcon className="h-5 w-5 mr-2" />}
                {isArDiscouraged ? "AR Not Supported on Device" : "Scan Room with Camera"}
              </Button>
              {(isIOSDevice || isArDiscouraged) && (
                <p className="text-sm text-muted-foreground text-center">
                  {isIOSDevice ? "iOS support coming soon." : "Please use manual entry."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div ref={manualEntryRef} className="flex items-center justify-between gap-4 scroll-mt-4">
          <div className="flex items-center gap-2"><Ruler className="h-5 w-5" /><h2 className="text-2xl font-semibold">Manual Entry</h2></div>
          <Button onClick={addRoom}><Plus className="h-4 w-4 mr-2" />Add Room</Button>
        </div>

        {localRooms.length === 0 ? (
          <Card><CardContent className="p-12 text-center text-muted-foreground">No rooms added yet.</CardContent></Card>
        ) : (
          <div className="grid gap-6">
            {localRooms.map((room, index) => {
              const { floorArea, wallArea, totalArea } = calculateArea(room);
              const paintGallons = calculatePaintNeeded(wallArea);
              return (
                <Card key={room.id || `new-${index}`}>
                  <CardHeader className="flex-row items-center justify-between gap-2">
                    <CardTitle className="flex-1"><Input value={room.name} onChange={e => updateLocalRoom(index, "name", e.target.value)} className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0" /></CardTitle>
                    <div className="flex items-center gap-2">
                      {(room.isNew || room.hasChanges) && <Button size="sm" onClick={() => saveRoom(index)} disabled={createRoom.isPending || updateRoom.isPending}><Save className="h-4 w-4 mr-2" />Save</Button>}
                      <Button variant="ghost" size="icon" onClick={() => removeRoom(index)} disabled={deleteRoom.isPending}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="space-y-2"><Label>Length (ft)</Label><Input type="number" value={room.length} onChange={e => updateLocalRoom(index, "length", e.target.value)} className="font-mono" /></div>
                      <div className="space-y-2"><Label>Width (ft)</Label><Input type="number" value={room.width} onChange={e => updateLocalRoom(index, "width", e.target.value)} className="font-mono" /></div>
                      <div className="space-y-2"><Label>Height (ft)</Label><Input type="number" value={room.height} onChange={e => updateLocalRoom(index, "height", e.target.value)} className="font-mono" /></div>
                      <div className="space-y-2"><Label>Total Area</Label><div className="h-10 flex items-center"><span className="font-mono text-2xl font-bold">{totalArea.toFixed(0)}</span><span className="text-sm text-muted-foreground ml-1">ft²</span></div></div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Badge variant="secondary" className="font-mono">Floor: {floorArea.toFixed(0)} ft²</Badge>
                      <Badge variant="secondary" className="font-mono">Walls: {wallArea.toFixed(0)} ft²</Badge>
                      <Badge variant="outline" className="font-mono">Paint: ~{paintGallons} gal</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {localRooms.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Project Totals</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-sm text-muted-foreground">Total Floor Area</p><p className="text-2xl font-bold font-mono">{localRooms.reduce((s, r) => s + calculateArea(r).floorArea, 0).toFixed(0)} ft²</p></div>
                <div><p className="text-sm text-muted-foreground">Total Wall Area</p><p className="text-2xl font-bold font-mono">{localRooms.reduce((s, r) => s + calculateArea(r).wallArea, 0).toFixed(0)} ft²</p></div>
                <div><p className="text-sm text-muted-foreground">Total Paintable Area</p><p className="text-2xl font-bold font-mono">{localRooms.reduce((s, r) => s + calculateArea(r).totalArea, 0).toFixed(0)} ft²</p></div>
                <div><p className="text-sm text-muted-foreground">Est. Paint Needed</p><p className="text-2xl font-bold font-mono">{localRooms.reduce((s, r) => s + calculatePaintNeeded(calculateArea(r).wallArea), 0)} gal</p></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}