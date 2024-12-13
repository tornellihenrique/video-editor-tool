import { useEffect, useState } from 'react';

import { useEditorStore } from '../../store/editorStore';

import { SceneConfigContainer, SceneConfigInput } from './styles';

function SceneConfig({ currentTime, scenes }) {
  const updateScene = useEditorStore(state => state.updateScene);

  const [currentScene, setCurrentScene] = useState(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(-1);

  const start = currentScene?.start || 0;
  const end = currentScene?.end || 0;
  const cropx = currentScene?.crop?.x || 0;
  const cropy = currentScene?.crop?.y || 0;
  const cropWidth = currentScene?.crop?.width || 0;
  const cropHeight = currentScene?.crop?.height || 0;
  const scale = currentScene?.scale || 0;
  const positionx = currentScene?.position?.x || 0;
  const positiony = currentScene?.position?.y || 0;

  useEffect(() => {
    let foundIndex = -1;
    const foundScene = scenes.find((scene, index) => {
      if (currentTime >= scene.start && currentTime <= scene.end) {
        foundIndex = index;
        return true;
      }
    });

    setCurrentScene(foundScene);
    setCurrentSceneIndex(foundIndex);
  }, [currentTime, scenes]);

  useEffect(() => {
    if (currentScene && currentSceneIndex !== -1) {
      updateScene(currentSceneIndex, currentScene);
    }
  }, [currentScene]);

  return (
    <SceneConfigContainer>
      <label>Start</label>
      <SceneConfigInput
        type='number'
        value={start}
        onChange={e =>
          setCurrentScene({ ...currentScene, start: e.target.value })
        }
      />
      <label>End</label>
      <SceneConfigInput
        type='number'
        value={end}
        onChange={e =>
          setCurrentScene({ ...currentScene, end: e.target.value })
        }
      />
      <label>Crop X</label>
      <SceneConfigInput
        type='number'
        step={10}
        value={cropx}
        onChange={e =>
          setCurrentScene({
            ...currentScene,
            crop: { ...currentScene.crop, x: e.target.value },
          })
        }
      />
      <label>Crop Y</label>
      <SceneConfigInput
        type='number'
        step={10}
        value={cropy}
        onChange={e =>
          setCurrentScene({
            ...currentScene,
            crop: { ...currentScene.crop, y: e.target.value },
          })
        }
      />
      <label>Crop Width</label>
      <SceneConfigInput
        type='number'
        step={10}
        value={cropWidth}
        onChange={e =>
          setCurrentScene({
            ...currentScene,
            crop: { ...currentScene.crop, width: e.target.value },
          })
        }
      />
      <label>Crop Height</label>
      <SceneConfigInput
        type='number'
        step={10}
        value={cropHeight}
        onChange={e =>
          setCurrentScene({
            ...currentScene,
            crop: { ...currentScene.crop, height: e.target.value },
          })
        }
      />
      <label>Scale</label>
      <SceneConfigInput
        type='number'
        step={0.1}
        value={scale}
        onChange={e =>
          setCurrentScene({ ...currentScene, scale: e.target.value })
        }
      />
      <label>Position X</label>
      <SceneConfigInput
        type='number'
        step={10}
        value={positionx}
        onChange={e =>
          setCurrentScene({
            ...currentScene,
            position: { ...currentScene.position, x: e.target.value },
          })
        }
      />
      <label>Position Y</label>
      <SceneConfigInput
        type='number'
        step={10}
        value={positiony}
        onChange={e =>
          setCurrentScene({
            ...currentScene,
            position: { ...currentScene.position, y: e.target.value },
          })
        }
      />
    </SceneConfigContainer>
  );
}

export default SceneConfig;
