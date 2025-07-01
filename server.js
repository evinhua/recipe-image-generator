const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// NVIDIA API proxy
app.post('/api/nvidia/chat', async (req, res) => {
  try {
    console.log('Proxying request to NVIDIA API...');
    
    const response = await axios.post(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_NVIDIA_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('NVIDIA API Error:', error.response?.data || error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: error.response.data?.detail || error.response.data?.message || 'NVIDIA API error'
      });
    } else {
      res.status(500).json({ error: 'Network error or timeout' });
    }
  }
});

// OpenAI API proxy
app.post('/api/openai/images', async (req, res) => {
  try {
    console.log('Proxying request to OpenAI API...');
    
    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('OpenAI API Error:', error.response?.data || error.message);
    
    if (error.response) {
      res.status(error.response.status).json({
        error: error.response.data?.error?.message || 'OpenAI API error'
      });
    } else {
      res.status(500).json({ error: 'Network error or timeout' });
    }
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    nvidia_key: !!process.env.REACT_APP_NVIDIA_API_KEY,
    openai_key: !!process.env.REACT_APP_OPENAI_API_KEY
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`NVIDIA API Key configured: ${!!process.env.REACT_APP_NVIDIA_API_KEY}`);
  console.log(`OpenAI API Key configured: ${!!process.env.REACT_APP_OPENAI_API_KEY}`);
});

module.exports = app;
