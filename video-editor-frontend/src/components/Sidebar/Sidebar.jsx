import { useState, useEffect } from 'react';

import {
  SidebarContainer,
  SidebarHeader,
  VideosList,
  VideoItem,
} from './styles';

function Sidebar({ videos, onSelectVideo, onUpload }) {
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
          <VideoItem key={video.id} onClick={() => onSelectVideo(video)}>
            {video.originalName}
          </VideoItem>
        ))}
      </VideosList>
    </SidebarContainer>
  );
}

export default Sidebar;
