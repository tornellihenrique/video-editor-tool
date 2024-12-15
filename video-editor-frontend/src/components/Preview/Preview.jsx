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

  // Drag state
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
    // This function maps how the final output area (after scaling/position) fits into the original video.
    const { crop, scale, position } = scene;
    const [resW, resH] = resolution.split('x').map(Number);
    const [vResW, vResH] = virtualResolution.split('x').map(Number);

    // Based on the math in the original code, finalRect simplifies to:
    // finalW = resW / scale
    // finalH = resH / scale
    // finalX = - ( (position.x * resW) / (vResW * scale) )
    // finalY = - ( (position.y * resH) / (vResH * scale) )

    const finalW = resW / scale;
    const finalH = resH / scale;

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
  };

  const drawCropPreview = activeScene => {
    const video = videoRef.current;
    const canvas = cropPreviewRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!activeScene) return;

    const { crop } = activeScene;
    // Draw the cropped portion as a reference (red rectangle).
    // We will NOT provide resize handles for the crop anymore.
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

    // Outline the crop area in red (reference only)
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, crop.width, crop.height);

    // Draw the final output rectangle (white rectangle) with handles.
    const finalRect = computeFinalOutputRect(activeScene);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(finalRect.x, finalRect.y, finalRect.width, finalRect.height);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(finalRect.x, finalRect.y, finalRect.width, finalRect.height);
    drawFinalHandles(ctx, finalRect, 'white');
  };

  const drawFinalHandles = (ctx, rect, color) => {
    const { x, y, width: W, height: H } = rect;
    const handleSize = 10;
    ctx.fillStyle = color;

    // Only corners for scaling
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

  const getMousePosInCanvas = e => {
    const rect = cropPreviewRef.current.getBoundingClientRect();
    const scaleX = cropPreviewRef.current.width / rect.width;
    const scaleY = cropPreviewRef.current.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    return { mx, my };
  };

  const handleMouseDown = e => {
    e.preventDefault();

    const { scene, index } = getActiveScene();
    if (!scene || index === -1) return;

    const { mx, my } = getMousePosInCanvas(e);

    // Final rect interaction: move or scale
    const finalRect = computeFinalOutputRect(scene);

    // Check if clicking a corner handle for scaling finalRect
    const corner = hitTestCornerHandles(mx, my, finalRect);
    if (corner) {
      setIsDragging(true);
      setDragMode('scale-final');
      setActiveHandle(corner);
      setDragStart({ x: mx, y: my });

      // Store initial scene and finalRect states for reference
      const initialFinalRect = { ...finalRect };
      const [resW, resH] = resolution.split('x').map(Number);
      const [vResW, vResH] = virtualResolution.split('x').map(Number);

      // Store initial values to help recalculate position and scale with stable center
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

    // Check if clicking inside finalRect to move it
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

    const { mx, my } = getMousePosInCanvas(e);

    const dx = mx - dragStart.x;
    const dy = my - dragStart.y;

    if (dragMode === 'move-final') {
      // Move finalRect by translating its center
      const {
        scale: initScale,
        position: initPos,
        center: initCenter,
        resW,
        resH,
        vResW,
        vResH,
      } = initialState;

      // New center after dragging
      const newCenterX = initCenter.x + dx;
      const newCenterY = initCenter.y + dy;

      const finalW = resW / initScale;
      const finalH = resH / initScale;

      // finalX = finalCenterX - finalW/2
      // position.x = -finalX * (vResW * scale)/resW
      const finalX_new = newCenterX - finalW / 2;
      const finalY_new = newCenterY - finalH / 2;

      const newPosX = -(finalX_new * (vResW * initScale)) / resW;
      const newPosY = -(finalY_new * (vResH * initScale)) / resH;

      updateScene(index, { position: { x: newPosX, y: newPosY } });
    } else if (dragMode === 'scale-final') {
      const {
        scale: initScale,
        position: initPos,
        finalRect: initFinalRect,
        center: initCenter,
        resW,
        resH,
        vResW,
        vResH,
      } = initialState;

      // We will scale uniformly.
      // Determine scale factor by how far user dragged from the corner.
      // Let's say user grabbed top-left corner: moving that corner outwards or inwards changes width and height.
      // We'll use the difference in width as reference. The finalRect width = resW/scale.
      // If user moves handle outwards by dx relative to initial state, new width = initial width + some delta.
      // We always keep aspect ratio the same, so we use the magnitude of diagonal move to scale uniformly.

      const initW = initFinalRect.width;
      const initH = initFinalRect.height;

      // Depending on the corner, dx and dy represent how we want to change size.
      // We'll find a uniform factor: factor = newSize / initSize, use width or height consistently.
      // We'll base on width change primarily.
      // If corner is top-left, decreasing x and y increases size. If the user drags outward, width increases.
      // Let's measure how the user wants to change the width or height:
      let desiredW = initW;
      let desiredH = initH;

      // We'll consider that dragging away from the center in either dimension scales up, towards the center scales down.
      // For simplicity, let's just use the largest absolute scaled dimension to ensure uniform scaling.
      // Compare how much the user moved in horizontal/vertical direction relative to the center.
      // Actually, let's consider that dragging from a corner changes size proportionally.
      // Distance from corner to center initially:
      const cornerX = activeHandle.includes('left')
        ? initFinalRect.x
        : initFinalRect.x + initW;
      const cornerY = activeHandle.includes('top')
        ? initFinalRect.y
        : initFinalRect.y + initH;

      const initCornerOffsetX = cornerX - initCenter.x;
      const initCornerOffsetY = cornerY - initCenter.y;

      // After drag, the user moves the corner:
      const newCornerX = cornerX + dx;
      const newCornerY = cornerY + dy;

      // Calculate new width/height from the new corner position relative to center:
      const newHalfWidth = Math.abs(newCornerX - initCenter.x);
      const newHalfHeight = Math.abs(newCornerY - initCenter.y);

      // Initial half width/height:
      const initHalfWidth = initW / 2;
      const initHalfHeight = initH / 2;

      // Scale factor based on width or height
      const scaleFactorW = newHalfWidth / initHalfWidth;
      const scaleFactorH = newHalfHeight / initHalfHeight;

      // Use the larger factor to maintain aspect ratio uniformly
      const scaleFactor = Math.max(scaleFactorW, scaleFactorH);

      const newW = initW * scaleFactor;
      const newH = initH * scaleFactor;

      // newW = resW / newScale => newScale = resW / newW
      // We keep center stable:
      const newScale = resW / newW; // uniform scaling

      // Now recalculate position to maintain the same center
      const finalX_new = initCenter.x - newW / 2;
      const finalY_new = initCenter.y - newH / 2;

      const newPosX = -(finalX_new * (vResW * newScale)) / resW;
      const newPosY = -(finalY_new * (vResH * newScale)) / resH;

      // Update scene
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
          style={{ cursor: 'default' }}
        />
        <VideoCanvas ref={canvasRef} videoWidth={videoDimensions.width} />
      </CanvasContainer>
      <VideoElement ref={videoRef} />
    </PreviewContainer>
  );
}

export default Preview;
