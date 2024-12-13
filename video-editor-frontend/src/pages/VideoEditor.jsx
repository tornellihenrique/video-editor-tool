import { useState, useRef } from 'react';
import styled from 'styled-components';

import { useEditorStore } from '../store/editorStore';

import Preview from '../components/Preview/Preview';
import Timeline from '../components/Timeline/Timeline';
import SceneConfig from '../components/SceneConfig/SceneConfig';

const Header = styled.div`
  flex: 0 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 10px 20px;
`;

function VideoEditor() {
  const [videoUrl, setVideoUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFinalResultMode, setIsFinalResultMode] = useState(true);
  const [duration, setDuration] = useState(0);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [resolution, setResolution] = useState('1080x1920');
  const [virtualResolution, setVirtualResolution] = useState('1080x1920');

  const setScenes = useEditorStore(state => state.setScenes);
  const scenes = useEditorStore(state => state.scenes);

  const videoRef = useRef(null);

  const handleFileUpload = e => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);

      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();

        videoRef.current.onloadedmetadata = () => {
          setDuration(videoRef.current.duration);
          
          const time = 0.0;
          setCurrentTime(time);
          videoRef.current.currentTime = time;
        };
      }

      // Example scene data
      setScenes([
        {
          start: 0.0,
          end: 5.0,
          crop: { x: 0, y: 0, width: 1280, height: 720 },
          scale: 1.0,
          position: { x: 0, y: 0 },
        },
      ]);
    }
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Header>
        <input type='file' accept='video/*' onChange={handleFileUpload} />
        <select
          style={{ margin: '0 20px' }}
          value={aspectRatio}
          onChange={e => setAspectRatio(e.target.value)}
        >
          <option value='16:9'>16:9</option>
          <option value='9:16'>9:16</option>
        </select>
        <button style={{ margin: '0 20px' }} onClick={handlePlayPause}>
          Play / Pause
        </button>
        <button
          style={{ margin: '0 20px' }}
          onClick={() => setIsFinalResultMode(!isFinalResultMode)}
        >
          {isFinalResultMode ? 'Switch to Raw Video' : 'Switch to Final Result'}
        </button>
      </Header>
      <Preview
        videoRef={videoRef}
        videoUrl={videoUrl}
        scenes={scenes}
        setCurrentTime={(time, updateVideo) => {
          setCurrentTime(time);

          if (updateVideo && videoRef.current) {
            videoRef.current.currentTime = time;
          }
        }}
        duration={duration}
        aspectRatio={aspectRatio}
        resolution={resolution}
        virtualResolution={virtualResolution}
        isFinalResultMode={isFinalResultMode}
      />
      <SceneConfig currentTime={currentTime} scenes={scenes} />
      <Timeline
        videoRef={videoRef}
        duration={duration}
        currentTime={currentTime}
        setCurrentTime={time => {
          setCurrentTime(time);

          if (videoRef.current) {
            videoRef.current.currentTime = time;
          }
        }}
        isFinalResultMode={isFinalResultMode}
      />
    </div>
  );
}

export default VideoEditor;
