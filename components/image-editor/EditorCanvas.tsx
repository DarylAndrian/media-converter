"use client";

import { forwardRef, useEffect, useRef, type PointerEvent } from "react";
import {
  drawOp,
  normalizeRect,
  pointerToCanvas,
  renderEditor,
  type EditorOp,
  type Point,
} from "@/components/image-editor/draw-ops";
import type {
  BrushKindId,
  EditorToolId,
  PixelateModeId,
  ShapeFillId,
  ShapeKindId,
  TextStyleId,
} from "@/components/image-editor/editor-tools";

export interface EditorToolSettings {
  pixelateMode: PixelateModeId;
  pixelateSize: number;
  shapeKind: ShapeKindId;
  shapeFill: ShapeFillId;
  shapeColor: string;
  textColor: string;
  textSize: number;
  textStyle: TextStyleId;
  brushKind: BrushKindId;
  brushColor: string;
  brushSize: number;
}

interface EditorCanvasProps {
  source: CanvasImageSource;
  width: number;
  height: number;
  ops: EditorOp[];
  tool: EditorToolId;
  settings: EditorToolSettings;
  onCommit: (op: EditorOp) => void;
  onRequestText: (point: Point, css: { left: number; top: number }) => void;
}

const MAX_EDGE = 4096;

export function fitCanvasSize(width: number, height: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export const EditorCanvas = forwardRef<HTMLCanvasElement, EditorCanvasProps>(
  function EditorCanvas(
    {
      source,
      width,
      height,
      ops,
      tool,
      settings,
      onCommit,
      onRequestText,
    },
    forwardedRef,
  ) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const committedRef = useRef<HTMLCanvasElement | null>(null);
  const dragStartRef = useRef<Point | null>(null);
  const draftRef = useRef<EditorOp | null>(null);
  const settingsRef = useRef(settings);
  const toolRef = useRef(tool);
  const onCommitRef = useRef(onCommit);
  const onRequestTextRef = useRef(onRequestText);

  settingsRef.current = settings;
  toolRef.current = tool;
  onCommitRef.current = onCommit;
  onRequestTextRef.current = onRequestText;

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    view.width = width;
    view.height = height;

    if (!committedRef.current) {
      committedRef.current = document.createElement("canvas");
    }
    const committed = committedRef.current;
    committed.width = width;
    committed.height = height;

    const committedCtx = committed.getContext("2d");
    const viewCtx = view.getContext("2d");
    if (!committedCtx || !viewCtx) {
      return;
    }

    renderEditor(committedCtx, source, ops);
    viewCtx.clearRect(0, 0, width, height);
    viewCtx.drawImage(committed, 0, 0);
  }, [source, width, height, ops]);

  const paintDraft = (draft: EditorOp | null) => {
    const view = viewRef.current;
    const committed = committedRef.current;
    const viewCtx = view?.getContext("2d");
    if (!view || !committed || !viewCtx) {
      return;
    }

    viewCtx.clearRect(0, 0, view.width, view.height);
    viewCtx.drawImage(committed, 0, 0);
    if (draft) {
      drawOp(viewCtx, draft);
    }
  };

  const makeRectOp = (start: Point, current: Point): EditorOp => {
    const currentSettings = settingsRef.current;
    const currentTool = toolRef.current;
    const rect = normalizeRect(start.x, start.y, current.x, current.y);

    if (currentTool === "pixelate") {
      return {
        type: "pixelate",
        ...rect,
        mode: currentSettings.pixelateMode,
        size: currentSettings.pixelateSize,
      };
    }

    return {
      type: "shape",
      kind: currentSettings.shapeKind,
      fill: currentSettings.shapeFill,
      color: currentSettings.shapeColor,
      x1: start.x,
      y1: start.y,
      x2: current.x,
      y2: current.y,
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = viewRef.current;
    if (!canvas) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerToCanvas(event.nativeEvent, canvas);
    const currentTool = toolRef.current;
    const currentSettings = settingsRef.current;

    if (currentTool === "text") {
      const rect = canvas.getBoundingClientRect();
      onRequestTextRef.current(point, {
        left: (point.x / canvas.width) * rect.width,
        top: (point.y / canvas.height) * rect.height,
      });
      return;
    }

    dragStartRef.current = point;

    if (currentTool === "brush") {
      draftRef.current = {
        type: "brush",
        points: [point],
        color: currentSettings.brushColor,
        size: currentSettings.brushSize,
        kind: currentSettings.brushKind,
      };
      paintDraft(draftRef.current);
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = viewRef.current;
    const start = dragStartRef.current;
    if (!canvas || !start) {
      return;
    }

    const point = pointerToCanvas(event.nativeEvent, canvas);
    const currentTool = toolRef.current;

    if (currentTool === "brush") {
      const draft = draftRef.current;
      if (draft?.type !== "brush") {
        return;
      }
      draft.points.push(point);
      paintDraft(draft);
      return;
    }

    if (currentTool === "pixelate" || currentTool === "shape") {
      const draft = makeRectOp(start, point);
      draftRef.current = draft;
      paintDraft(draft);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = viewRef.current;
    const start = dragStartRef.current;
    dragStartRef.current = null;

    if (!canvas || !start) {
      draftRef.current = null;
      return;
    }

    const point = pointerToCanvas(event.nativeEvent, canvas);
    const currentTool = toolRef.current;
    let op = draftRef.current;
    draftRef.current = null;

    if (currentTool === "brush") {
      if (op?.type === "brush" && op.points.length > 0) {
        onCommitRef.current(op);
      } else {
        paintDraft(null);
      }
      return;
    }

    if (currentTool === "pixelate" || currentTool === "shape") {
      op = makeRectOp(start, point);
      const distance = Math.hypot(point.x - start.x, point.y - start.y);
      if (distance < 4) {
        paintDraft(null);
        return;
      }
      onCommitRef.current(op);
    }
  };

  return (
    <canvas
      ref={(node) => {
        viewRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      }}
      className="max-h-[440px] max-w-full cursor-crosshair touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
  },
);
