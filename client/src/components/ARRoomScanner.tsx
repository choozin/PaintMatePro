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

type ARMode = 'hit-test' | 'plane-detection' | 'pose-based' | 'unsupported';

interface ARCapabilities {
  mode: ARMode;
  features: string[];
}

export function ARRoomScanner({ 
  onClose, 
  onScanComplete,
  roundingPreference,
  roundingDirection 
}: ARRoomScannerProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isARSupported, setIsARSupported] = useState<boolean | null>(null);
  const [arMode, setArMode] = useState<ARMode | null>(null);
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
  const planeDetectionRef = useRef<Set<XRPlane> | null>(null);
  const markerMeshesRef = useRef<THREE.Mesh[]>([]);
  const sessionRef = useRef<XRSession | null>(null);

  // Detect AR capabilities with cascading fallback
  const detectARCapabilities = async (): Promise<ARCapabilities> => {
    if (!('xr' in navigator)) {
      return { mode: 'unsupported', features: [] };
    }

    const xr = (navigator as any).xr;
    
    // Check basic AR support first
    const isARSupported = await xr.isSessionSupported('immersive-ar').catch(() => false);
    if (!isARSupported) {
      return { mode: 'unsupported', features: [] };
    }

    // Try hit-test (best option)
    try {
      const testSession = await xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test']
      });
      await testSession.end();
      console.log('✅ Hit-test supported');
      return { mode: 'hit-test', features: ['hit-test'] };
    } catch (e) {
      console.log('⚠️ Hit-test not supported, trying plane-detection...');
    }

    // Try plane-detection (second best)
    try {
      const testSession = await xr.requestSession('immersive-ar', {
        requiredFeatures: ['plane-detection']
      });
      await testSession.end();
      console.log('✅ Plane-detection supported');
      return { mode: 'plane-detection', features: ['plane-detection'] };
    } catch (e) {
      console.log('⚠️ Plane-detection not supported, using pose-based...');
    }

    // Pose-based works on any AR-capable device
    console.log('✅ Using pose-based mode');
    return { mode: 'pose-based', features: [] };
  };

  // Check AR support on mount
  useEffect(() => {
    detectARCapabilities().then((capabilities) => {
      setArMode(capabilities.mode);
      setIsARSupported(capabilities.mode !== 'unsupported');
      console.log('AR Mode:', capabilities.mode, 'Features:', capabilities.features);
    });

    // Cleanup on unmount
    return () => {
      if (rendererRef.current) {
        const session = rendererRef.current.xr.getSession();
        if (session) {
          session.end().catch(() => {});
        }
        rendererRef.current.setAnimationLoop(null);
      }
    };
  }, []);

  const startARSession = async () => {
    if (!containerRef.current || !arMode) return;

    console.log(`🎥 Starting AR session in ${arMode} mode...`);

    try {
      // Create Three.js scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
      );
      cameraRef.current = camera;

      // Add lighting
      const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
      light.position.set(0.5, 1, 0.25);
      scene.add(light);

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;
      rendererRef.current = renderer;

      containerRef.current.appendChild(renderer.domElement);

      // Create reticle (target marker)
      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      );
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);
      reticleRef.current = reticle;

      // Start AR session based on detected mode
      let sessionConfig: any = {};
      if (arMode === 'hit-test') {
        sessionConfig.requiredFeatures = ['hit-test'];
      } else if (arMode === 'plane-detection') {
        sessionConfig.requiredFeatures = ['plane-detection'];
      }
      // pose-based mode needs no special features
      
      const session = await (navigator as any).xr.requestSession('immersive-ar', sessionConfig);
      sessionRef.current = session;
      console.log(`✅ AR session created in ${arMode} mode`);

      await renderer.xr.setSession(session);
      setIsARActive(true);
      
      // For pose-based and plane-detection modes, need calibration step first
      if (arMode === 'pose-based' || arMode === 'plane-detection') {
        setCurrentStep('calibrate');
      } else {
        setCurrentStep('corners');
      }

      // Setup controller for tap events
      const controller = renderer.xr.getController(0);
      controller.addEventListener('select', onARTap);
      scene.add(controller);

      // Handle session end
      session.addEventListener('end', () => {
        setIsARActive(false);
        hitTestSourceRef.current = null;
        if (containerRef.current && renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement);
        }
      });

      // Start animation loop
      renderer.setAnimationLoop((timestamp, frame) => {
        if (frame) {
          handleARFrame(frame, renderer, scene, camera, reticle);
        }
        renderer.render(scene, camera);
      });

    } catch (error: any) {
      console.error('❌ AR session failed:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Full error:', JSON.stringify(error, null, 2));
      
      let errorMessage = "Failed to start AR session. ";
      
      if (error.name === 'NotAllowedError') {
        errorMessage += "Please allow camera access and try again.";
      } else if (error.name === 'NotSupportedError') {
        errorMessage += "Your device doesn't support the 'hit-test' AR feature. We'll add a fallback mode soon!";
      } else if (error.name === 'SecurityError') {
        errorMessage += "AR requires a secure connection (HTTPS).";
      } else {
        errorMessage += error.message || "Please try again.";
      }
      
      toast({
        variant: "destructive",
        title: "AR Error",
        description: errorMessage,
      });
      
      // Reset to initial state
      setCurrentStep('name');
      setIsARActive(false);
    }
  };

  const handleARFrame = (
    frame: XRFrame,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    reticle: THREE.Mesh
  ) => {
    const session = renderer.xr.getSession();
    if (!session) return;

    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!referenceSpace) return;

    // Only do hit-testing in hit-test mode
    if (arMode === 'hit-test') {
      // Request hit test source once
      if (!hitTestSourceRef.current && session.requestHitTestSource) {
        session.requestReferenceSpace('viewer').then((viewerSpace) => {
          if (viewerSpace && session.requestHitTestSource) {
            // Explicitly assert the type of requestHitTestSource
            const requestHitTestSource = session.requestHitTestSource as (options: XRHitTestOptionsInit) => Promise<XRHitTestSource>;
            requestHitTestSource({ space: viewerSpace }).then((source: any) => {
              hitTestSourceRef.current = source;
            }).catch(() => {});
          }
        }).catch(() => {});
      }

      // Perform hit test
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
      // Hide reticle in other modes
      reticle.visible = false;
    }
  };

  const onARTap = () => {
    if (!sceneRef.current || !cameraRef.current) return;

    let position: THREE.Vector3;

    // Get position based on AR mode
    if (arMode === 'hit-test' && reticleRef.current?.visible) {
      // Hit-test mode: use reticle position
      position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      reticleRef.current.matrix.decompose(position, quaternion, scale);
    } else if (arMode === 'plane-detection' || arMode === 'pose-based') {
      // Plane-detection and pose-based modes: ray-plane intersection
      if (currentStep === 'calibrate' && !floorPlane) {
        // First tap - calibrate floor plane at center of view
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);
        
        // Assume floor is 1.6m below camera (average eye height)
        const cameraPos = cameraRef.current.position;
        const floorY = cameraPos.y - 1.6;
        
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
        // Subsequent taps - use calibrated plane
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), cameraRef.current);
        const intersect = raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
        if (!intersect) return;
        position = intersect;
      } else {
        return;
      }
    } else {
      // No valid position source
      return;
    }

    // Add corner marker
    const markerGeometry = new THREE.SphereGeometry(0.05);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(position);
    sceneRef.current.add(marker);
    markerMeshesRef.current.push(marker);

    // Add to corners array - use functional setState to avoid stale closure
    const newCorner: Point3D = {
      x: position.x,
      y: position.y,
      z: position.z,
    };
    
    setCorners(prev => {
      const updatedCorners = [...prev, newCorner];
      
      // Check if we have enough corners for a rectangular room
      if (updatedCorners.length === 4) {
        completeScanning(updatedCorners);
      }
      
      return updatedCorners;
    });
  };

  const completeScanning = (allCorners: Point3D[]) => {
    if (allCorners.length !== 4 || !ceilingHeight) return;
    
    // Calculate length and width from the 4 corners
    const dist1 = calculateDistance(allCorners[0], allCorners[1]);
    const dist2 = calculateDistance(allCorners[1], allCorners[2]);
    const dist3 = calculateDistance(allCorners[2], allCorners[3]);
    const dist4 = calculateDistance(allCorners[3], allCorners[0]);

    // Average opposite sides for length and width
    const lengthMeters = (dist1 + dist3) / 2;
    const widthMeters = (dist2 + dist4) / 2;
    
    const lengthFeet = metersToFeet(lengthMeters);
    const widthFeet = metersToFeet(widthMeters);
    const heightFeet = parseFloat(ceilingHeight);

    // Apply rounding
    const roundedLength = applyRounding(lengthFeet, roundingPreference, roundingDirection);
    const roundedWidth = applyRounding(widthFeet, roundingPreference, roundingDirection);
    const roundedHeight = applyRounding(heightFeet, roundingPreference, roundingDirection);

    // Calculate confidence based on measurement consistency
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

    // End AR session
    if (rendererRef.current) {
      rendererRef.current.xr.getSession()?.end();
    }
  };

  const handleNextStep = () => {
    if (currentStep === 'name' && roomName) {
      setCurrentStep('height');
    } else if (currentStep === 'height' && ceilingHeight) {
      startARSession();
    }
  };

  if (isARSupported === false || arMode === 'unsupported') {
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
              <p className="text-sm font-medium">Required Features:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>WebXR Device API (immersive-ar)</li>
                <li>Hit-testing OR Plane-detection OR Pose tracking</li>
                <li>Camera access</li>
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

  if (isARSupported === null) {
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
                    onClick={handleNextStep} 
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
                      onClick={handleNextStep} 
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
