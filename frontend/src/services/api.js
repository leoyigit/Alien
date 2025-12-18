import axios from 'axios';

// Pointing to your Python Backend on port 5001
const API_URL = 'http://localhost:5001/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;