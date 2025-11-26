import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import * as THREE from "three";
import { applyRounding, calculateDistance, metersToFeet } from "@/lib/arMeasurement";
import { Browser } from "@capacitor/browser";

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

  // Refs for Three.js objects to persist across renders
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sessionRef = useRef<XRSession | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const controllerRef = useRef<THREE.XRTargetRaySpace | null>(null);

  // Refs for state accessed in callbacks to avoid stale closures
  const currentStepRef = useRef<'name' | 'height' | 'scanning' | 'calibrate'>('name');
  const floorPlaneRef = useRef<THREE.Plane | null>(null);

  const [isARActive, setIsARActive] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [ceilingHeight, setCeilingHeight] = useState("");
  const [corners, setCorners] = useState<Point3D[]>([]);
  const [currentStep, setCurrentStep] = useState<'name' | 'height' | 'scanning' | 'calibrate'>('name');
  const [floorPlane, setFloorPlane] = useState<THREE.Plane | null>(null);

  // Keep refs in sync with state
  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { floorPlaneRef.current = floorPlane; }, [floorPlane]);

  const onSelect = () => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const reticle = reticleRef.current;
    const currentStepVal = currentStepRef.current;
    const floorPlaneVal = floorPlaneRef.current;

    if (!scene || !camera) return;
    let position: THREE.Vector3 | null = null;

    if (modeToTry === 'hit-test' && reticle?.visible) {
      position = new THREE.Vector3();
      reticle.matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
    } else if (modeToTry === 'plane-detection' || modeToTry === 'pose-based') {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

      if (currentStepVal === 'calibrate' && !floorPlaneVal) {
        const cameraPos = new THREE.Vector3();
        camera.getWorldPosition(cameraPos);
        const floorY = cameraPos.y - 1.6;
        const calibratedPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY);

        // Update both state and ref
        setFloorPlane(calibratedPlane);
        floorPlaneRef.current = calibratedPlane;

        position = raycaster.ray.intersectPlane(calibratedPlane, new THREE.Vector3());

        setCurrentStep('scanning');
        currentStepRef.current = 'scanning';

        toast({ title: "Floor Calibrated", description: "Now tap the four corners of the room" });
      } else if (floorPlaneVal) {
        position = raycaster.ray.intersectPlane(floorPlaneVal, new THREE.Vector3());
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
        sessionRef.current?.end();
      }
      return updatedCorners;
    });
  };

  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => setDebugLog(prev => [...prev, `${new Date().toISOString().split('T')[1].slice(0, 8)}: ${msg}`]);

  const handleFallback = async () => {
    const url = window.location.href;
    addLog(`Attempting fallback...`);
    addLog(`URL: ${url}`);

    toast({
      variant: "destructive",
      title: "AR Not Supported in App",
      description: "Opening in browser for AR support...",
    });

    // Small delay to let the toast show
    setTimeout(async () => {
      try {
        addLog(`Calling Browser.open...`);
        await Browser.open({ url });
        addLog(`Browser.open called successfully`);
        onClose('cancelled');
      } catch (e: any) {
        addLog(`ERROR: ${e.message}`);
        console.error("Browser open failed", e);
      }
    }, 1500);
  };

  const runAR = async () => {
    if (!canvasRef.current) return;

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

      // Initialize Three.js objects
      sceneRef.current = new THREE.Scene();
      cameraRef.current = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
      const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
      light.position.set(0.5, 1, 0.25);
      sceneRef.current.add(light);

      rendererRef.current = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
      rendererRef.current.setPixelRatio(window.devicePixelRatio);
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      rendererRef.current.xr.enabled = true;

      reticleRef.current = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      );
      reticleRef.current.matrixAutoUpdate = false;
      reticleRef.current.visible = false;
      sceneRef.current.add(reticleRef.current);

      toast({ title: "AR Debug", description: "Requesting Session..." });

      // Add a timeout to detect hangs
      const sessionPromise = (navigator as any).xr.requestSession('immersive-ar', {
        requiredFeatures: [modeToTry],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body }
      });

      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Session request timed out")), 5000));

      const session = await Promise.race([sessionPromise, timeoutPromise]) as XRSession;
      sessionRef.current = session;

      toast({ title: "AR Debug", description: "Session Started!" });
      await rendererRef.current.xr.setSession(session);

      setIsARActive(true);
      console.log(`✅ AR session started successfully in ${modeToTry} mode`);

      const nextStep = modeToTry === 'hit-test' ? 'scanning' : 'calibrate';
      setCurrentStep(nextStep);
      currentStepRef.current = nextStep;

      controllerRef.current = rendererRef.current.xr.getController(0);
      controllerRef.current.addEventListener('select', onSelect);
      sceneRef.current.add(controllerRef.current);

      session.addEventListener('end', () => setIsARActive(false));

      rendererRef.current.setAnimationLoop((timestamp, frame) => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const reticle = reticleRef.current;
        const session = sessionRef.current;

        if (frame && renderer && scene && camera && reticle && session) {
          const referenceSpace = renderer.xr.getReferenceSpace();
          if (!referenceSpace) return;

          if (modeToTry === 'hit-test') {
            if (!hitTestSourceRef.current && session?.requestHitTestSource) {
              session.requestReferenceSpace('viewer').then(viewerSpace => {
                if (viewerSpace && session) session.requestHitTestSource({ space: viewerSpace })?.then(source => {
                  hitTestSourceRef.current = source;
                });
              });
            }
            if (hitTestSourceRef.current) {
              const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
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
        if (scene && camera && renderer) {
          renderer.render(scene, camera);
        }
      });

    } catch (error: any) {
      console.error(`AR session failed for mode '${modeToTry}':`, error);
      onClose('failed');
    }
  };

  useEffect(() => {
    return () => {
      const controller = controllerRef.current;
      const session = sessionRef.current;
      const renderer = rendererRef.current;

      controller?.removeEventListener('select', onSelect);
      session?.end().catch(e => console.error("Session end error:", e));
      renderer?.dispose();
    };
  }, []);

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
                <h2 className="text-lg font-semibold">AR Room Scanner <span className="text-xs text-muted-foreground ml-2">v1.8 Import Fixed</span></h2>
                <Button variant="ghost" size="icon" onClick={() => onClose('cancelled')}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Debug Info Area */}
              <div className="bg-slate-100 p-2 rounded text-xs font-mono break-all max-h-32 overflow-y-auto">
                <p className="font-bold text-slate-700">Debug Log:</p>
                {debugLog.map((log, i) => (
                  <div key={i} className="border-b border-slate-200 py-1">{log}</div>
                ))}
              </div>

              {currentStep === 'name' ? (
                <>
                  <div className="space-y-2"><Label>Room Name</Label><Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="e.g., Living Room" /></div>
                  <Button onClick={handleInitialNext} disabled={!roomName} className="w-full">Next</Button>
                </>
              ) : currentStep === 'height' ? (
                <>
                  <div className="space-y-2"><Label>Ceiling Height (ft)</Label><Input type="number" step="0.1" value={ceilingHeight} onChange={(e) => setCeilingHeight(e.target.value)} placeholder="e.g., 9" /><p className="text-sm text-muted-foreground">Measure from floor to ceiling for accuracy</p></div>
                  <div className="flex gap-2"><Button variant="outline" onClick={() => setCurrentStep('name')} className="flex-1">Back</Button><Button onClick={handleInitialNext} disabled={!ceilingHeight} className="flex-1">Next</Button></div>
                </>
              ) : currentStep === 'scanning' ? (
                <div className="space-y-4 text-center">
                  <p className="text-muted-foreground">Ready to start scanning. Ensure your room is well-lit.</p>
                  <Button onClick={runAR} size="lg" className="w-full">Start AR Session</Button>
                </div>
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
