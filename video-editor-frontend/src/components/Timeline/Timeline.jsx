import { useRef, useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import styled from 'styled-components';

const TimelineContainer = styled.div`
  flex: 1 1 auto;
  display: grid;
  position: relative;
  background-color: #222;
  overflow: hidden;
  cursor: default;
`;

const SceneMarker = styled.div.withConfig({
  shouldForwardProp: prop => prop !== 'isActive',
})`
  position: absolute;
  grid-area: 1 / 1 / 2 / 2;
  height: 100%;
  background-color: ${props => (props.isActive ? '#ff555547' : '#ffffff1c')};
  top: 0;
  cursor: pointer;
  outline: 1px solid black;
`;

const PlaybackHandle = styled.div`
  position: absolute;
  grid-area: 1 / 1 / 2 / 2;
  height: 100%;
  width: 2px;
  background-color: #ffdd44;
  cursor: pointer;
  z-index: 2;
`;

function Timeline({
  videoRef,
  duration,
  currentTime,
  setCurrentTime,
  isFinalResultMode,
}) {
  const scenes = useEditorStore(state => state.scenes);

  const timelineRef = useRef(null);
  const waveformCanvasRef = useRef(null);

  const [waveformData, setWaveformData] = useState(null);

  // Zoom and offset states
  const [zoom, setZoom] = useState(1); // 1 means full view (entire duration in view)
  const [offset, setOffset] = useState(0); // in seconds, the start time of the current view
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);

  const pixelsPerSecond = () => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || duration === 0) return 1;
    return (rect.width * zoom) / duration;
  };

  const visibleDuration = () => duration / zoom;

  // Ensure offset stays within [0, duration - visibleDuration]
  const clampOffset = val => {
    const maxOffset = Math.max(0, duration - visibleDuration());
    return Math.min(Math.max(val, 0), maxOffset);
  };

  // Convert time to x coordinate
  const timeToX = t => (t - offset) * pixelsPerSecond();

  const handleSeek = e => {
    const video = videoRef.current;
    if (!video) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = offset + x / pixelsPerSecond();

    let seekTime = time;

    if (isFinalResultMode) {
      // Skip non-scene parts
      const activeScene = scenes.find(
        scene => seekTime >= scene.start && seekTime <= scene.end,
      );
      if (!activeScene) {
        const nextScene = scenes.find(scene => scene.start > seekTime);
        if (!nextScene) return;
        seekTime = nextScene.start;
      }
    }

    setCurrentTime(seekTime);
  };

  // Zoom on mouse wheel
  const handleWheel = e => {
    e.preventDefault();
    if (!timelineRef.current) return;

    setZoom(prev => {
      const zoomFactor = 0.5;
      const newZoom = Math.max(
        e.deltaY < 0 ? prev + zoomFactor : prev - zoomFactor,
        0.5,
      );

      if (newZoom >= 0.1) {
        setOffset(prev => {
          const visibleRange = duration / newZoom;

          const newOffset = clampOffset(currentTime - visibleRange / 2);

          return clampOffset(newOffset);
        });

        return newZoom;
      }
    });
  };

  useEffect(() => {}, [zoom, duration]);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    const targetHandle = e => {
      handleWheel(e, currentTime);
    };

    timeline.addEventListener('wheel', targetHandle, { passive: false });

    return () => {
      timeline.removeEventListener('wheel', targetHandle);
    };
  }, [currentTime]);

  // Panning with middle mouse
  const handleMouseDown = e => {
    if (e.button === 1) {
      // Middle mouse button
      e.preventDefault();
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartOffset(offset);
    }
  };

  const handleMouseMove = e => {
    if (!isPanning) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const dx = e.clientX - panStartX;
    const timeDelta = dx / pixelsPerSecond();
    const newOffset = clampOffset(panStartOffset - timeDelta);
    setOffset(newOffset);
  };

  const handleMouseUp = e => {
    if (e.button === 1) {
      setIsPanning(false);
    }
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  // Generate waveform data when videoUrl changes
  // This is a simplified approach, in a real case you might fetch precomputed data.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.src) return;

    // Fetch audio data from video src
    // Note: This might not work if video is not same-origin or lacks CORS headers.
    // In a real scenario, ensure CORS or have precomputed waveform.
    const fetchWaveform = async () => {
      try {
        const response = await fetch(video.src);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioData = await audioCtx.decodeAudioData(arrayBuffer);

        // Extract channel data (use first channel)
        const channelData = audioData.getChannelData(0);

        // Downsample to create a manageable waveform
        const samples = 10000; // number of points in waveform
        const blockSize = Math.floor(channelData.length / samples);
        const waveform = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[start + j]);
          }
          waveform[i] = sum / blockSize;
        }

        setWaveformData(waveform);
      } catch (err) {
        console.error('Failed to generate waveform:', err);
        setWaveformData(null);
      }
    };

    fetchWaveform();
  }, [videoRef, duration]);

  // Draw waveform
  useEffect(() => {
    if (!waveformData || !timelineRef.current) return;

    const canvas = waveformCanvasRef.current;
    const rect = timelineRef.current.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxAmplitude = Math.max(...waveformData);
    const normalizedWaveform = waveformData.map(val => val / maxAmplitude);

    // Draw waveform:
    // visible time range: [offset, offset + visibleDuration()]
    const startTime = offset;
    const endTime = offset + visibleDuration();

    // Map waveformData indices to time
    // waveformData length = samples, covers [0, duration]
    const samples = normalizedWaveform.length;
    const timePerSample = duration / samples;

    // We'll draw a line through peaks
    ctx.strokeStyle = '#44ff44';
    ctx.lineWidth = 1;

    // Midpoint of the canvas (to center the waveform vertically)
    const yMid = canvas.height / 2;

    // Amplitude scale (full height of canvas)
    const amplitudeScale = yMid;

    ctx.beginPath();

    for (let i = 0; i < samples; i++) {
      const sampleTime = i * timePerSample;
      if (sampleTime < startTime || sampleTime > endTime) continue;

      const x = timeToX(sampleTime);
      const normalizedAmplitude = normalizedWaveform[i]; // 0.0 to 1.0
      const yUp = yMid - normalizedAmplitude * amplitudeScale; // Top half
      const yDown = yMid + normalizedAmplitude * amplitudeScale; // Bottom half

      if (i === 0) {
        ctx.moveTo(x, yUp);
        ctx.lineTo(x, yDown); // Mirror the initial point downward
      } else {
        ctx.lineTo(x, yUp); // Continue upwards
        ctx.moveTo(x, yDown); // Continue downwards
      }
    }

    ctx.stroke();
  }, [waveformData, offset, zoom, duration]);

  return (
    <TimelineContainer
      ref={timelineRef}
      onClick={handleSeek}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={waveformCanvasRef}
        style={{
          gridArea: '1 / 1 / 2 / 2',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
      {scenes.map((scene, index) => {
        const startX = timeToX(scene.start);
        const endX = timeToX(scene.end);
        const width = endX - startX;
        return (
          <SceneMarker
            key={index}
            isActive={currentTime >= scene.start && currentTime <= scene.end}
            style={{
              left: `${startX}px`,
              width: `${width}px`,
            }}
          />
        );
      })}
      <PlaybackHandle
        style={{
          left: `${timeToX(currentTime)}px`,
        }}
      />
    </TimelineContainer>
  );
}

export default Timeline;
