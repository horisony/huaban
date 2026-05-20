// Drawing canvas — pointer events, undo/redo, brush + eraser, capture for AI.
import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

const DrawingCanvas = forwardRef(function DrawingCanvas(props, ref) {
  const { color, size, mode, boardBg, onStrokeEnd, onStrokeStart, dpr = 2 } = props;
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef({
    drawing: false,
    last: null,
    history: [],     // ImageData stack
    redoStack: [],
    strokeStartedAt: 0,
    strokeBounds: null,
  });
  const [hasInk, setHasInk] = useState(false);

  // Resize / setup — sync backup avoids flash + async race that could wipe strokes
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const lastSize = { w: 0, h: 0 };
    let rafId = 0;

    const setup = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(200, Math.floor(rect.width));
      const h = Math.max(200, Math.floor(rect.height));
      if (w === lastSize.w && h === lastSize.h) return;

      let backup = null;
      if (canvas.width > 0 && canvas.height > 0) {
        backup = document.createElement('canvas');
        backup.width = canvas.width;
        backup.height = canvas.height;
        backup.getContext('2d').drawImage(canvas, 0, 0);
      }

      lastSize.w = w;
      lastSize.h = h;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (backup) {
        ctx.drawImage(backup, 0, 0, backup.width, backup.height, 0, 0, w, h);
      }
    };

    const scheduleSetup = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(setup);
    };

    scheduleSetup();
    const ro = new ResizeObserver(scheduleSetup);
    ro.observe(container);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [dpr]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches?.[0] || e.changedTouches?.[0] || e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const snapshot = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  };

  const restore = (img) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(img, 0, 0);
  };

  const checkHasInk = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // Sample every 40th pixel for speed
    for (let i = 3; i < data.length; i += 160) {
      if (data[i] > 5) return true;
    }
    return false;
  }, []);

  const start = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const s = stateRef.current;
    s.history.push(snapshot());
    if (s.history.length > 30) s.history.shift();
    s.redoStack = [];
    s.drawing = true;
    const p = getPos(e);
    s.last = p;
    s.strokeStartedAt = Date.now();
    s.strokeBounds = { minX: p.x, maxX: p.x, minY: p.y, maxY: p.y };
    ctx.save();
    if (mode === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = size * 2.2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.globalAlpha = 1;
      ctx.lineWidth = size;
    }
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // Dot for taps
    ctx.lineTo(p.x + 0.01, p.y + 0.01);
    ctx.stroke();
    onStrokeStart && onStrokeStart();
  };

  const move = (e) => {
    const s = stateRef.current;
    if (!s.drawing) return;
    e.preventDefault();
    const p = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(s.last.x, s.last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    s.last = p;
    if (s.strokeBounds) {
      s.strokeBounds.minX = Math.min(s.strokeBounds.minX, p.x);
      s.strokeBounds.maxX = Math.max(s.strokeBounds.maxX, p.x);
      s.strokeBounds.minY = Math.min(s.strokeBounds.minY, p.y);
      s.strokeBounds.maxY = Math.max(s.strokeBounds.maxY, p.y);
    }
  };

  const end = (e) => {
    const s = stateRef.current;
    if (!s.drawing) return;
    s.drawing = false;
    const canvas = canvasRef.current;
    canvas.getContext('2d').restore();
    setHasInk(checkHasInk());
    onStrokeEnd && onStrokeEnd({ bounds: s.strokeBounds, duration: Date.now() - s.strokeStartedAt });
  };

  useImperativeHandle(ref, () => ({
    undo: () => {
      const s = stateRef.current;
      if (!s.history.length) return;
      s.redoStack.push(snapshot());
      const img = s.history.pop();
      restore(img);
      setHasInk(checkHasInk());
    },
    redo: () => {
      const s = stateRef.current;
      if (!s.redoStack.length) return;
      s.history.push(snapshot());
      const img = s.redoStack.pop();
      restore(img);
      setHasInk(checkHasInk());
    },
    clear: () => {
      const s = stateRef.current;
      s.history.push(snapshot());
      if (s.history.length > 30) s.history.shift();
      s.redoStack = [];
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      setHasInk(false);
    },
    hasInk: () => checkHasInk(),
    // Get a small base64 PNG for AI / gallery
    capture: (maxDim = 280) => {
      const canvas = canvasRef.current;
      const w = canvas.width, h = canvas.height;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const tw = Math.max(32, Math.floor(w * scale));
      const th = Math.max(32, Math.floor(h * scale));
      const off = document.createElement('canvas');
      off.width = tw;
      off.height = th;
      const octx = off.getContext('2d');
      // Composite over the board background so AI sees real contrast
      octx.fillStyle = boardBg || '#2d4a3e';
      octx.fillRect(0, 0, tw, th);
      octx.drawImage(canvas, 0, 0, tw, th);
      return off.toDataURL('image/png');
    },
    // Get a coarse ASCII-ish representation for text-only AI fallback.
    getInkGrid: (cols = 24, rows = 18) => {
      const canvas = canvasRef.current;
      const off = document.createElement('canvas');
      off.width = cols;
      off.height = rows;
      const octx = off.getContext('2d');
      // Composite on board color so colored chalk is visible in the grid
      octx.fillStyle = boardBg || '#27433a';
      octx.fillRect(0, 0, cols, rows);
      octx.drawImage(canvas, 0, 0, cols, rows);
      const data = octx.getImageData(0, 0, cols, rows).data;
      let grid = '';
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // Chalk on dark board: bright strokes with some alpha
          grid += a > 25 && lum > 55 ? '#' : '.';
        }
        grid += '\n';
      }
      return grid;
    },
    loadDataURL: (url) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        setHasInk(checkHasInk());
      };
      img.src = url;
    },
    hasInkState: () => hasInk,
  }), [hasInk, checkHasInk, boardBg]);

  return (
    <div ref={containerRef} className="canvas-host" style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className="draw-canvas"
        style={{ display: 'block', touchAction: 'none', cursor: mode === 'eraser' ? 'cell' : 'crosshair' }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
    </div>
  );
});

export default DrawingCanvas;
