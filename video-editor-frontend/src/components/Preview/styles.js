import styled from 'styled-components';

export const PreviewContainer = styled.div`
  display: flex;
  flex-flow: column;
  width: 100%;
  height: calc(100vh - 225px);
  background-color: #111;
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
  padding: 10px;
  box-sizing: border-box;
  background-color: #111;
`;

export const CropCanvas = styled.canvas.withConfig({
  shouldForwardProp: prop => prop !== 'videoWidth',
})`
  flex-shrink: 1;
  max-width: ${props => `calc(100% - ${props.videoWidth}px)`};
  width: auto;
  max-height: 100%;
  background-color: #000;
  border-radius: 15px;
`;

export const VideoCanvas = styled.canvas.withConfig({
  shouldForwardProp: prop => prop !== 'videoWidth',
})`
  flex-shrink: 0;
  height: 100%;
  width: ${props => `${props.videoWidth}px`};
  background-color: #000;
  border-radius: 15px;
`;

export const InfoContainer = styled.div`
  display: flex;
  justify-content: space-between;
  background-color: #454545;
  padding: 3px;
  margin: 10px 10px 0px 10px;
  border-radius: 7px;
  box-sizing: border-box;
`;

export const InfoBadgeContainer = styled.div`
  display: flex;
`;

export const InfoBadge = styled.div`
  background-color: black;
  color: white;
  padding: 5px;
  font-size: 11px;
  border-radius: 8px;
  margin-right: 5px;
`;
