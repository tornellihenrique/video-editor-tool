import styled from 'styled-components';

export const PreviewContainer = styled.div`
  width: 100%;
  height: calc(100vh - 225px);
  background-color: #000;
`;

export const VideoElement = styled.video`
  display: none;
`;

export const CanvasContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
`;

export const CropCanvas = styled.canvas.withConfig({
  shouldForwardProp: prop => prop !== 'videoWidth',
})`
  flex-shrink: 1;
  max-width: ${props => `calc(100% - ${props.videoWidth}px)`};
  width: auto;
  max-height: 100%;
`;

export const VideoCanvas = styled.canvas.withConfig({
  shouldForwardProp: prop => prop !== 'videoWidth',
})`
  flex-shrink: 0;
  height: 100%;
  width: ${props => `${props.videoWidth}px`};
`;