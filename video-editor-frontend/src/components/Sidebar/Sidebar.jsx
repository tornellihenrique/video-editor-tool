/* eslint-disable react/prop-types */
import { useState } from 'react';

import {
  SidebarContainer,
  SidebarHeader,
  VideosList,
  VideoItem,
} from './styles';

function Sidebar({ videos, onSelectVideo, onUpload, onDelete }) {
  const [file, setFile] = useState(null);

  const handleUploadChange = e => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUploadClick = () => {
    if (file) {
      onUpload(file);
      setFile(null);
    }
  };

  return (
    <SidebarContainer>
      <SidebarHeader>
        <input type='file' accept='video/*' onChange={handleUploadChange} />
        <button onClick={handleUploadClick} disabled={!file}>
          Upload
        </button>
      </SidebarHeader>
      <VideosList>
        {videos.map(video => (
          <VideoItem key={video.id}>
            <span
              onClick={() => onSelectVideo(video)}
              style={{ cursor: 'pointer', flex: 1 }}
            >
              {video.originalName}
            </span>
            <button
              style={{
                marginLeft: '10px',
                background: 'red',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onClick={() => onDelete(video.id)}
            >
              X
            </button>
          </VideoItem>
        ))}
      </VideosList>
    </SidebarContainer>
  );
}

export default Sidebar;
