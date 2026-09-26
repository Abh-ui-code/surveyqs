"use client";

/**
 * A drawn signature — plain Canvas 2D + Pointer Events, no dependency
 * (avoids `react-signature-canvas`/`signature_pad` for one small drawing
 * surface, the same call a sibling field app's web signature pad makes).
 * Always a white background regardless of theme: this is a mark that may
 * end up printed/exported, and needs to read the same on paper as it does
 * in either color scheme.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  /** `data:image/png;base64,...` */
  toBase64: () => string;
}

interface SignaturePadProps {
  height?: number;
  className?: string;
}

export const SignaturePad = React.forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { height = 180, className },
  ref,
) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const hasStrokes = React.useRef(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0f172a";
  }, []);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokes.current = true;
  }

  function stopDrawing() {
    drawing.current = false;
  }

  React.useImperativeHandle(ref, () => ({
    isEmpty: () => !hasStrokes.current,
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasStrokes.current = false;
    },
    toBase64: () => canvasRef.current?.toDataURL("image/png") ?? "",
  }));

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrawing}
      onPointerLeave={stopDrawing}
      style={{ height, width: "100%", touchAction: "none" }}
      className={cn("rounded-md border border-line bg-white", className)}
    />
  );
});
