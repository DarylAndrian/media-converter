"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { DropZone } from "@/components/DropZone";
import { EditorCanvas, fitCanvasSize } from "@/components/image-editor/EditorCanvas";
import type { EditorOp } from "@/components/image-editor/draw-ops";
import {
  BRUSH_KINDS,
  EDITOR_COLORS,
  EDITOR_TOOLS,
  PIXELATE_MODES,
  SHAPE_FILLS,
  SHAPE_KINDS,
  TEXT_STYLES,
  editorColorHex,
  type BrushKindId,
  type EditorColorId,
  type EditorToolId,
  type PixelateModeId,
  type ShapeFillId,
  type ShapeKindId,
  type TextStyleId,
} from "@/components/image-editor/editor-tools";
import { canvasToBlob } from "@/lib/browser-image";
import { downloadBlob } from "@/lib/download";
import { Button } from "@/components/Button";

interface EditorMockupProps {
  file: File | null;
  previewUrl: string | null;
  onFilesChange: (files: File[]) => void;
  onClear: () => void;
}

type HistoryState = {
  ops: EditorOp[];
  future: EditorOp[];
};

type HistoryAction =
  | { type: "commit"; op: EditorOp }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "commit":
      return { ops: [...state.ops, action.op], future: [] };
    case "undo": {
      if (state.ops.length === 0) {
        return state;
      }
      const op = state.ops[state.ops.length - 1];
      return { ops: state.ops.slice(0, -1), future: [op, ...state.future] };
    }
    case "redo": {
      if (state.future.length === 0) {
        return state;
      }
      return {
        ops: [...state.ops, state.future[0]],
        future: state.future.slice(1),
      };
    }
    case "reset":
      return { ops: [], future: [] };
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ToolIcon({ tool }: { tool: EditorToolId }) {
  const className = "h-5 w-5";

  if (tool === "pixelate") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
        <rect x="2" y="2" width="4" height="4" rx="0.5" />
        <rect x="8" y="2" width="4" height="4" rx="0.5" opacity="0.55" />
        <rect x="14" y="2" width="4" height="4" rx="0.5" />
        <rect x="2" y="8" width="4" height="4" rx="0.5" opacity="0.55" />
        <rect x="8" y="8" width="4" height="4" rx="0.5" />
        <rect x="14" y="8" width="4" height="4" rx="0.5" opacity="0.55" />
        <rect x="2" y="14" width="4" height="4" rx="0.5" />
        <rect x="8" y="14" width="4" height="4" rx="0.5" opacity="0.55" />
        <rect x="14" y="14" width="4" height="4" rx="0.5" />
      </svg>
    );
  }

  if (tool === "shape") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
        <rect
          x="3"
          y="4"
          width="14"
          height="12"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.75"
        />
      </svg>
    );
  }

  if (tool === "text") {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
        <path d="M5 4.5h10v2H11.25V16h-2.5V6.5H5v-2Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M4 16c2.2-1.1 3.4-3.4 5.8-8.2.5-1 1.6-1.5 2.7-1.2l.4.1c1.2.4 1.6 1.9.8 2.9C11.2 13 8.8 15 4 16Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12.2 6.2 14.8 3.6a1.2 1.2 0 0 1 1.7 1.7l-2.6 2.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChipGroup<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1">
      {items.map((item) => {
        const selected = item.id === value;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selected
                ? "bg-accent text-on-accent"
                : "text-mut hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ColorDots({
  value,
  onChange,
}: {
  value: EditorColorId;
  onChange: (id: EditorColorId) => void;
}) {
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label="Color">
      {EDITOR_COLORS.map((color) => {
        const selected = color.id === value;

        return (
          <button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.id}
            onClick={() => onChange(color.id)}
            className={`h-7 w-7 rounded-full transition ${
              selected ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "hover:scale-105"
            } ${color.border ? "border border-line" : ""}`}
            style={{ backgroundColor: color.hex }}
          />
        );
      })}
    </div>
  );
}

function SizeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex min-w-[160px] flex-1 items-center gap-3">
      <span className="shrink-0 text-xs font-medium text-mut">{label}</span>
      <input
        type="range"
        min={1}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer accent-accent"
      />
      <span className="w-8 text-right text-xs font-medium tabular-nums text-mut">
        {value}
      </span>
    </label>
  );
}

function OptionRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-4">{children}</div>
  );
}

const TOOL_HINTS: Record<EditorToolId, string> = {
  pixelate: "Drag a rectangle to mosaic or blur that area.",
  shape: "Drag to draw a rectangle, ellipse, line, or arrow.",
  text: "Click the photo, type, then press Enter.",
  brush: "Drag to draw with a pen or highlighter.",
};

export function EditorMockup({
  file,
  previewUrl,
  onFilesChange,
  onClear,
}: EditorMockupProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textDraftRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    value: string;
  } | null>(null);

  const [tool, setTool] = useState<EditorToolId>("pixelate");
  const [pixelateMode, setPixelateMode] = useState<PixelateModeId>("mosaic");
  const [pixelateSize, setPixelateSize] = useState(24);
  const [shapeKind, setShapeKind] = useState<ShapeKindId>("rect");
  const [shapeFill, setShapeFill] = useState<ShapeFillId>("highlight");
  const [shapeColor, setShapeColor] = useState<EditorColorId>("yellow");
  const [textColor, setTextColor] = useState<EditorColorId>("white");
  const [textSize, setTextSize] = useState(32);
  const [textStyle, setTextStyle] = useState<TextStyleId>("regular");
  const [brushKind, setBrushKind] = useState<BrushKindId>("pen");
  const [brushColor, setBrushColor] = useState<EditorColorId>("red");
  const [brushSize, setBrushSize] = useState(12);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [textDraft, setTextDraft] = useState<{
    x: number;
    y: number;
    left: number;
    top: number;
    value: string;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [history, dispatch] = useReducer(historyReducer, { ops: [], future: [] });

  textDraftRef.current = textDraft;

  useEffect(() => {
    dispatch({ type: "reset" });
    setTextDraft(null);
    setImage(null);
    setCanvasSize({ width: 0, height: 0 });

    if (!previewUrl) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImage(img);
      setCanvasSize(fitCanvasSize(img.naturalWidth, img.naturalHeight));
    };
    img.src = previewUrl;
  }, [previewUrl]);

  const commitTextDraft = useCallback(
    (draft: typeof textDraft) => {
      if (!draft) {
        return;
      }

      const value = draft.value.trim();
      if (value) {
        dispatch({
          type: "commit",
          op: {
            type: "text",
            x: draft.x,
            y: draft.y,
            text: value,
            color: editorColorHex(textColor),
            size: textSize,
            style: textStyle,
          },
        });
      }
    },
    [textColor, textSize, textStyle],
  );

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) {
      return;
    }

    setDownloading(true);
    try {
      const blob = await canvasToBlob(canvas, "image/png");
      const stem = file.name.replace(/\.[^.]+$/, "") || "image";
      downloadBlob(blob, `${stem}-edited.png`);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }

      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) {
        return;
      }

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        dispatch({ type: "undo" });
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        dispatch({ type: "redo" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const canEdit = Boolean(file && image);
  const canUndo = history.ops.length > 0;
  const canRedo = history.future.length > 0;
  const cssScale =
    canvasRef.current && canvasSize.height > 0
      ? canvasRef.current.getBoundingClientRect().height / canvasSize.height
      : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {file ? file.name : "No image selected"}
          </p>
          <p className="font-mono text-xs text-mut">
            {file
              ? formatFileSize(file.size)
              : "Upload a photo, then annotate it in the browser."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!canUndo}
            onClick={() => dispatch({ type: "undo" })}
          >
            Undo
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!canRedo}
            onClick={() => dispatch({ type: "redo" })}
          >
            Redo
          </Button>
          <Button size="sm" disabled={!canEdit || downloading} onClick={handleDownload}>
            {downloading ? "Downloading..." : "Download"}
          </Button>
          {file && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-mut">{TOOL_HINTS[tool]}</p>

      <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl bg-[#171614] dark:border dark:border-line sm:min-h-[440px]">
        {previewUrl && image && canvasSize.width > 0 ? (
          <div className="relative inline-block max-h-[440px] max-w-full">
            <EditorCanvas
              ref={canvasRef}
              source={image}
              width={canvasSize.width}
              height={canvasSize.height}
              ops={history.ops}
              tool={tool}
              settings={{
                pixelateMode,
                pixelateSize,
                shapeKind,
                shapeFill,
                shapeColor: editorColorHex(shapeColor),
                textColor: editorColorHex(textColor),
                textSize,
                textStyle,
                brushKind,
                brushColor: editorColorHex(brushColor),
                brushSize,
              }}
              onCommit={(op) => dispatch({ type: "commit", op })}
              onRequestText={(point, css) => {
                commitTextDraft(textDraftRef.current);
                setTextDraft({
                  x: point.x,
                  y: point.y,
                  left: css.left,
                  top: css.top,
                  value: "",
                });
              }}
            />
            {textDraft && (
              <input
                autoFocus
                value={textDraft.value}
                onChange={(event) =>
                  setTextDraft({ ...textDraft, value: event.target.value })
                }
                onBlur={() => {
                  commitTextDraft(textDraftRef.current);
                  setTextDraft(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    textDraftRef.current = null;
                    setTextDraft(null);
                  }
                }}
                placeholder="Type here"
                className="absolute z-10 min-w-[8rem] rounded-md border border-white/70 bg-slate-900/70 px-2 py-1 font-semibold text-white outline-none placeholder:text-white/50"
                style={{
                  left: textDraft.left,
                  top: textDraft.top,
                  color: editorColorHex(textColor),
                  fontSize: Math.max(14, textSize * 0.9 * cssScale),
                }}
              />
            )}
          </div>
        ) : (
          <div className="w-full p-4 sm:p-6">
            <DropZone
              files={[]}
              onFilesChange={onFilesChange}
              accept={{
                "image/jpeg": [".jpg", ".jpeg"],
                "image/png": [".png"],
                "image/webp": [".webp"],
                "image/gif": [".gif"],
                "image/bmp": [".bmp"],
              }}
              dropLabel="Drag and drop a photo here"
              activeDropLabel="Drop to start editing"
              hintLabel="or click to browse. JPG, PNG, WebP, GIF, and BMP."
            />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3">
        {tool === "pixelate" && (
          <OptionRow>
            <ChipGroup
              items={PIXELATE_MODES}
              value={pixelateMode}
              onChange={setPixelateMode}
            />
            <SizeSlider
              label={pixelateMode === "mosaic" ? "Block size" : "Blur"}
              value={pixelateSize}
              onChange={setPixelateSize}
            />
          </OptionRow>
        )}

        {tool === "shape" && (
          <OptionRow>
            <ChipGroup items={SHAPE_KINDS} value={shapeKind} onChange={setShapeKind} />
            <ChipGroup items={SHAPE_FILLS} value={shapeFill} onChange={setShapeFill} />
            <ColorDots value={shapeColor} onChange={setShapeColor} />
          </OptionRow>
        )}

        {tool === "text" && (
          <OptionRow>
            <ChipGroup items={TEXT_STYLES} value={textStyle} onChange={setTextStyle} />
            <ColorDots value={textColor} onChange={setTextColor} />
            <SizeSlider label="Size" value={textSize} onChange={setTextSize} />
          </OptionRow>
        )}

        {tool === "brush" && (
          <OptionRow>
            <ChipGroup items={BRUSH_KINDS} value={brushKind} onChange={setBrushKind} />
            <ColorDots value={brushColor} onChange={setBrushColor} />
            <SizeSlider label="Size" value={brushSize} onChange={setBrushSize} />
          </OptionRow>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {EDITOR_TOOLS.map((item) => {
          const selected = item.id === tool;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                commitTextDraft(textDraftRef.current);
                setTextDraft(null);
                setTool(item.id);
              }}
              className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-xs font-semibold transition ${
                selected
                  ? "bg-accent text-on-accent"
                  : "bg-surface-2 text-mut hover:bg-line hover:text-ink"
              }`}
            >
              <ToolIcon tool={item.id} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
