import styled from 'styled-components';

export const TimelineContainer = styled.div`
  flex: 1 1 auto;
  display: grid;
  position: relative;
  background-color: #222;
  overflow: hidden;
`;

export const SceneMarker = styled.div.withConfig({
  shouldForwardProp: prop => prop !== 'isActive',
})`
  position: absolute;
  grid-area: 1 / 1 / 2 / 2;
  height: 100%;
  background-color: ${props => (props.isActive ? '#ff5555' : '#555')};
  top: 0;
  cursor: pointer;
`;

export const PlaybackHandle = styled.div`
  position: absolute;
  grid-area: 1 / 1 / 2 / 2;
  height: 100%;
  width: 2px;
  background-color: #ffdd44;
  cursor: pointer;
  z-index: 2;
`;
