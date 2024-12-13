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

  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    scenesRef.current = scenes;
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      const activeScene = scenesRef.current.find(
        scene =>
          video.currentTime >= scene.start && video.currentTime <= scene.end,
      );
      drawCanvas(activeScene);
      drawCropPreview(activeScene);
    }
  }, [scenes]);

  const drawCanvas = (activeScene) => {
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

    let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
    if (Math.abs(videoAspectRatio - targetAspectRatio) < 0.0001) {
      // Aspect ratios effectively equal
      drawWidth = targetWidth;
      drawHeight = targetHeight;
    } else if (videoAspectRatio > targetAspectRatio) {
      // Video wider than target ratio -> letterbox vertically
      drawWidth = targetWidth;
      drawHeight = drawWidth / videoAspectRatio;
      offsetY = (targetHeight - drawHeight) / 2;
    } else {
      // Video taller than target ratio -> letterbox horizontally
      drawHeight = targetHeight;
      drawWidth = drawHeight * videoAspectRatio;
      offsetX = (targetWidth - drawWidth) / 2;
    }

    if (!activeScene) {
      // No scene: just draw fitted video
      ctx.drawImage(
        video,
        0, 0, video.videoWidth, video.videoHeight,
        offsetX, offsetY, drawWidth, drawHeight
      );
      return;
    }

    // With an active scene, apply cropping, scaling, and position
    const { crop, scale, position } = activeScene;
    const [virtualWidth, virtualHeight] = virtualResolution.split('x').map(Number);

    const adjustedX = (position.x / virtualWidth) * targetWidth;
    const adjustedY = (position.y / virtualHeight) * targetHeight;

    ctx.save();
    ctx.translate(adjustedX, adjustedY);
    ctx.scale(scale, scale);

    // Draw the cropped portion of the video
    ctx.drawImage(
      video,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, crop.width, crop.height
    );

    ctx.restore();
  };

  const drawCropPreview = (activeScene) => {
    const video = videoRef.current;
    const canvas = cropPreviewRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!activeScene) return;

    const { crop, scale, position } = activeScene;
    const [targetWidth, targetHeight] = resolution.split('x').map(Number);
    const [virtualWidth, virtualHeight] = virtualResolution.split('x').map(Number);

    // Draw only the cropped portion at (0,0) in the crop preview
    // The rest of the canvas remains blank, showing only what is cropped out from the original.
    ctx.drawImage(
      video,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, crop.width, crop.height
    );

    // Now calculate the final output frame coordinates back into original space
    // finalX = adjustedX + scale*(X_orig - crop.x)
    // finalY = adjustedY + scale*(Y_orig - crop.y)
    const adjustedX = (position.x / virtualWidth) * targetWidth;
    const adjustedY = (position.y / virtualHeight) * targetHeight;

    // Invert transformations for finalX=0, finalY=0:
    // X_orig = crop.x - adjustedX/scale
    // Y_orig = crop.y - adjustedY/scale
    const X_orig1 = crop.x - adjustedX / scale;
    const Y_orig1 = crop.y - adjustedY / scale;

    // For finalX=targetWidth:
    // targetWidth = adjustedX + scale*(X_orig2 - crop.x)
    // X_orig2 = crop.x + (targetWidth - adjustedX)/scale
    const X_orig2 = crop.x + (targetWidth - adjustedX) / scale;

    // For finalY=targetHeight:
    // targetHeight = adjustedY + scale*(Y_orig2 - crop.y)
    // Y_orig2 = crop.y + (targetHeight - adjustedY)/scale
    const Y_orig2 = crop.y + (targetHeight - adjustedY) / scale;

    // Now map these back into the cropped space:
    // The cropped space displayed starts at (crop.x, crop.y) in original coords, shown at (0,0).
    // So we subtract crop.x and crop.y:
    const rectX = X_orig1 - crop.x;
    const rectY = Y_orig1 - crop.y;
    const rectW = (X_orig2 - X_orig1);
    const rectH = (Y_orig2 - Y_orig1);

    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(rectX, rectY, rectW, rectH);
  };

  const animationLoop = () => {
    const video = videoRef.current;
    if (!video || !scenesRef.current) return;

    const activeScene = scenesRef.current.find(
      scene => video.currentTime >= scene.start && video.currentTime <= scene.end,
    );

    const currentVideoTime = video.currentTime;
    if (currentVideoTime !== lastDrawnTimeRef.current) {
      lastDrawnTimeRef.current = currentVideoTime;
      drawCanvas(activeScene);
      drawCropPreview(activeScene);
    }

    animationFrameRef.current = requestAnimationFrame(animationLoop);
  };

  const onVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !scenesRef.current) return;

    let time = video.currentTime;
    let updateVideo = false;

    if (isFinalResultMode) {
      const activeScene = scenesRef.current.find(
        scene => time >= scene.start && time <= scene.end,
      );
      if (!activeScene) {
        const nextScene = scenesRef.current.find(scene => scene.start > time);
        if (nextScene) {
          time = nextScene.start;
        } else {
          time = 0;
        }
        updateVideo = true;
      }
    }

    setCurrentTime(time, updateVideo);
  };

  useEffect(() => {
    const videoCanvas = canvasRef.current;
    const cropCanvas = cropPreviewRef.current;
    const [aspectWidth, aspectHeight] = aspectRatio.split(':').map(Number);
    const [resWidth, resHeight] = resolution.split('x').map(Number);

    const container = canvasContainerRef.current;
    const containerHeight = container.clientHeight;

    const videoHeight = containerHeight;
    const videoWidth = (videoHeight * aspectWidth) / aspectHeight;
    setVideoDimensions({ width: videoWidth, height: videoHeight });

    // Set final output canvas resolution
    videoCanvas.width = resWidth;
    videoCanvas.height = resHeight;

    const video = videoRef.current;
    if (video) {
      // Crop preview canvas matches full original video dimensions
      cropCanvas.width = video.videoWidth;
      cropCanvas.height = video.videoHeight;
    }

    animationFrameRef.current = requestAnimationFrame(animationLoop);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoUrl, aspectRatio, resolution, virtualResolution, videoRef, duration]);

  return (
    <PreviewContainer>
      <CanvasContainer ref={canvasContainerRef}>
        <CropCanvas ref={cropPreviewRef} videoWidth={videoDimensions.width} />
        <VideoCanvas ref={canvasRef} videoWidth={videoDimensions.width} />
      </CanvasContainer>
      <VideoElement ref={videoRef} onTimeUpdate={onVideoTimeUpdate} />
    </PreviewContainer>
  );
}

export default Preview;
