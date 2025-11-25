import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import * as THREE from "three";
import { applyRounding, calculateDistance, metersToFeet } from "@/lib/arMeasurement";

export type ARMode = 'hit-test' | 'plane-detection' | 'pose-based';

interface ARRoomScannerProps {
  modeToTry: ARMode;
  onClose: (status: 'completed' | 'failed' | 'cancelled', data?: ARScanData) => void;
  roundingPreference: 'precise' | '2inch' | '6inch' | '1foot';
}

export interface ARScanData {
  name: string;
  length: number;
  width: number;
  height: number;
  measurementMethod: 'camera';
  confidence: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function ARRoomScanner({
  modeToTry,
  onClose,
  roundingPreference,
}: ARRoomScannerProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isARActive, setIsARActive] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [ceilingHeight, setCeilingHeight] = useState("");
  const [corners, setCorners] = useState<Point3D[]>([]);
  const [currentStep, setCurrentStep] = useState<'name' | 'height' | 'scanning' | 'calibrate'>('name');
  const [floorPlane, setFloorPlane] = useState<THREE.Plane | null>(null);

  useEffect(() => {
    let renderer: THREE.WebGLRenderer | null = null;
    let session: XRSession | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let reticle: THREE.Mesh | null = null;
    let hitTestSource: XRHitTestSource | null = null;
    let controller: THREE.XRTargetRaySpace | null = null;

    const onSelect = () => {
      if (!scene || !camera) return;
      let position: THREE.Vector3 | null = null;

      if (modeToTry === 'hit-test' && reticle?.visible) {
        position = new THREE.Vector3();
        reticle.matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
      } else if (modeToTry === 'plane-detection' || modeToTry === 'pose-based') {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

        if (currentStep === 'calibrate' && !floorPlane) {
          const cameraPos = new THREE.Vector3();
          camera.getWorldPosition(cameraPos);
          const floorY = cameraPos.y - 1.6;
          const calibratedPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY);
          setFloorPlane(calibratedPlane);
          position = raycaster.ray.intersectPlane(calibratedPlane, new THREE.Vector3());
          setCurrentStep('scanning');
          toast({ title: "Floor Calibrated", description: "Now tap the four corners of the room" });
        } else if (floorPlane) {
          position = raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
        }
      }

      if (!position) return;

      const marker = new THREE.Mesh(new THREE.SphereGeometry(0.05), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      marker.position.copy(position);
      scene.add(marker);

      const newCorner: Point3D = { x: position.x, y: position.y, z: position.z };
      setCorners(prev => {
        const updatedCorners = [...prev, newCorner];
        if (updatedCorners.length === 4) {
          if (!ceilingHeight) return updatedCorners;
          const dists = [
            calculateDistance(updatedCorners[0], updatedCorners[1]),
            calculateDistance(updatedCorners[1], updatedCorners[2]),
          ];
          const lengthMeters = dists[0];
          const widthMeters = dists[1];
          const confidence = 1.0; // Placeholder

          onClose('completed', {
            name: roomName || "Scanned Room",
            length: applyRounding(metersToFeet(lengthMeters), roundingPreference, 'up'),
            width: applyRounding(metersToFeet(widthMeters), roundingPreference, 'up'),
            height: applyRounding(parseFloat(ceilingHeight), roundingPreference, 'up'),
            measurementMethod: 'camera',
            confidence,
          });
          session?.end();
        }
        return updatedCorners;
      });
    };

    const handleFallback = () => {
      toast({
        variant: "destructive",
        title: "AR Not Supported in App",
        description: "Opening in browser for AR support...",
      });

      // Small delay to let the toast show
      setTimeout(() => {
        const url = window.location.href;
        window.open(url, '_system');
        onClose('cancelled');
      }, 1500);
    };

    const runAR = async () => {
      if (currentStep !== 'scanning' || !canvasRef.current) {
        return;
      }

      if (!('xr' in navigator)) {
        console.error("WebXR not supported");
        handleFallback();
        return;
      }

      console.log(`🎥 Attempting to start AR with mode: ${modeToTry}`);
      toast({ title: "AR Debug", description: "Checking XR support..." });

      try {
        const isSupported = await (navigator as any).xr.isSessionSupported('immersive-ar');
        toast({ title: "AR Debug", description: `XR Supported: ${isSupported}` });

        if (!isSupported) {
          handleFallback();
          return;
        }

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
        light.position.set(0.5, 1, 0.25);
        scene.add(light);

        renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;

        reticle = new THREE.Mesh(
          new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);

        toast({ title: "AR Debug", description: "Requesting Session..." });

        // Add a timeout to detect hangs
        const sessionPromise = (navigator as any).xr.requestSession('immersive-ar', {
          requiredFeatures: [modeToTry],
          optionalFeatures: ['dom-overlay'],
          domOverlay: { root: document.body }
        });

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Session request timed out")), 5000));

        session = await Promise.race([sessionPromise, timeoutPromise]) as XRSession;

        toast({ title: "AR Debug", description: "Session Started!" });
        await renderer.xr.setSession(session);

        setIsARActive(true);
        console.log(`✅ AR session started successfully in ${modeToTry} mode`);
        setCurrentStep(modeToTry === 'hit-test' ? 'scanning' : 'calibrate');

        controller = renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
        scene.add(controller);

        session.addEventListener('end', () => setIsARActive(false));

        renderer.setAnimationLoop((timestamp, frame) => {
          if (frame && renderer && scene && camera && reticle && session) {
            const referenceSpace = renderer.xr.getReferenceSpace();
            if (!referenceSpace) return;

            if (modeToTry === 'hit-test') {
              if (!hitTestSource && session?.requestHitTestSource) {
                session.requestReferenceSpace('viewer').then(viewerSpace => {
                  if (viewerSpace && session) session.requestHitTestSource({ space: viewerSpace })?.then(source => {
                    hitTestSource = source;
                  });
                });
              }
              if (hitTestSource) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);
                if (hitTestResults.length > 0) {
                  const hit = hitTestResults[0];
                  const pose = hit.getPose(referenceSpace);
                  if (pose) {
                    reticle.visible = true;
                    reticle.matrix.fromArray(pose.transform.matrix);
                  }
                } else {
                  reticle.visible = false;
                }
              }
            }
          }
          if (scene && camera) {
            renderer?.render(scene, camera);
          }
        });

      } catch (error: any) {
        console.error(`AR session failed for mode '${modeToTry}':`, error);
        onClose('failed');
      }
    };

    runAR();

    return () => {
      controller?.removeEventListener('select', onSelect);
      session?.end().catch(e => console.error("Session end error:", e));
      renderer?.dispose();
    };
  }, [currentStep]);

  const handleInitialNext = () => {
    if (currentStep === 'name' && roomName) {
      setCurrentStep('height');
    } else if (currentStep === 'height' && ceilingHeight) {
      setCurrentStep('scanning');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="absolute inset-0">
        <canvas ref={canvasRef} />
      </div>

      {!isARActive && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">AR Room Scanner <span className="text-xs text-muted-foreground ml-2">v1.2 Fallback</span></h2>
                <Button variant="ghost" size="icon" onClick={() => onClose('cancelled')}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {currentStep === 'name' ? (
                <>
                  <div className="space-y-2"><Label>Room Name</Label><Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="e.g., Living Room" /></div>
                  <Button onClick={handleInitialNext} disabled={!roomName} className="w-full">Next</Button>
                </>
              ) : currentStep === 'height' ? (
                <>
                  <div className="space-y-2"><Label>Ceiling Height (ft)</Label><Input type="number" step="0.1" value={ceilingHeight} onChange={(e) => setCeilingHeight(e.target.value)} placeholder="e.g., 9" /><p className="text-sm text-muted-foreground">Measure from floor to ceiling for accuracy</p></div>
                  <div className="flex gap-2"><Button variant="outline" onClick={() => setCurrentStep('name')} className="flex-1">Back</Button><Button onClick={handleInitialNext} disabled={!ceilingHeight} className="flex-1">Start Scanning</Button></div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      {isARActive && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
          <div className="max-w-md mx-auto text-center space-y-2">
            {currentStep === 'calibrate' ? (
              <><p className="text-lg font-semibold">Calibrate Floor Level</p><p className="text-sm">Point camera at the floor and tap anywhere to set the floor plane</p></>
            ) : (
              <><p className="text-lg font-semibold">Tap {['first', 'second', 'third', 'fourth'][corners.length]} corner</p><p className="text-sm">{modeToTry === 'hit-test' ? 'Aim the green reticle at each corner and tap. ' : 'Point camera at each corner and tap. '}{corners.length}/4 corners marked.</p></>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
