import type {
  BrushKindId,
  PixelateModeId,
  ShapeFillId,
  ShapeKindId,
  TextStyleId,
} from "@/components/image-editor/editor-tools";

export interface Point {
  x: number;
  y: number;
}

export type PixelateOp = {
  type: "pixelate";
  x: number;
  y: number;
  w: number;
  h: number;
  mode: PixelateModeId;
  size: number;
};

export type ShapeOp = {
  type: "shape";
  kind: ShapeKindId;
  fill: ShapeFillId;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type TextOp = {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  style: TextStyleId;
};

export type BrushOp = {
  type: "brush";
  points: Point[];
  color: string;
  size: number;
  kind: BrushKindId;
};

export type EditorOp = PixelateOp | ShapeOp | TextOp | BrushOp;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number; w: number; h: number } {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

export function clampRect(
  x: number,
  y: number,
  w: number,
  h: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const left = clamp(Math.round(x), 0, canvasWidth);
  const top = clamp(Math.round(y), 0, canvasHeight);
  const right = clamp(Math.round(x + w), 0, canvasWidth);
  const bottom = clamp(Math.round(y + h), 0, canvasHeight);
  return {
    x: left,
    y: top,
    w: Math.max(0, right - left),
    h: Math.max(0, bottom - top),
  };
}

function applyMosaic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
) {
  const imageData = ctx.getImageData(x, y, w, h);
  const { data } = imageData;
  const block = Math.max(4, Math.round(4 + size * 0.44));

  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      const bw = Math.min(block, w - bx);
      const bh = Math.min(block, h - by);
      const cx = bx + Math.floor(bw / 2);
      const cy = by + Math.floor(bh / 2);
      const sample = (cy * w + cx) * 4;
      const r = data[sample];
      const g = data[sample + 1];
      const b = data[sample + 2];
      const a = data[sample + 3];

      for (let py = by; py < by + bh; py++) {
        for (let px = bx; px < bx + bw; px++) {
          const i = (py * w + px) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
    }
  }

  ctx.putImageData(imageData, x, y);
}

function applyBlur(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
) {
  const radius = Math.max(2, Math.round(size / 4));
  const snapshot = document.createElement("canvas");
  snapshot.width = ctx.canvas.width;
  snapshot.height = ctx.canvas.height;
  const snapCtx = snapshot.getContext("2d");
  if (!snapCtx) {
    return;
  }

  snapCtx.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(snapshot, 0, 0);
  ctx.restore();
}

function drawPixelate(ctx: CanvasRenderingContext2D, op: PixelateOp) {
  const rect = clampRect(op.x, op.y, op.w, op.h, ctx.canvas.width, ctx.canvas.height);
  if (rect.w < 2 || rect.h < 2) {
    return;
  }

  if (op.mode === "mosaic") {
    applyMosaic(ctx, rect.x, rect.y, rect.w, rect.h, op.size);
    return;
  }

  applyBlur(ctx, rect.x, rect.y, rect.w, rect.h, op.size);
}

function strokeStyle(ctx: CanvasRenderingContext2D, color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(12, ctx.lineWidth * 4);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - head * Math.cos(angle - Math.PI / 6),
    y2 - head * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    x2 - head * Math.cos(angle + Math.PI / 6),
    y2 - head * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

function drawShape(ctx: CanvasRenderingContext2D, op: ShapeOp) {
  const highlight = op.fill === "highlight";
  ctx.save();
  strokeStyle(ctx, op.color, highlight ? 6 : 4);
  ctx.globalAlpha = highlight ? 0.4 : 1;

  if (op.kind === "line") {
    ctx.beginPath();
    ctx.moveTo(op.x1, op.y1);
    ctx.lineTo(op.x2, op.y2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (op.kind === "arrow") {
    ctx.beginPath();
    ctx.moveTo(op.x1, op.y1);
    ctx.lineTo(op.x2, op.y2);
    ctx.stroke();
    ctx.globalAlpha = highlight ? 0.7 : 1;
    drawArrowHead(ctx, op.x1, op.y1, op.x2, op.y2);
    ctx.restore();
    return;
  }

  const { x, y, w, h } = normalizeRect(op.x1, op.y1, op.x2, op.y2);

  ctx.beginPath();
  if (op.kind === "ellipse") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.rect(x, y, w, h);
  }

  if (highlight) {
    ctx.fill();
  } else {
    ctx.stroke();
  }

  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, op: TextOp) {
  const fontSize = Math.max(12, Math.round(op.size * 0.9));
  ctx.save();
  ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = "top";
  const metrics = ctx.measureText(op.text);
  const width = metrics.width;
  const height = fontSize * 1.25;
  const padX = 8;
  const padY = 4;

  if (op.style === "block") {
    ctx.fillStyle = op.color;
    ctx.fillRect(op.x - padX, op.y - padY, width + padX * 2, height + padY);
    ctx.fillStyle = op.color === "#eab308" || op.color === "#ffffff" ? "#0f172a" : "#ffffff";
    ctx.fillText(op.text, op.x, op.y);
  } else if (op.style === "highlight") {
    ctx.fillStyle = op.color;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(op.x - 4, op.y, width + 8, height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0f172a";
    ctx.fillText(op.text, op.x, op.y);
  } else {
    ctx.shadowColor = "rgba(15, 23, 42, 0.65)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = op.color;
    ctx.fillText(op.text, op.x, op.y);
  }

  ctx.restore();
}

function drawBrush(ctx: CanvasRenderingContext2D, op: BrushOp) {
  if (op.points.length === 0) {
    return;
  }

  ctx.save();
  const highlighter = op.kind === "highlighter";
  ctx.strokeStyle = op.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = highlighter ? 0.35 : 1;
  ctx.lineWidth = highlighter
    ? Math.max(8, op.size * 0.55)
    : Math.max(2, op.size * 0.28);

  ctx.beginPath();
  ctx.moveTo(op.points[0].x, op.points[0].y);
  if (op.points.length === 1) {
    ctx.lineTo(op.points[0].x + 0.1, op.points[0].y);
  } else {
    for (let i = 1; i < op.points.length; i++) {
      ctx.lineTo(op.points[i].x, op.points[i].y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

export function drawOp(ctx: CanvasRenderingContext2D, op: EditorOp) {
  if (op.type === "pixelate") {
    drawPixelate(ctx, op);
    return;
  }
  if (op.type === "shape") {
    drawShape(ctx, op);
    return;
  }
  if (op.type === "text") {
    drawText(ctx, op);
    return;
  }
  drawBrush(ctx, op);
}

export function renderEditor(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  ops: EditorOp[],
  draft?: EditorOp | null,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(source, 0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const op of ops) {
    drawOp(ctx, op);
  }
  if (draft) {
    drawOp(ctx, draft);
  }
}

export function pointerToCanvas(
  event: Pick<PointerEvent, "clientX" | "clientY">,
  canvas: HTMLCanvasElement,
): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}
