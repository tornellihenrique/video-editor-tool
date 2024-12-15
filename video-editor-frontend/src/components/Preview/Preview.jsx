import { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import {
  PreviewContainer,
  VideoElement,
  CanvasContainer,
  CropCanvas,
  VideoCanvas,
} from './styles';

function Preview({
  videoRef,
  videoUrl,
  scenes,
  setCurrentTime,
  duration,
  aspectRatio,
  resolution,
  virtualResolution,
  isFinalResultMode,
}) {
  const canvasRef = useRef(null);
  const cropPreviewRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastDrawnTimeRef = useRef(0);
  const canvasContainerRef = useRef(null);
  const scenesRef = useRef(scenes);

  const [videoDimensions, setVideoDimensions] = useState({
    width: 0,
    height: 0,
  });

  // UI zoom states: these do not affect final configs, just a visual help.
  const [cropPreviewZoom, setCropPreviewZoom] = useState(1.0);
  const [finalCanvasZoom, setFinalCanvasZoom] = useState(1.0);

  // Drag state for final rectangle interaction
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null); // 'move-final', 'scale-final'
  const [activeHandle, setActiveHandle] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialState, setInitialState] = useState(null);

  const updateScene = useEditorStore(state => state.updateScene);

  useEffect(() => {
    scenesRef.current = scenes;
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      const { scene: activeScene } = getActiveScene();
      drawCanvas(activeScene);
      drawCropPreview(activeScene);
    }
  }, [scenes]);

  const getActiveScene = () => {
    const video = videoRef.current;
    if (!video) return { scene: null, index: -1 };
    const index = scenesRef.current.findIndex(
      scene =>
        video.currentTime >= scene.start && video.currentTime <= scene.end,
    );
    return { scene: scenesRef.current[index] || null, index };
  };

  function computeFinalOutputRect(scene) {
    const { scale, position } = scene;
    const [resW, resH] = resolution.split('x').map(Number);
    const [vResW, vResH] = virtualResolution.split('x').map(Number);

    // final width/height in input video coords after scale:
    const finalW = resW / scale;
    const finalH = resH / scale;

    // finalX, finalY are offset in input video coords:
    const finalX = -((position.x * resW) / (vResW * scale));
    const finalY = -((position.y * resH) / (vResH * scale));

    return { x: finalX, y: finalY, width: finalW, height: finalH };
  }

  const drawCanvas = activeScene => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    const [targetWidth, targetHeight] = resolution.split('x').map(Number);
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(finalCanvasZoom, finalCanvasZoom);

    const videoAspectRatio = video.videoWidth / video.videoHeight;
    const targetAspectRatio = targetWidth / targetHeight;

    let drawWidth,
      drawHeight,
      offsetX = 0,
      offsetY = 0;
    if (Math.abs(videoAspectRatio - targetAspectRatio) < 0.0001) {
      drawWidth = targetWidth;
      drawHeight = targetHeight;
    } else if (videoAspectRatio > targetAspectRatio) {
      drawWidth = targetWidth;
      drawHeight = drawWidth / videoAspectRatio;
      offsetY = (targetHeight - drawHeight) / 2;
    } else {
      drawHeight = targetHeight;
      drawWidth = drawHeight * videoAspectRatio;
      offsetX = (targetWidth - drawWidth) / 2;
    }

    if (!activeScene) {
      ctx.drawImage(
        video,
        0,
        0,
        video.videoWidth,
        video.videoHeight,
        offsetX,
        offsetY,
        drawWidth,
        drawHeight,
      );
      ctx.restore();
      return;
    }

    const { crop, scale, position } = activeScene;
    const [virtualWidth, virtualHeight] = virtualResolution
      .split('x')
      .map(Number);

    const adjustedX = (position.x / virtualWidth) * targetWidth;
    const adjustedY = (position.y / virtualHeight) * targetHeight;

    ctx.save();
    ctx.translate(adjustedX, adjustedY);
    ctx.scale(scale, scale);
    ctx.drawImage(
      video,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );
    ctx.restore();
    ctx.restore();
  };

  const drawCropPreview = activeScene => {
    const video = videoRef.current;
    const canvas = cropPreviewRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(cropPreviewZoom, cropPreviewZoom);

    if (!activeScene) {
      ctx.restore();
      return;
    }

    const { crop } = activeScene;
    // Draw the cropped portion as a reference.
    ctx.drawImage(
      video,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );

    // Outline the crop area (just as reference)
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, crop.width, crop.height);

    // Draw final output rectangle with handles
    const finalRect = computeFinalOutputRect(activeScene);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(finalRect.x, finalRect.y, finalRect.width, finalRect.height);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(finalRect.x, finalRect.y, finalRect.width, finalRect.height);
    drawFinalHandles(ctx, finalRect, 'white');

    ctx.restore();
  };

  const drawFinalHandles = (ctx, rect, color) => {
    const { x, y, width: W, height: H } = rect;
    const handleSize = 10;
    ctx.fillStyle = color;

    // Corner handles for scaling
    const handles = [
      { name: 'top-left', x: x, y: y },
      { name: 'top-right', x: x + W, y: y },
      { name: 'bottom-left', x: x, y: y + H },
      { name: 'bottom-right', x: x + W, y: y + H },
    ];

    handles.forEach(h => {
      ctx.fillRect(
        h.x - handleSize / 2,
        h.y - handleSize / 2,
        handleSize,
        handleSize,
      );
    });
  };

  const animationLoop = () => {
    const video = videoRef.current;
    if (!video || !scenesRef.current) return;

    const activeScene = scenesRef.current.find(
      scene =>
        video.currentTime >= scene.start && video.currentTime <= scene.end,
    );

    const currentVideoTime = video.currentTime;
    if (currentVideoTime !== lastDrawnTimeRef.current) {
      lastDrawnTimeRef.current = currentVideoTime;
      drawCanvas(activeScene);
      drawCropPreview(activeScene);

      let time = currentVideoTime;
      let updateVideo = false;

      if (isFinalResultMode && !activeScene) {
        const nextScene = scenesRef.current.find(scene => scene.start > time);
        time = nextScene ? nextScene.start : 0;
        updateVideo = true;
      }

      setCurrentTime(time, updateVideo);
    }

    animationFrameRef.current = requestAnimationFrame(animationLoop);
  };

  useEffect(() => {
    const [aspectWidth, aspectHeight] = aspectRatio.split(':').map(Number);
    const [resWidth, resHeight] = resolution.split('x').map(Number);

    const container = canvasContainerRef.current;
    if (!container || container.clientHeight <= 0) return;

    const containerHeight = container.clientHeight;
    const videoHeight = containerHeight;
    const videoWidth = (videoHeight * aspectWidth) / aspectHeight;
    setVideoDimensions({ width: videoWidth, height: videoHeight });

    const video = videoRef.current;
    const cropCanvas = cropPreviewRef.current;
    const videoCanvas = canvasRef.current;

    videoCanvas.width = resWidth;
    videoCanvas.height = resHeight;

    if (video) {
      cropCanvas.width = video.videoWidth;
      cropCanvas.height = video.videoHeight;
    }

    animationFrameRef.current = requestAnimationFrame(animationLoop);
    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, [
    videoUrl,
    aspectRatio,
    resolution,
    virtualResolution,
    videoRef,
    duration,
  ]);

  const hitTestCornerHandles = (mx, my, rect) => {
    const { x, y, width: W, height: H } = rect;
    const handleSize = 10;
    const handles = [
      { name: 'top-left', x: x, y: y },
      { name: 'top-right', x: x + W, y: y },
      { name: 'bottom-left', x: x, y: y + H },
      { name: 'bottom-right', x: x + W, y: y + H },
    ];
    for (let h of handles) {
      if (
        mx >= h.x - handleSize / 2 &&
        mx <= h.x + handleSize / 2 &&
        my >= h.y - handleSize / 2 &&
        my <= h.y + handleSize / 2
      ) {
        return h.name;
      }
    }
    return null;
  };

  const getMousePosInCanvas = (e, canvas, zoom) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let mx = (e.clientX - rect.left) * scaleX;
    let my = (e.clientY - rect.top) * scaleY;

    // Adjust by inverse of UI zoom to map back to original coords
    mx /= zoom;
    my /= zoom;

    return { mx, my };
  };

  const handleWheelCrop = e => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setCropPreviewZoom(prev => Math.max(0.1, Math.min(prev * zoomFactor, 10)));
  };

  const handleWheelFinal = e => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setFinalCanvasZoom(prev => Math.max(0.1, Math.min(prev * zoomFactor, 10)));
  };

  const handleMouseDown = e => {
    e.preventDefault();

    const { scene, index } = getActiveScene();
    if (!scene || index === -1) return;

    const { mx, my } = getMousePosInCanvas(
      e,
      cropPreviewRef.current,
      cropPreviewZoom,
    );

    // Final rect interaction
    const finalRect = computeFinalOutputRect(scene);

    // Check corner handles for scale
    const corner = hitTestCornerHandles(mx, my, finalRect);
    if (corner) {
      setIsDragging(true);
      setDragMode('scale-final');
      setActiveHandle(corner);
      setDragStart({ x: mx, y: my });

      const initialFinalRect = { ...finalRect };
      const [resW, resH] = resolution.split('x').map(Number);
      const [vResW, vResH] = virtualResolution.split('x').map(Number);
      const initialCenter = {
        x: initialFinalRect.x + initialFinalRect.width / 2,
        y: initialFinalRect.y + initialFinalRect.height / 2,
      };

      setInitialState({
        scale: scene.scale,
        position: { ...scene.position },
        finalRect: initialFinalRect,
        center: initialCenter,
        resW,
        resH,
        vResW,
        vResH,
      });
      return;
    }

    // Check if inside finalRect for move
    if (
      mx >= finalRect.x &&
      mx <= finalRect.x + finalRect.width &&
      my >= finalRect.y &&
      my <= finalRect.y + finalRect.height
    ) {
      setIsDragging(true);
      setDragMode('move-final');
      setActiveHandle(null);
      setDragStart({ x: mx, y: my });

      const initialFinalRect = { ...finalRect };
      const [resW, resH] = resolution.split('x').map(Number);
      const [vResW, vResH] = virtualResolution.split('x').map(Number);
      const initialCenter = {
        x: initialFinalRect.x + initialFinalRect.width / 2,
        y: initialFinalRect.y + initialFinalRect.height / 2,
      };

      setInitialState({
        scale: scene.scale,
        position: { ...scene.position },
        finalRect: initialFinalRect,
        center: initialCenter,
        resW,
        resH,
        vResW,
        vResH,
      });
    }
  };

  const handleMouseMove = e => {
    if (!isDragging) return;
    e.preventDefault();

    const { scene, index } = getActiveScene();
    if (!scene || index === -1) return;

    const { mx, my } = getMousePosInCanvas(
      e,
      cropPreviewRef.current,
      cropPreviewZoom,
    );

    const dx = mx - dragStart.x;
    const dy = my - dragStart.y;

    if (dragMode === 'move-final') {
      const {
        scale: initScale,
        center: initCenter,
        resW,
        resH,
        vResW,
        vResH,
      } = initialState;

      const newCenterX = initCenter.x + dx;
      const newCenterY = initCenter.y + dy;

      const finalW = resW / initScale;
      const finalH = resH / initScale;

      const finalX_new = newCenterX - finalW / 2;
      const finalY_new = newCenterY - finalH / 2;

      const newPosX = -(finalX_new * (vResW * initScale)) / resW;
      const newPosY = -(finalY_new * (vResH * initScale)) / resH;

      updateScene(index, { position: { x: newPosX, y: newPosY } });
    } else if (dragMode === 'scale-final') {
      const {
        scale: initScale,
        finalRect: initFinalRect,
        center: initCenter,
        resW,
        resH,
        vResW,
        vResH,
      } = initialState;

      const initW = initFinalRect.width;
      const initH = initFinalRect.height;

      // Determine new half-size based on corner drag
      const cornerX = activeHandle.includes('left')
        ? initFinalRect.x
        : initFinalRect.x + initW;
      const cornerY = activeHandle.includes('top')
        ? initFinalRect.y
        : initFinalRect.y + initH;

      const newCornerX = cornerX + dx;
      const newCornerY = cornerY + dy;

      const newHalfWidth = Math.abs(newCornerX - initCenter.x);
      const newHalfHeight = Math.abs(newCornerY - initCenter.y);

      const initHalfWidth = initW / 2;
      const initHalfHeight = initH / 2;

      const scaleFactorW = newHalfWidth / initHalfWidth;
      const scaleFactorH = newHalfHeight / initHalfHeight;
      const scaleFactor = Math.max(scaleFactorW, scaleFactorH);

      const newW = initW * scaleFactor;
      const newH = initH * scaleFactor;

      const newScale = resW / newW;

      const finalX_new = initCenter.x - newW / 2;
      const finalY_new = initCenter.y - newH / 2;

      const newPosX = -(finalX_new * (vResW * newScale)) / resW;
      const newPosY = -(finalY_new * (vResH * newScale)) / resH;

      updateScene(index, {
        scale: newScale,
        position: { x: newPosX, y: newPosY },
      });
    }
  };

  const handleMouseUp = e => {
    if (isDragging) {
      e.preventDefault();
      setIsDragging(false);
      setDragMode(null);
      setActiveHandle(null);
      setInitialState(null);
    }
  };

  const handleMouseLeave = e => {
    if (isDragging) {
      e.preventDefault();
      setIsDragging(false);
      setDragMode(null);
      setActiveHandle(null);
      setInitialState(null);
    }
  };

  return (
    <PreviewContainer>
      <CanvasContainer ref={canvasContainerRef}>
        <CropCanvas
          ref={cropPreviewRef}
          videoWidth={videoDimensions.width}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheelCrop}
          style={{ cursor: 'default' }}
        />
        <VideoCanvas
          ref={canvasRef}
          videoWidth={videoDimensions.width}
          onWheel={handleWheelFinal}
          style={{ cursor: 'default' }}
        />
      </CanvasContainer>
      <VideoElement ref={videoRef} />
    </PreviewContainer>
  );
}

export default Preview;
