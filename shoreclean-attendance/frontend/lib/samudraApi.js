import axios from 'axios';

const samudraApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SAMUDRA_API_URL || 'http://localhost:8001',
});

export const samudraEndpoints = {
  health: () => samudraApi.get('/api/samudra/health'),
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return samudraApi.post('/api/samudra/upload', formData);
  },
  live: (image_base64) => samudraApi.post('/api/samudra/live', { image_base64 }),
};

export default samudraApi;
