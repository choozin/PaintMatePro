import React, { useRef, useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Eraser, Check } from "lucide-react";

interface SignaturePadProps {
    onSave: (signatureData: string) => void;
    onCancel: () => void;
}

export function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size to match parent width
        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = 200; // Fixed height
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#000000';
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        setHasSignature(true);

        const { x, y } = getCoordinates(e, canvas);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoordinates(e, canvas);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
    };

    return (
        <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white touch-none">
                <canvas
                    ref={canvasRef}
                    className="w-full h-[200px] cursor-crosshair rounded-lg"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>
            <div className="flex justify-between">
                <Button variant="outline" onClick={clear} disabled={!hasSignature}>
                    <Eraser className="h-4 w-4 mr-2" />
                    Clear
                </Button>
                <div className="space-x-2">
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!hasSignature}>
                        <Check className="h-4 w-4 mr-2" />
                        Accept Signature
                    </Button>
                </div>
            </div>
        </div>
    );
}
