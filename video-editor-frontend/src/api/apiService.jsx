import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000', // Adjust to match your backend URL
});

export const uploadVideo = file => {
  const formData = new FormData();
  formData.append('video', file);
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const detectScenes = videoPath =>
  api.post('/detect-scenes', { videoPath });

export const exportVideo = data => api.post('/export', data);

export const downloadVideo = filePath =>
  api.get(`/processed/${filePath}`, { responseType: 'blob' });
