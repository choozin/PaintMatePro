import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ruler, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface Room {
  id: string;
  name: string;
  length: string;
  width: string;
  height: string;
}

export function RoomMeasurement() {
  const [rooms, setRooms] = useState<Room[]>([
    { id: "1", name: "Living Room", length: "15", width: "12", height: "9" },
  ]);

  const addRoom = () => {
    const newRoom: Room = {
      id: Date.now().toString(),
      name: `Room ${rooms.length + 1}`,
      length: "",
      width: "",
      height: "",
    };
    setRooms([...rooms, newRoom]);
    console.log('Add room triggered');
  };

  const removeRoom = (id: string) => {
    setRooms(rooms.filter((r) => r.id !== id));
    console.log('Remove room triggered', id);
  };

  const updateRoom = (id: string, field: keyof Room, value: string) => {
    setRooms(
      rooms.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const calculateArea = (room: Room) => {
    const length = parseFloat(room.length) || 0;
    const width = parseFloat(room.width) || 0;
    const height = parseFloat(room.height) || 0;
    
    const floorArea = length * width;
    const wallArea = 2 * (length + width) * height;
    const totalArea = floorArea + wallArea;
    
    return { floorArea, wallArea, totalArea };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          <h2 className="text-2xl font-semibold">Room Measurements</h2>
        </div>
        <Button onClick={addRoom} data-testid="button-add-room">
          <Plus className="h-4 w-4 mr-2" />
          Add Room
        </Button>
      </div>

      <div className="grid gap-6">
        {rooms.map((room, index) => {
          const { floorArea, wallArea, totalArea } = calculateArea(room);
          
          return (
            <Card key={room.id} data-testid={`card-room-${room.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-lg">
                  <Input
                    value={room.name}
                    onChange={(e) => updateRoom(room.id, "name", e.target.value)}
                    className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
                    data-testid={`input-room-name-${room.id}`}
                  />
                </CardTitle>
                {rooms.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRoom(room.id)}
                    data-testid={`button-remove-room-${room.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="space-y-2">
                    <Label htmlFor={`length-${room.id}`}>Length (ft)</Label>
                    <Input
                      id={`length-${room.id}`}
                      type="number"
                      value={room.length}
                      onChange={(e) => updateRoom(room.id, "length", e.target.value)}
                      className="font-mono"
                      data-testid={`input-length-${room.id}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`width-${room.id}`}>Width (ft)</Label>
                    <Input
                      id={`width-${room.id}`}
                      type="number"
                      value={room.width}
                      onChange={(e) => updateRoom(room.id, "width", e.target.value)}
                      className="font-mono"
                      data-testid={`input-width-${room.id}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`height-${room.id}`}>Height (ft)</Label>
                    <Input
                      id={`height-${room.id}`}
                      type="number"
                      value={room.height}
                      onChange={(e) => updateRoom(room.id, "height", e.target.value)}
                      className="font-mono"
                      data-testid={`input-height-${room.id}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Area</Label>
                    <div className="h-10 flex items-center">
                      <span className="font-mono text-2xl font-bold" data-testid={`text-area-${room.id}`}>
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
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
