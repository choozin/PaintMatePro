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
  onClose: (status: 'completed' | 'failed' | 'cancelled', payload?: ARScanData | string) => void;
  roundingPreference: 'precise' | '2inch' | '6inch' | '1foot';
}

// ... (rest of imports and interfaces)

export function ARRoomScanner({
  modeToTry,
  onClose,
  roundingPreference,
}: ARRoomScannerProps) {
  // ... (existing state and refs)

  // ... (onSelect function)

  // ... (handleFallback function)

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

      try {
        await rendererRef.current.xr.setSession(session);
      } catch (e: any) {
        throw new Error("setSession failed: " + e.message);
      }

      setIsARActive(true);
      console.log(`✅ AR session started successfully in ${modeToTry} mode`);

      const nextStep = modeToTry === 'hit-test' ? 'scanning' : 'calibrate';
      setCurrentStep(nextStep);
      currentStepRef.current = nextStep;

      controllerRef.current = rendererRef.current.xr.getController(0);
      controllerRef.current.addEventListener('select', onSelect);
      sceneRef.current.add(controllerRef.current);

      session.addEventListener('end', () => setIsARActive(false));

      let frameCount = 0;
      rendererRef.current.setAnimationLoop((timestamp, frame) => {
        frameCount++;
        if (frameCount % 60 === 0) {
          console.log(`Rendering frame ${frameCount}`);
        }

        // Rotate debug cube
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;

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
      const errorMessage = error.message || "Unknown error";
      toast({
        variant: "destructive",
        title: "AR Error",
        description: errorMessage,
        duration: 10000,
      });
      // Delay closing so the user can see the toast
      setTimeout(() => onClose('failed', errorMessage), 3000);
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
                <h2 className="text-lg font-semibold">AR Room Scanner <span className="text-xs text-muted-foreground ml-2">v2.3 Render Debug</span></h2>
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
