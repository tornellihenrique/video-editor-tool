import { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';

import { useEditorStore } from '../store/editorStore';

import Preview from '../components/Preview/Preview';
import Timeline from '../components/Timeline/Timeline';
import SceneConfig from '../components/SceneConfig/SceneConfig';
import Sidebar from '../components/Sidebar/Sidebar';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Header = styled.div`
  flex: 0 1 auto;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 10px 20px;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  font-size: 24px;
  color: #fff;
`;

const MainContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
`;

const Container = styled.div`
  display: flex;
  height: 100vh;
  width: 100vw;
  position: relative;
`;

function VideoEditor() {
  const [videoUrl, setVideoUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isFinalResultMode, setIsFinalResultMode] = useState(true);

  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [resolutionNick, setResolutionNick] = useState('Full HD');

  const [resolution, setResolution] = useState('1080x1920');
  const [virtualResolution, setVirtualResolution] = useState('1080x1920');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [videos, setVideos] = useState([]);

  const aspectRatioMapping = {
    '9:16': {
      'Full HD': '1080x1920',
      HD: '720x1280',
    },
    '16:9': {
      'Full HD': '1920x1080',
      HD: '1280x720',
    },
  };

  useEffect(() => {
    if (aspectRatioMapping[aspectRatio]?.[resolutionNick]) {
      setResolution(aspectRatioMapping[aspectRatio][resolutionNick]);
      setVirtualResolution(aspectRatioMapping[aspectRatio][resolutionNick]);
    }
  }, [aspectRatio, resolutionNick]);

  const setScenes = useEditorStore(state => state.setScenes);
  const scenes = useEditorStore(state => state.scenes);

  const videoRef = useRef(null);

  const fetchVideos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/videos`);
      if (!res.ok) throw new Error('Failed to fetch videos');
      const data = await res.json();
      setVideos(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const processVideo = async filePath => {
    setLoading(true);
    setError(null);
    try {
      // Detect scenes from the selected video
      const detectRes = await fetch(`${API_BASE_URL}/detect-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: filePath }),
      });

      if (!detectRes.ok) {
        const errData = await detectRes.json();
        throw new Error(errData.error || 'Scene detection failed');
      }

      const scenesData = await detectRes.json();
      const parsedScenes = scenesData.scenes.map(scene => ({
        start: scene.start,
        end: scene.end,
        crop: { x: 0, y: 0, width: 1280, height: 720 },
        scale: 1.0,
        position: { x: 0, y: 0 },
      }));

      setScenes(parsedScenes);

      // Load the video
      setVideoUrl(filePath);

      if (videoRef.current) {
        videoRef.current.src = filePath;
        videoRef.current.load();
        videoRef.current.onloadedmetadata = () => {
          setDuration(videoRef.current.duration);
          const time = 0.0;
          setCurrentTime(time);
          videoRef.current.currentTime = time;
        };
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async file => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('video', file);

      const uploadRes = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || 'Upload failed');
      }

      const uploadData = await uploadRes.json();
      const { filePath } = uploadData;

      await fetchVideos(); // refresh the list of videos
      await processVideo(filePath); // run detect scenes and load it
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectVideo = async video => {
    // When selecting a video from the list, process it as well
    await processVideo(video.fileUrl);
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
    <Container>
      {loading && <LoadingOverlay>Loading...</LoadingOverlay>}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            background: 'red',
            color: '#fff',
            padding: '10px',
            zIndex: 11,
          }}
        >
          {error}
        </div>
      )}
      <Sidebar
        videos={videos}
        onSelectVideo={handleSelectVideo}
        onUpload={handleUpload}
      />
      <MainContainer>
        <Header>
          <select
            style={{ margin: '0 20px' }}
            value={aspectRatio}
            onChange={e => setAspectRatio(e.target.value)}
            disabled={loading}
          >
            <option value='16:9'>16:9</option>
            <option value='9:16'>9:16</option>
          </select>
          <select
            style={{ margin: '0 20px' }}
            value={resolutionNick}
            onChange={e => setResolutionNick(e.target.value)}
            disabled={loading}
          >
            <option value='Full HD'>Full HD</option>
            <option value='HD'>HD</option>
          </select>
          <button
            style={{ margin: '0 20px' }}
            onClick={handlePlayPause}
            disabled={loading}
          >
            Play / Pause
          </button>
          <button
            style={{ margin: '0 20px' }}
            onClick={() => setIsFinalResultMode(!isFinalResultMode)}
            disabled={loading}
          >
            {isFinalResultMode
              ? 'Switch to Raw Video'
              : 'Switch to Final Result'}
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
      </MainContainer>
    </Container>
  );
}

export default VideoEditor;
