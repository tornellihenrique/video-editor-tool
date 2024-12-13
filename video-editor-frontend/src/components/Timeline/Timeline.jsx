import { useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';

import { TimelineContainer, SceneMarker, PlaybackHandle } from './styles';

function Timeline({ videoRef, duration, currentTime, setCurrentTime, isFinalResultMode }) {
  const scenes = useEditorStore(state => state.scenes);

  //   const activeSceneIndex = useEditorStore(state => state.activeSceneIndex);
  //   const setActiveScene = useEditorStore(state => state.setActiveScene);

  const timelineRef = useRef(null);

  const timeToPercentage = time => (time / duration) * 100;

  const handleSeek = e => {
    const video = videoRef.current;
    if (!video) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    
    let time = duration * percentage;

    if (isFinalResultMode) {
      // Skip non-scene parts
      const activeScene = scenes.find(
        scene => time >= scene.start && time <= scene.end,
      );
      
      if (!activeScene) {
        const nextScene = scenes.find(scene => scene.start > time);
        
        if (!nextScene) {
          return;
        }

        time = nextScene.start;
      }
    }

    setCurrentTime(time);
  };

  return (
    <TimelineContainer ref={timelineRef} onClick={handleSeek}>
      {scenes.map((scene, index) => (
        <SceneMarker
          key={index}
          isActive={currentTime >= scene.start && currentTime <= scene.end}
          style={{
            left: `${timeToPercentage(scene.start)}%`,
            width: `${timeToPercentage(scene.end - scene.start)}%`,
          }}
        />
      ))}
      <PlaybackHandle
        style={{
          left: `${timeToPercentage(currentTime)}%`,
        }}
        draggable='true'
        // onDrag={e => {
        //   const rect = timelineRef.current.getBoundingClientRect();
        //   const percentage = (e.clientX - rect.left) / rect.width;
        //   setCurrentTime(
        //     Math.min(Math.max(duration * percentage, 0), duration),
        //   );
        // }}
      />
    </TimelineContainer>
  );
}

export default Timeline;
