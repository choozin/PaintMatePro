import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ruler, Plus, Trash2, Save, Camera as CameraIcon, AlertCircle, RefreshCw } from "lucide-react";
import { Camera } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { useState, useEffect, useRef } from "react";
import { useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom } from "@/hooks/useRooms";
import { useProject, useUpdateProject } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import type { Room, MiscMeasurement } from "@/lib/firestore";
import { isIOS } from "@/lib/deviceDetection";
import { ARRoomScanner, type ARScanData, type ARMode } from "./ARRoomScanner";
import { useEntitlements } from "@/hooks/useEntitlements";

const ALL_AR_MODES: ARMode[] = ['hit-test', 'plane-detection', 'pose-based'];

interface RoomMeasurementProps {
  projectId: string;
  onNext?: () => void;
}

interface LocalRoom {
  id?: string;
  name: string;
  type: 'interior' | 'exterior';
  length: string;
  width: string;
  height: string;
  isNew?: boolean;
  hasChanges?: boolean;
}


function FallbackPrompt({ onTryNext, onManual, nextMode, error }: { onTryNext: () => void; onManual: () => void; nextMode?: string; error?: string | null }) {
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
          {error && <div className="p-2 bg-destructive/10 text-destructive text-xs rounded font-mono break-all">{error}</div>}
          <div className="flex flex-col gap-2">
            {nextMode && <Button onClick={onTryNext}><RefreshCw className="h-4 w-4 mr-2" />Try Next Mode ({nextMode})</Button>}
            <Button variant="outline" onClick={onManual}>Continue with Manual Entry</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function RoomMeasurement({ projectId, onNext }: RoomMeasurementProps) {
  const { data: project } = useProject(projectId);
  const { data: rooms = [], isLoading } = useRooms(projectId);
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();
  const updateProject = useUpdateProject();
  const { toast } = useToast();
  const { entitlements, hasFeature } = useEntitlements();

  const [localRooms, setLocalRooms] = useState<LocalRoom[]>([]);
  const [localMiscItems, setLocalMiscItems] = useState<MiscMeasurement[]>([]);
  const [showARScanner, setShowARScanner] = useState(false);
  const [activeType, setActiveType] = useState<'interior' | 'exterior'>('interior'); // Track which section we are adding to
  const [roundingPreference, setRoundingPreference] = useState<'precise' | '2inch' | '6inch' | '1foot'>('2inch');
  const [isIOSDevice] = useState(isIOS());

  // ... (AR state setup) ...
  const [isArDiscouraged, setIsArDiscouraged] = useState(() => sessionStorage.getItem('ar-unsupported') === 'true');
  const [arAttemptIndex, setArAttemptIndex] = useState(0);
  const [showFallbackPrompt, setShowFallbackPrompt] = useState(false);
  const [arError, setArError] = useState<string | null>(null);
  const manualEntryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && rooms) {
      setLocalRooms(rooms.map(room => ({
        ...room,
        id: room.id || '',
        type: room.type || 'interior', // Default to interior for legacy
        length: String(room.length),
        width: String(room.width),
        height: String(room.height)
      })));
    }
  }, [isLoading, rooms]);

  useEffect(() => {
    if (project?.globalMiscItems) {
      setLocalMiscItems(project.globalMiscItems);
    }
  }, [project?.globalMiscItems]);

  const addRoom = (type: 'interior' | 'exterior' = 'interior') => {
    // Entitlement Check for Exterior
    if (type === 'exterior' && !hasFeature('capture.reference')) { // Using capture.reference as proxy for Pro measurement features or add strict one
      // For now, let's assume 'capture.reference' is the Pro tier proxy, or just check plan
      // Actually, let's just allow it for now or implement strict entitlement later if needed.
      // The user prompt said: "instructed they need to upgrade... to get certain features (like exterior measurements)"
      // Let's just check the feature flag directly
      if (!hasFeature('capture.reference')) {
        return toast({
          variant: "destructive",
          title: "Pro Feature",
          description: "Exterior surfaces are available on the Pro plan."
        });
      }
    }

    setLocalRooms(prev => [...prev, {
      name: type === 'exterior' ? `Exterior Area ${prev.filter(r => r.type === 'exterior').length + 1}` : `Room ${prev.filter(r => r.type === 'interior').length + 1}`,
      type,
      length: "",
      width: "",
      height: "",
      isNew: true
    }]);
  };

  const removeRoom = async (index: number) => {
    const room = localRooms[index];
    if (room.id && !room.isNew) {
      await deleteRoom.mutateAsync(room.id);
      toast({ title: "Deleted" });
    } else {
      setLocalRooms(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateLocalRoom = (index: number, field: keyof LocalRoom, value: string) => {
    setLocalRooms(prev => prev.map((room, i) => i === index ? { ...room, [field]: value, hasChanges: !room.isNew } : room));
  };

  const saveRoom = async (index: number) => {
    const room = localRooms[index];
    if (!room.name || !room.length || !room.width || !room.height) { // Exterior might not need height? For now keep consistent schema
      return toast({ variant: "destructive", title: "Validation Error", description: "Please fill in all measurements" });
    }
    const roomData = {
      projectId,
      name: room.name,
      type: room.type,
      length: parseFloat(room.length),
      width: parseFloat(room.width),
      height: parseFloat(room.height)
    };
    if (room.isNew) await createRoom.mutateAsync(roomData as any);
    else if (room.id) await updateRoom.mutateAsync({ id: room.id, data: roomData });
  };

  const addMiscItem = () => {
    setLocalMiscItems(prev => [...prev, {
      id: crypto.randomUUID(),
      name: "New Item",
      unit: "units",
      quantity: 1,
      rate: 0,
      roomId: "global"
    }]);
  };

  const removeMiscItem = async (index: number) => {
    const newItems = [...localMiscItems];
    newItems.splice(index, 1);
    setLocalMiscItems(newItems);
    await updateProject.mutateAsync({ id: projectId, data: { globalMiscItems: newItems } });
    toast({ title: "Deleted", description: "Misc item removed." });
  };

  const updateMiscItem = (index: number, field: keyof MiscMeasurement, value: any) => {
    setLocalMiscItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const saveMiscItems = async () => {
    await updateProject.mutateAsync({ id: projectId, data: { globalMiscItems: localMiscItems } });
    toast({ title: "Saved", description: "Misc items saved." });
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

  const handleARClose = (status: 'completed' | 'failed' | 'cancelled', payload?: ARScanData | string) => {
    setShowARScanner(false);
    if (status === 'completed' && payload && typeof payload !== 'string') {
      const data = payload as ARScanData;
      setLocalRooms(prev => [...prev, { name: data.name, type: 'interior', length: data.length.toString(), width: data.width.toString(), height: data.height.toString(), isNew: true }]);
      toast({ title: "Room Scanned", description: `${data.name} measurements captured.` });
    } else if (status === 'failed') {
      if (typeof payload === 'string') {
        setArError(payload);
      } else {
        setArError(null);
      }
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
      // Only request explicit permissions on native apps.
      // On the web, WebXR will handle the permission prompt when the session starts.
      if (Capacitor.isNativePlatform()) {
        const permissions = await Camera.requestPermissions({ permissions: ['camera'] });
        if (permissions.camera !== 'granted') {
          toast({
            variant: "destructive",
            title: "Permission Denied",
            description: "Camera access is required for AR measurements.",
          });
          return;
        }
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
      {showARScanner && <ARRoomScanner onClose={handleARClose} roundingPreference={roundingPreference} modeToTry={ALL_AR_MODES[arAttemptIndex]} />}
      {showFallbackPrompt && <FallbackPrompt onTryNext={handleTryNextMode} onManual={setFinalArFailure} nextMode={ALL_AR_MODES[arAttemptIndex + 1]} error={arError} />}

      <div className="space-y-6">
        {/* Project Summary */}
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle>Project Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-background p-3 rounded-lg border shadow-sm">
                <p className="text-xs text-muted-foreground uppercase font-bold">Total Rooms</p>
                <p className="text-2xl font-bold">{localRooms.filter(r => r.type !== 'exterior').length}</p>
              </div>
              <div className="bg-background p-3 rounded-lg border shadow-sm">
                <p className="text-xs text-muted-foreground uppercase font-bold">Total Wall Area</p>
                <p className="text-2xl font-bold">{localRooms.filter(r => r.type !== 'exterior').reduce((acc, r) => acc + calculateArea(r).wallArea, 0).toFixed(0)} <span className="text-sm font-normal text-muted-foreground">ft²</span></p>
              </div>
              <div className="bg-background p-3 rounded-lg border shadow-sm">
                <p className="text-xs text-muted-foreground uppercase font-bold">Total Floor Area</p>
                <p className="text-2xl font-bold">{localRooms.filter(r => r.type !== 'exterior').reduce((acc, r) => acc + calculateArea(r).floorArea, 0).toFixed(0)} <span className="text-sm font-normal text-muted-foreground">ft²</span></p>
              </div>
              <div className="bg-background p-3 rounded-lg border shadow-sm">
                <p className="text-xs text-muted-foreground uppercase font-bold">Exterior Surfaces</p>
                <p className="text-2xl font-bold">{localRooms.filter(r => r.type === 'exterior').length}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Detailed Measurements</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {localRooms.map((room, idx) => {
                  const dims = room.type === 'exterior'
                    ? `${room.length}ft x ${room.height}ft`
                    : `${room.length}'L x ${room.width}'W x ${room.height}'H`;
                  const areas = room.type === 'exterior'
                    ? `Area: ${(parseFloat(room.length || '0') * parseFloat(room.height || '0')).toFixed(0)} sqft`
                    : `Wall: ${calculateArea(room).wallArea.toFixed(0)} | Clg: ${calculateArea(room).floorArea.toFixed(0)}`;

                  return (
                    <div key={idx} className="text-xs bg-background border px-2 py-1 rounded flex flex-col justify-center">
                      <div className="flex justify-between font-medium">
                        <span className="truncate mr-2">{room.name}</span>
                        <span className="text-muted-foreground whitespace-nowrap">{dims}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 text-right">
                        {areas}
                      </div>
                    </div>
                  );
                })}
                {localRooms.length === 0 && <p className="text-xs text-muted-foreground italic">No rooms added yet.</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {hasFeature('capture.ar') && (
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
        )}

        <div ref={manualEntryRef} className="scroll-mt-4 space-y-8">
          {/* Interior Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Interior Rooms</h2>
              </div>
              <Button onClick={() => addRoom('interior')} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />Add Room
              </Button>
            </div>

            <div className="grid gap-6">
              {localRooms.filter(r => r.type === 'interior').map((room) => {
                const index = localRooms.findIndex(r => r === room); // Find actual index for updates
                const { floorArea, wallArea, totalArea } = calculateArea(room);

                return (
                  <Card key={room.id || `new-interior-${index}`}>
                    <CardHeader className="flex-row items-center justify-between gap-2 py-3">
                      <CardTitle className="flex-1"><Input value={room.name} onChange={e => updateLocalRoom(index, "name", e.target.value)} className="text-base font-semibold border-0 p-0 h-auto focus-visible:ring-0" placeholder="Room Name" /></CardTitle>
                      <div className="flex items-center gap-2">
                        {(room.isNew || room.hasChanges) && (
                          <Button
                            size="sm"
                            className="h-8 px-3 text-white bg-blue-600 hover:bg-blue-700 shadow-md animate-in zoom-in-75 duration-300 font-semibold transition-all"
                            onClick={() => saveRoom(index)}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeRoom(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="space-y-1"><Label className="text-xs">Length</Label><Input type="number" value={room.length} onChange={e => updateLocalRoom(index, "length", e.target.value)} className="h-8 text-sm" /></div>
                        <div className="space-y-1"><Label className="text-xs">Width</Label><Input type="number" value={room.width} onChange={e => updateLocalRoom(index, "width", e.target.value)} className="h-8 text-sm" /></div>
                        <div className="space-y-1"><Label className="text-xs">Height</Label><Input type="number" value={room.height} onChange={e => updateLocalRoom(index, "height", e.target.value)} className="h-8 text-sm" /></div>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">Walls: {wallArea.toFixed(0)}</Badge>
                        <Badge variant="secondary">Clg: {floorArea.toFixed(0)}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {localRooms.filter(r => r.type === 'interior').length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground text-sm">No interior rooms added.</div>
              )}
            </div>
          </div>

          {/* Exterior Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-t pt-8">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs">Ex</div>
                <h2 className="text-xl font-semibold">Exterior Surfaces</h2>
              </div>
              <Button onClick={() => addRoom('exterior')} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />Add Surface
              </Button>
            </div>

            <div className="grid gap-6">
              {localRooms.filter(r => r.type === 'exterior').map((room) => {
                const index = localRooms.findIndex(r => r === room);
                const { floorArea, wallArea } = calculateArea(room);

                return (
                  <Card key={room.id || `new-exterior-${index}`}>
                    <CardHeader className="flex-row items-center justify-between gap-2 py-3">
                      <CardTitle className="flex-1"><Input value={room.name} onChange={e => updateLocalRoom(index, "name", e.target.value)} className="text-base font-semibold border-0 p-0 h-auto focus-visible:ring-0" placeholder="Surface Name (e.g. Siding)" /></CardTitle>
                      <div className="flex items-center gap-2">
                        {(room.isNew || room.hasChanges) && (
                          <Button
                            size="sm"
                            className="h-8 px-3 text-white bg-blue-600 hover:bg-blue-700 shadow-md animate-in zoom-in-75 duration-300 font-semibold transition-all"
                            onClick={() => saveRoom(index)}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeRoom(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="space-y-1"><Label className="text-xs">Total Width/Perimeter (ft)</Label><Input type="number" value={room.length} onChange={e => updateLocalRoom(index, "length", e.target.value)} className="h-8 text-sm" /></div>
                        <div className="space-y-1"><Label className="text-xs">Avg Height (ft)</Label><Input type="number" value={room.height} onChange={e => updateLocalRoom(index, "height", e.target.value)} className="h-8 text-sm" /></div>
                        {/* Hide Width for Exterior? Use Length as Perimeter logic essentially. Or keep 3 dims but label differently */}
                        <div className="hidden"><Input type="number" value={room.width} onChange={e => updateLocalRoom(index, "width", e.target.value)} /></div>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">Area: {(parseFloat(room.length || '0') * parseFloat(room.height || '0')).toFixed(0)} ft²</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {localRooms.filter(r => r.type === 'exterior').length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground text-sm">No exterior surfaces added.</div>
              )}
            </div>
          </div>

          {/* Misc Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-t pt-8">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs">M</div>
                <h2 className="text-xl font-semibold">Misc & Other Items</h2>
              </div>
              <Button onClick={addMiscItem} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />Add Item
              </Button>
            </div>

            <div className="grid gap-4">
              {localMiscItems.map((item, index) => (
                <Card key={item.id || index}>
                  <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end md:items-center">
                    <div className="flex-1 w-full space-y-1">
                      <Label className="text-xs">Item Name</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateMiscItem(index, 'name', e.target.value)}
                        placeholder="e.g. Baseboards"
                        className="h-9"
                      />
                    </div>
                    <div className="w-full md:w-32 space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Select value={item.unit} onValueChange={(val: any) => updateMiscItem(index, 'unit', val)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="units">Count (ea)</SelectItem>
                          <SelectItem value="sqft">Area (sqft)</SelectItem>
                          <SelectItem value="linear_ft">Linear (ft)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-full md:w-24 space-y-1">
                      <Label className="text-xs">Qty/Len</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateMiscItem(index, 'quantity', parseFloat(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    {item.unit === 'linear_ft' && (
                      <div className="w-full md:w-48 space-y-1">
                        <Label className="text-xs flex items-center justify-between">
                          Width (ft)
                          <span className="text-[10px] text-muted-foreground font-normal ml-2" title="Required to calculate paintable surface area (e.g. height of baseboard)">
                            (for Paint Area)
                          </span>
                        </Label>
                        <Input
                          type="number"
                          placeholder="e.g. 0.5 (6 inches)"
                          value={item.width || ''}
                          onChange={(e) => updateMiscItem(index, 'width', parseFloat(e.target.value))}
                          className="h-9"
                        />
                        <p className="text-[10px] text-muted-foreground">e.g. Baseboard height</p>
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="text-destructive h-9 w-9 shrink-0" onClick={() => removeMiscItem(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {localMiscItems.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                  No miscellaneous items added.
                </div>
              )}
              {localMiscItems.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={saveMiscItems} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                    <Save className="h-4 w-4 mr-2" /> Save Misc Items
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {localRooms.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Project Totals</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><p className="text-sm text-muted-foreground">Total Floor Area</p><p className="text-2xl font-bold font-mono">{localRooms.reduce((s, r) => s + calculateArea(r).floorArea, 0).toFixed(0)} ft²</p></div>
                <div><p className="text-sm text-muted-foreground">Total Wall Area</p><p className="text-2xl font-bold font-mono">{localRooms.reduce((s, r) => s + calculateArea(r).wallArea, 0).toFixed(0)} ft²</p></div>
                <div><p className="text-sm text-muted-foreground">Total Paintable Area</p><p className="text-2xl font-bold font-mono">{localRooms.reduce((s, r) => s + calculateArea(r).totalArea, 0).toFixed(0)} ft²</p></div>
                <div><p className="text-sm text-muted-foreground">Est. Paint Needed</p><p className="text-2xl font-bold font-mono">{localRooms.reduce((s, r) => s + Math.ceil(calculateArea(r).wallArea / 350), 0)} gal <span className="text-xs font-normal text-muted-foreground">(1 coat)</span></p></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {localRooms.length > 0 && (
        <div className="flex justify-end pt-6 pb-8">
          <Button onClick={onNext} className="w-full md:w-auto font-semibold" size="default">
            Next Step: Project Specs
            <Ruler className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}