import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ruler, Plus, Trash2, Save, Camera, AlertCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRooms, useCreateRoom, useUpdateRoom, useDeleteRoom } from "@/hooks/useRooms";
import { useToast } from "@/hooks/use-toast";
import type { Room } from "@/lib/firestore";
import { isIOS } from "@/lib/deviceDetection";
import { ARRoomScanner, type ARScanData } from "./ARRoomScanner";

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
  
  const [isArDiscouraged, setIsArDiscouraged] = useState(
    () => sessionStorage.getItem('ar-unsupported') === 'true'
  );
  const manualEntryRef = useRef<HTMLDivElement>(null);


  // Sync Firebase rooms to local state
  useEffect(() => {
    if (rooms.length > 0) {
      setLocalRooms(
        rooms.map((room) => ({
          id: room.id,
          name: room.name,
          length: room.length.toString(),
          width: room.width.toString(),
          height: room.height.toString(),
          isNew: false,
          hasChanges: false,
        }))
      );
    }
  }, [rooms]);

  const addRoom = () => {
    const newRoom: LocalRoom = {
      name: `Room ${localRooms.length + 1}`,
      length: "",
      width: "",
      height: "",
      isNew: true,
      hasChanges: false,
    };
    setLocalRooms([...localRooms, newRoom]);
  };

  const removeRoom = async (index: number) => {
    const room = localRooms[index];
    
    if (room.id && !room.isNew) {
      try {
        await deleteRoom.mutateAsync(room.id);
        toast({
          title: "Room Deleted",
          description: "Room has been successfully deleted",
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to delete room",
        });
      }
    } else {
      // Just remove from local state if not saved yet
      setLocalRooms(localRooms.filter((_, i) => i !== index));
    }
  };

  const updateLocalRoom = (index: number, field: keyof LocalRoom, value: string) => {
    setLocalRooms(
      localRooms.map((room, i) => {
        if (i === index) {
          return { ...room, [field]: value, hasChanges: !room.isNew };
        }
        return room;
      })
    );
  };

  const saveRoom = async (index: number) => {
    const room = localRooms[index];
    
    if (!room.name || !room.length || !room.width || !room.height) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all room measurements",
      });
      return;
    }

    const roomData = {
      projectId,
      name: room.name,
      length: parseFloat(room.length),
      width: parseFloat(room.width),
      height: parseFloat(room.height),
    };

    try {
      if (room.isNew) {
        await createRoom.mutateAsync(roomData);
        toast({
          title: "Room Saved",
          description: "Room measurements have been saved",
        });
      } else if (room.id && room.hasChanges) {
        await updateRoom.mutateAsync({
          id: room.id,
          data: roomData,
        });
        toast({
          title: "Room Updated",
          description: "Room measurements have been updated",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save room",
      });
    }
  };

  const calculateArea = (room: LocalRoom) => {
    const length = parseFloat(room.length) || 0;
    const width = parseFloat(room.width) || 0;
    const height = parseFloat(room.height) || 0;
    
    const floorArea = length * width;
    const wallArea = 2 * (length + width) * height;
    const totalArea = floorArea + wallArea;
    
    return { floorArea, wallArea, totalArea };
  };

  const calculatePaintNeeded = (wallArea: number) => {
    // Assume 1 gallon covers ~400 sq ft with one coat
    const coveragePerGallon = 400;
    const coats = 2; // Standard: primer + finish coat
    const gallons = (wallArea * coats) / coveragePerGallon;
    return Math.ceil(gallons);
  };

  const handleARClose = (status: 'completed' | 'failed' | 'cancelled', data?: ARScanData) => {
    setShowARScanner(false);

    if (status === 'completed' && data) {
      const newRoom: LocalRoom = {
        name: data.name,
        length: data.length.toString(),
        width: data.width.toString(),
        height: data.height.toString(),
        isNew: true,
        hasChanges: false,
      };
      setLocalRooms(prev => [...prev, newRoom]);
      toast({
        title: "Room Scanned",
        description: `${data.name} measurements captured successfully`,
      });
    }

    if (status === 'failed') {
      sessionStorage.setItem('ar-unsupported', 'true');
      setIsArDiscouraged(true);
      toast({
        variant: "destructive",
        title: "AR Scanning Not Supported",
        description: "Your device does not support camera-based measurements.",
      });
      setTimeout(() => {
        manualEntryRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading room measurements...</p>
      </div>
    );
  }

  return (
    <>
      {showARScanner && (
        <ARRoomScanner
          projectId={projectId}
          onClose={handleARClose}
          roundingPreference={roundingPreference}
        />
      )}

      <div className="space-y-6">
        {/* AR Scanner Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Camera-Assisted Measurement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Measurement Rounding</Label>
                <p className="text-xs text-muted-foreground">
                  Configure how AR measurements should be rounded before scanning
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Precision</Label>
                  <Select value={roundingPreference} onValueChange={(value: any) => setRoundingPreference(value)}>
                    <SelectTrigger data-testid="select-rounding-precision" className="h-9">
                      <SelectValue placeholder="Select precision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="precise">Precise (0.1 ft)</SelectItem>
                      <SelectItem value="2inch">2 Inches</SelectItem>
                      <SelectItem value="6inch">6 Inches</SelectItem>
                      <SelectItem value="1foot">1 Foot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => setShowARScanner(true)}
                disabled={isIOSDevice || isArDiscouraged}
                size="lg"
                variant={isArDiscouraged ? "outline" : "default"}
                className="w-full"
                data-testid="button-scan-room-camera"
              >
                {isArDiscouraged ? <AlertCircle className="h-5 w-5 mr-2" /> : <Camera className="h-5 w-5 mr-2" />}
                {isArDiscouraged ? "AR Scanning Not Supported" : "Scan Room with Camera"}
              </Button>
              {(isIOSDevice || isArDiscouraged) && (
                <p className="text-sm text-muted-foreground text-center">
                  {isIOSDevice ? "Currently only available on Android devices. iOS support coming soon." : "Your device does not support this feature. Please use manual entry."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div ref={manualEntryRef} className="flex items-center justify-between gap-4 scroll-mt-4">
          <div className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            <h2 className="text-2xl font-semibold">Manual Entry</h2>
          </div>
          <Button onClick={addRoom} data-testid="button-add-room">
            <Plus className="h-4 w-4 mr-2" />
            Add Room
          </Button>
        </div>

      {localRooms.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="text-center space-y-3">
              <Ruler className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No rooms added yet</p>
              <p className="text-sm text-muted-foreground">Add room measurements to calculate paint quantities</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6">
        {localRooms.map((room, index) => {
          const { floorArea, wallArea, totalArea } = calculateArea(room);
          const paintGallons = calculatePaintNeeded(wallArea);
          const needsSave = room.isNew || room.hasChanges;
          
          return (
            <Card key={index} data-testid={`card-room-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-lg flex-1">
                  <Input
                    value={room.name}
                    onChange={(e) => updateLocalRoom(index, "name", e.target.value)}
                    className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                    data-testid={`input-room-name-${index}`}
                    placeholder="Room name"
                  />
                </CardTitle>
                <div className="flex items-center gap-2">
                  {needsSave && (
                    <Button
                      size="sm"
                      onClick={() => saveRoom(index)}
                      disabled={createRoom.isPending || updateRoom.isPending}
                      data-testid={`button-save-room-${index}`}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {createRoom.isPending || updateRoom.isPending ? "Saving..." : "Save"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRoom(index)}
                    disabled={deleteRoom.isPending}
                    data-testid={`button-remove-room-${index}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label htmlFor={`length-${index}`}>Length (ft)</Label>
                    <Input
                      id={`length-${index}`}
                      type="number"
                      step="0.1"
                      value={room.length}
                      onChange={(e) => updateLocalRoom(index, "length", e.target.value)}
                      className="font-mono"
                      data-testid={`input-length-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`width-${index}`}>Width (ft)</Label>
                    <Input
                      id={`width-${index}`}
                      type="number"
                      step="0.1"
                      value={room.width}
                      onChange={(e) => updateLocalRoom(index, "width", e.target.value)}
                      className="font-mono"
                      data-testid={`input-width-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`height-${index}`}>Height (ft)</Label>
                    <Input
                      id={`height-${index}`}
                      type="number"
                      step="0.1"
                      value={room.height}
                      onChange={(e) => updateLocalRoom(index, "height", e.target.value)}
                      className="font-mono"
                      data-testid={`input-height-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Area</Label>
                    <div className="h-10 flex items-center">
                      <span className="font-mono text-2xl font-bold" data-testid={`text-area-${index}`}>
                        {totalArea.toFixed(0)}
                      </span>
                      <span className="text-sm text-muted-foreground ml-1">ft²</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Badge variant="secondary" className="font-mono">
                    Floor: {floorArea.toFixed(0)} ft²
                  </Badge>
                  <Badge variant="secondary" className="font-mono">
                    Walls: {wallArea.toFixed(0)} ft²
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    Paint needed: ~{paintGallons} gallons
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {localRooms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Floor Area</p>
                <p className="text-2xl font-bold font-mono">
                  {localRooms.reduce((sum, room) => sum + calculateArea(room).floorArea, 0).toFixed(0)} ft²
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Wall Area</p>
                <p className="text-2xl font-bold font-mono">
                  {localRooms.reduce((sum, room) => sum + calculateArea(room).wallArea, 0).toFixed(0)} ft²
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paintable Area</p>
                <p className="text-2xl font-bold font-mono">
                  {localRooms.reduce((sum, room) => sum + calculateArea(room).totalArea, 0).toFixed(0)} ft²
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Est. Paint Needed</p>
                <p className="text-2xl font-bold font-mono">
                  {localRooms.reduce((sum, room) => sum + calculatePaintNeeded(calculateArea(room).wallArea), 0)} gal
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </>
  );
}
