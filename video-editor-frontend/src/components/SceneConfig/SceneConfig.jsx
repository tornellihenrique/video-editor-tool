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

  const resetCurrentScene = () => {
    setCurrentScene({
      ...currentScene,
      crop: { x: 0, y: 0, width: 1280, height: 720 },
      scale: 1.0,
      position: { x: 0, y: 0 },
    });
  };

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
          setCurrentScene({
            ...currentScene,
            start: Number(e.target.value) || 0,
          })
        }
      />
      <label>End</label>
      <SceneConfigInput
        type='number'
        value={end}
        onChange={e =>
          setCurrentScene({ ...currentScene, end: Number(e.target.value) || 0 })
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
            crop: { ...currentScene.crop, x: Number(e.target.value) || 0 },
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
            crop: { ...currentScene.crop, y: Number(e.target.value) || 0 },
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
            crop: { ...currentScene.crop, width: Number(e.target.value) || 0 },
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
            crop: { ...currentScene.crop, height: Number(e.target.value) || 0 },
          })
        }
      />
      <label>Scale</label>
      <SceneConfigInput
        type='number'
        step={0.01}
        value={scale}
        onChange={e =>
          setCurrentScene({
            ...currentScene,
            scale: Number(e.target.value) || 0,
          })
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
            position: {
              ...currentScene.position,
              x: Number(e.target.value) || 0,
            },
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
            position: {
              ...currentScene.position,
              y: Number(e.target.value) || 0,
            },
          })
        }
      />
      <button style={{ margin: '0 20px' }} onClick={resetCurrentScene}>
        Reset
      </button>
    </SceneConfigContainer>
  );
}

export default SceneConfig;
