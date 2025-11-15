import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import * as THREE from "three";
import { applyRounding, calculateDistance, metersToFeet } from "@/lib/arMeasurement";

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

interface Point3D {
  x: number;
  y: number;
  z: number;
}

import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import * as THREE from "three";
import { applyRounding, calculateDistance, metersToFeet } from "@/lib/arMeasurement";

interface ARRoomScannerProps {
  projectId: string;
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

type ARMode = 'hit-test' | 'plane-detection' | 'pose-based' | 'unsupported';
const ALL_MODES: ARMode[] = ['hit-test', 'plane-detection', 'pose-based'];

export function ARRoomScanner({
  onClose,
  roundingPreference,
}: ARRoomScannerProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentModeIndex, setCurrentModeIndex] = useState(0);
  const [arMode, setArMode] = useState<ARMode | null>(null);
  const [startupError, setStartupError] = useState<{ title: string, message: string } | null>(null);

  const [isCheckingSupport, setIsCheckingSupport] = useState(true);
  const [isARActive, setIsARActive] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [ceilingHeight, setCeilingHeight] = useState("");
  const [corners, setCorners] = useState<Point3D[]>([]);
  const [currentStep, setCurrentStep] = useState<'name' | 'height' | 'scanning' | 'calibrate'>('name');
  const [floorPlane, setFloorPlane] = useState<THREE.Plane | null>(null);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const markerMeshesRef = useRef<THREE.Mesh[]>([]);
  const sessionRef = useRef<XRSession | null>(null);

  useEffect(() => {
    if ('xr' in navigator) {
      (navigator as any).xr.isSessionSupported('immersive-ar')
        .then((supported: boolean) => {
          if (!supported) {
            onClose('failed');
          }
          setIsCheckingSupport(false);
        })
        .catch(() => onClose('failed'));
    } else {
      onClose('failed');
    }
    return () => {
      sessionRef.current?.end().catch(() => {});
    };
  }, [onClose]);

  const startAR = async () => {
    const modeToTry = ALL_MODES[currentModeIndex];
    if (!modeToTry || !containerRef.current) return;

    console.log(`🎥 Attempting to start AR with mode: ${modeToTry}`);
    setStartupError(null);

    try {
      if (!rendererRef.current) {
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        cameraRef.current = camera;
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
        light.position.set(0.5, 1, 0.25);
        scene.add(light);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        rendererRef.current = renderer;
        containerRef.current.appendChild(renderer.domElement);

        const reticle = new THREE.Mesh(
          new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);
        reticleRef.current = reticle;
      }
      
      const renderer = rendererRef.current;
      let sessionConfig: XRSessionInit = { requiredFeatures: [] };
      if (modeToTry === 'hit-test') sessionConfig.requiredFeatures = ['hit-test'];
      if (modeToTry === 'plane-detection') sessionConfig.requiredFeatures = ['plane-detection'];
      
      const session = await (navigator as any).xr.requestSession('immersive-ar', sessionConfig);
      sessionRef.current = session;
      
      await renderer.xr.setSession(session);
      
      setArMode(modeToTry);
      setIsARActive(true);
      console.log(`✅ AR session started successfully in ${modeToTry} mode`);

      setCurrentStep(modeToTry === 'hit-test' ? 'scanning' : 'calibrate');

      const controller = renderer.xr.getController(0);
      controller.addEventListener('select', onARTap);
      sceneRef.current.add(controller);

      session.addEventListener('end', () => {
        setIsARActive(false);
        hitTestSourceRef.current = null;
        if (containerRef.current && renderer.domElement) {
          try { containerRef.current.removeChild(renderer.domElement); } catch (e) {}
        }
        rendererRef.current = null;
      });

      renderer.setAnimationLoop((timestamp, frame) => {
        if (frame && sceneRef.current && cameraRef.current && reticleRef.current) {
          handleARFrame(frame, renderer, sceneRef.current, cameraRef.current, reticleRef.current);
        }
        if (sceneRef.current && cameraRef.current) {
          renderer.render(sceneRef.current, cameraRef.current);
        }
      });

    } catch (error: any) {
      console.warn(`⚠️ Mode '${modeToTry}' failed:`, error.message);
      if (error.name === 'NotSupportedError') {
        if (currentModeIndex < ALL_MODES.length - 1) {
          setStartupError({
            title: `Mode Not Supported`,
            message: `'${modeToTry}' is not available on your device.`,
          });
        } else {
          onClose('failed');
        }
      } else {
        let message = "Please allow camera access and try again.";
        if (error.name !== 'NotAllowedError') message = error.message || "An unknown error occurred.";
        setStartupError({ title: "AR Error", message });
      }
    }
  };

  const handleTryNextMode = () => {
    setCurrentModeIndex(prev => prev + 1);
    startAR();
  };

  const handleARFrame = (frame: XRFrame, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, reticle: THREE.Mesh) => {
    const session = sessionRef.current;
    if (!session || !referenceSpace) return;
    const referenceSpace = renderer.xr.getReferenceSpace();

    if (arMode === 'hit-test') {
      if (!hitTestSourceRef.current && session.requestHitTestSource) {
        session.requestReferenceSpace('viewer').then(viewerSpace => {
          if (viewerSpace) session.requestHitTestSource({ space: viewerSpace })?.then(source => {
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
    } else {
      reticle.visible = false;
    }
  };

  const onARTap = () => {
    if (!sceneRef.current || !cameraRef.current) return;
    let position: THREE.Vector3 | null = null;

    if (arMode === 'hit-test' && reticleRef.current?.visible) {
      position = new THREE.Vector3();
      reticleRef.current.matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
    } else if (arMode === 'plane-detection' || arMode === 'pose-based') {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);

      if (currentStep === 'calibrate' && !floorPlane) {
        const cameraPos = new THREE.Vector3();
        cameraRef.current.getWorldPosition(cameraPos);
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
    sceneRef.current.add(marker);
    markerMeshesRef.current.push(marker);

    const newCorner: Point3D = { x: position.x, y: position.y, z: position.z };
    setCorners(prev => {
      const updatedCorners = [...prev, newCorner];
      if (updatedCorners.length === 4) completeScanning(updatedCorners);
      return updatedCorners;
    });
  };

  const completeScanning = (allCorners: Point3D[]) => {
    if (allCorners.length !== 4 || !ceilingHeight) return;
    const dists = [
      calculateDistance(allCorners[0], allCorners[1]),
      calculateDistance(allCorners[1], allCorners[2]),
      calculateDistance(allCorners[2], allCorners[3]),
      calculateDistance(allCorners[3], allCorners[0])
    ];
    const lengthMeters = (dists[0] + dists[2]) / 2;
    const widthMeters = (dists[1] + dists[3]) / 2;
    const confidence = Math.max(0, 1 - (Math.abs(dists[0] - dists[2]) / lengthMeters + Math.abs(dists[1] - dists[3]) / widthMeters) / 2);

    onClose('completed', {
      name: roomName || "Scanned Room",
      length: applyRounding(metersToFeet(lengthMeters), roundingPreference, 'up'),
      width: applyRounding(metersToFeet(widthMeters), roundingPreference, 'up'),
      height: applyRounding(parseFloat(ceilingHeight), roundingPreference, 'up'),
      measurementMethod: 'camera',
      confidence,
    });
    sessionRef.current?.end();
  };

  const handleInitialNext = () => {
    if (currentStep === 'name' && roomName) setCurrentStep('height');
    else if (currentStep === 'height' && ceilingHeight) startAR();
  };

  if (isCheckingSupport) {
    return <div className="fixed inset-0 z-50 bg-background flex items-center justify-center"><p>Checking AR support...</p></div>;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div ref={containerRef} className="absolute inset-0" />

      {!isARActive && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">AR Room Scanner</h2>
                <Button variant="ghost" size="icon" onClick={() => onClose('cancelled')}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {startupError ? (
                <div className="text-center space-y-4">
                  <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
                  <h3 className="font-semibold">{startupError.title}</h3>
                  <p className="text-sm text-muted-foreground">{startupError.message}</p>
                  <div className="flex flex-col gap-2">
                    <Button onClick={handleTryNextMode}>Try Next Mode ({ALL_MODES[currentModeIndex + 1]})</Button>
                    <Button variant="outline" onClick={() => onClose('failed')}>Use Manual Entry</Button>
                  </div>
                </div>
              ) : currentStep === 'name' ? (
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
              <><p className="text-lg font-semibold">Tap {['first', 'second', 'third', 'fourth'][corners.length]} corner</p><p className="text-sm">{arMode === 'hit-test' ? 'Aim the green reticle at each corner and tap. ' : 'Point camera at each corner and tap. '}{corners.length}/4 corners marked.</p></>
            )}
          </div>
        </div>
      )}
    </div>
  );
}  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [arMode, setArMode] = useState<ARMode | null>(null);
  const [arCompletelyUnsupported, setArCompletelyUnsupported] = useState(false);
  const [isCheckingSupport, setIsCheckingSupport] = useState(true);
  const [isARActive, setIsARActive] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [ceilingHeight, setCeilingHeight] = useState("");
  const [corners, setCorners] = useState<Point3D[]>([]);
  const [currentStep, setCurrentStep] = useState<'name' | 'height' | 'corners' | 'calibrate' | 'complete'>('name');
  const [floorPlane, setFloorPlane] = useState<THREE.Plane | null>(null);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const markerMeshesRef = useRef<THREE.Mesh[]>([]);
  const sessionRef = useRef<XRSession | null>(null);

  // On component mount, check for basic WebXR support.
  useEffect(() => {
    if ('xr' in navigator) {
      (navigator as any).xr.isSessionSupported('immersive-ar')
        .then((supported: boolean) => {
          if (!supported) {
            setArCompletelyUnsupported(true);
          }
          setIsCheckingSupport(false);
        })
        .catch(() => {
          setArCompletelyUnsupported(true);
          setIsCheckingSupport(false);
        });
    } else {
      setArCompletelyUnsupported(true);
      setIsCheckingSupport(false);
    }

    // Cleanup on unmount
    return () => {
      sessionRef.current?.end().catch(() => {});
    };
  }, []);

  const startAR = async (modesToTry: ARMode[]) => {
    if (modesToTry.length === 0) {
      console.error("❌ All AR modes failed.");
      setArCompletelyUnsupported(true);
      setIsARActive(false);
      toast({
        variant: "destructive",
        title: "AR Not Supported",
        description: "Your device does not support any of the available AR modes.",
      });
      return;
    }
    
    const currentMode = modesToTry[0];
    const remainingModes = modesToTry.slice(1);
    console.log(`🎥 Attempting to start AR with mode: ${currentMode}`);

    if (!containerRef.current) return;

    try {
      // Create scene, camera, renderer etc. only on the first attempt
      if (!rendererRef.current) {
        const scene = new THREE.Scene();
        sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        cameraRef.current = camera;
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
        light.position.set(0.5, 1, 0.25);
        scene.add(light);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        rendererRef.current = renderer;
        containerRef.current.appendChild(renderer.domElement);

        const reticle = new THREE.Mesh(
          new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);
        reticleRef.current = reticle;
      }
      
      const renderer = rendererRef.current;

      let sessionConfig: XRSessionInit = { requiredFeatures: [] };
      if (currentMode === 'hit-test') {
        sessionConfig.requiredFeatures = ['hit-test'];
      } else if (currentMode === 'plane-detection') {
        sessionConfig.requiredFeatures = ['plane-detection'];
      }
      
      const session = await (navigator as any).xr.requestSession('immersive-ar', sessionConfig);
      sessionRef.current = session;
      
      await renderer.xr.setSession(session);
      
      // Success!
      setArMode(currentMode);
      setIsARActive(true);
      console.log(`✅ AR session started successfully in ${currentMode} mode`);

      if (currentMode === 'pose-based' || currentMode === 'plane-detection') {
        setCurrentStep('calibrate');
      } else {
        setCurrentStep('corners');
      }

      const controller = renderer.xr.getController(0);
      controller.addEventListener('select', onARTap);
      sceneRef.current.add(controller);

      session.addEventListener('end', () => {
        setIsARActive(false);
        hitTestSourceRef.current = null;
        if (containerRef.current && renderer.domElement) {
          try {
            containerRef.current.removeChild(renderer.domElement);
          } catch (e) {
            // Ignore error if element is already gone
          }
        }
        rendererRef.current = null; // Clean up renderer
      });

      renderer.setAnimationLoop((timestamp, frame) => {
        if (frame && sceneRef.current && cameraRef.current && reticleRef.current) {
          handleARFrame(frame, renderer, sceneRef.current, cameraRef.current, reticleRef.current);
        }
        if (sceneRef.current && cameraRef.current) {
          renderer.render(sceneRef.current, cameraRef.current);
        }
      });

    } catch (error: any) {
      console.warn(`⚠️ Mode '${currentMode}' failed:`, error.message);
      
      if (error.name === 'NotSupportedError') {
        toast({
          title: `AR Mode Not Supported`,
          description: `'${currentMode}' is not available. Trying next option...`,
        });
        // Recursively try the next mode
        await startAR(remainingModes);
      } else {
        // Handle other errors like permission denied
        let errorMessage = "Failed to start AR session. ";
        if (error.name === 'NotAllowedError') {
          errorMessage += "Please allow camera access and try again.";
        } else {
          errorMessage += error.message || "An unknown error occurred.";
        }
        toast({ variant: "destructive", title: "AR Error", description: errorMessage });
        setArCompletelyUnsupported(true); // Bail out on non-support errors
        setIsARActive(false);
      }
    }
  };

  const handleARFrame = (
    frame: XRFrame,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    reticle: THREE.Mesh
  ) => {
    const session = sessionRef.current;
    if (!session) return;

    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!referenceSpace) return;

    if (arMode === 'hit-test') {
      if (!hitTestSourceRef.current && session.requestHitTestSource) {
        session.requestReferenceSpace('viewer').then((viewerSpace) => {
          if (viewerSpace && session.requestHitTestSource) {
            session.requestHitTestSource({ space: viewerSpace }).then((source) => {
              hitTestSourceRef.current = source;
            }).catch(() => {});
          }
        }).catch(() => {});
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
    } else {
      reticle.visible = false;
    }
  };

  const onARTap = () => {
    if (!sceneRef.current || !cameraRef.current) return;

    let position: THREE.Vector3;

    if (arMode === 'hit-test' && reticleRef.current?.visible) {
      position = new THREE.Vector3();
      reticleRef.current.matrix.decompose(position, new THREE.Quaternion(), new THREE.Vector3());
    } else if (arMode === 'plane-detection' || arMode === 'pose-based') {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);

      if (currentStep === 'calibrate' && !floorPlane) {
        const cameraPos = new THREE.Vector3();
        cameraRef.current.getWorldPosition(cameraPos);
        const floorY = cameraPos.y - 1.6; // Assume floor is 1.6m below camera
        const calibratedPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY);
        setFloorPlane(calibratedPlane);
        
        const intersect = raycaster.ray.intersectPlane(calibratedPlane, new THREE.Vector3());
        if (!intersect) return;
        position = intersect;
        
        setCurrentStep('corners');
        toast({
          title: "Floor Calibrated",
          description: "Now tap the four corners of the room",
        });
      } else if (floorPlane) {
        const intersect = raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
        if (!intersect) return;
        position = intersect;
      } else {
        return;
      }
    } else {
      return;
    }

    const markerGeometry = new THREE.SphereGeometry(0.05);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(position);
    sceneRef.current.add(marker);
    markerMeshesRef.current.push(marker);

    const newCorner: Point3D = { x: position.x, y: position.y, z: position.z };
    
    setCorners(prev => {
      const updatedCorners = [...prev, newCorner];
      if (updatedCorners.length === 4) {
        completeScanning(updatedCorners);
      }
      return updatedCorners;
    });
  };

  const completeScanning = (allCorners: Point3D[]) => {
    if (allCorners.length !== 4 || !ceilingHeight) return;
    
    const dist1 = calculateDistance(allCorners[0], allCorners[1]);
    const dist2 = calculateDistance(allCorners[1], allCorners[2]);
    const dist3 = calculateDistance(allCorners[2], allCorners[3]);
    const dist4 = calculateDistance(allCorners[3], allCorners[0]);

    const lengthMeters = (dist1 + dist3) / 2;
    const widthMeters = (dist2 + dist4) / 2;
    
    const lengthFeet = metersToFeet(lengthMeters);
    const widthFeet = metersToFeet(widthMeters);
    const heightFeet = parseFloat(ceilingHeight);

    const roundedLength = applyRounding(lengthFeet, roundingPreference, 'up');
    const roundedWidth = applyRounding(widthFeet, roundingPreference, 'up');
    const roundedHeight = applyRounding(heightFeet, roundingPreference, 'up');

    const lengthDiff = Math.abs(dist1 - dist3) / lengthMeters;
    const widthDiff = Math.abs(dist2 - dist4) / widthMeters;
    const confidence = Math.max(0, 1 - (lengthDiff + widthDiff) / 2);

    onScanComplete({
      name: roomName || "Scanned Room",
      length: roundedLength,
      width: roundedWidth,
      height: roundedHeight,
      measurementMethod: 'camera',
      confidence,
    });

    sessionRef.current?.end();
  };

  const handleStartScanning = () => {
    if (currentStep === 'name' && roomName) {
      setCurrentStep('height');
    } else if (currentStep === 'height' && ceilingHeight) {
      // This is where the new recursive process kicks off
      startAR(['hit-test', 'plane-detection', 'pose-based']);
    }
  };

  if (arCompletelyUnsupported) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">Camera Scanning Not Available</p>
              <p className="text-sm text-muted-foreground">
                Your device doesn't support the AR features needed for camera-based room measurement.
              </p>
            </div>
            
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium">Common Reasons:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>You are not on a secure (HTTPS) connection</li>
                <li>Your browser or device does not support WebXR</li>
                <li>Camera permissions were denied</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">No worries!</p>
              <p className="text-xs text-muted-foreground">
                You can still use our excellent quote generator. Simply measure your room using a ruler or tape measure and enter the dimensions manually.
              </p>
            </div>

            <Button onClick={onClose} className="w-full">
              Continue with Manual Entry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCheckingSupport) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Checking AR support...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* AR Canvas Container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* UI Overlay */}
      {!isARActive && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">AR Room Scanner</h2>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {currentStep === 'name' && (
                <>
                  <div className="space-y-2">
                    <Label>Room Name</Label>
                    <Input
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="e.g., Living Room"
                      data-testid="input-ar-room-name"
                    />
                  </div>
                  <Button 
                    onClick={handleStartScanning} 
                    disabled={!roomName}
                    className="w-full"
                  >
                    Next
                  </Button>
                </>
              )}

              {currentStep === 'height' && (
                <>
                  <div className="space-y-2">
                    <Label>Ceiling Height (ft)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={ceilingHeight}
                      onChange={(e) => setCeilingHeight(e.target.value)}
                      placeholder="e.g., 9"
                      data-testid="input-ar-ceiling-height"
                    />
                    <p className="text-sm text-muted-foreground">
                      Measure from floor to ceiling for accurate calculations
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentStep('name')}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button 
                      onClick={handleStartScanning} 
                      disabled={!ceilingHeight}
                      className="flex-1"
                    >
                      Start Scanning
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AR Instructions */}
      {isARActive && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
          <div className="max-w-md mx-auto text-center space-y-2">
            {currentStep === 'calibrate' && (
              <>
                <p className="text-lg font-semibold">Calibrate Floor Level</p>
                <p className="text-sm">Point camera at the floor and tap anywhere to set the floor plane</p>
              </>
            )}
            {currentStep === 'corners' && (
              <>
                <p className="text-lg font-semibold">
                  Tap {corners.length === 0 ? 'first' : corners.length === 1 ? 'second' : corners.length === 2 ? 'third' : 'fourth'} corner
                </p>
                <p className="text-sm">
                  {arMode === 'hit-test' && 'Aim the green reticle at each corner and tap. '}
                  {(arMode === 'plane-detection' || arMode === 'pose-based') && 'Point camera at each corner and tap. '}
                  {corners.length}/4 corners marked.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

