export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const UPLOAD_BASE_URL = API_BASE_URL.replace('/api', '');
export default API_BASE_URL;
