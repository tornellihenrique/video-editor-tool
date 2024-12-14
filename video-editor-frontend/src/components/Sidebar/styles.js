import styled from 'styled-components';

export const SidebarContainer = styled.div`
  width: 250px;
  background: #f0f0f0;
  border-right: 1px solid #ccc;
  display: flex;
  flex-direction: column;
`;

export const SidebarHeader = styled.div`
  padding: 10px;
  border-bottom: 1px solid #ccc;
`;

export const VideosList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

export const VideoItem = styled.div`
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #ddd;

  &:hover {
    background: #eaeaea;
  }
`;
