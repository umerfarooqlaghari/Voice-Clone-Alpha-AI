const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const COQUI_HOST = 'localhost';
const COQUI_PORT = 5002;

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse the request URL
  const parsedUrl = url.parse(req.url, true);

  // Handle different types of requests
  if (parsedUrl.pathname === '/api/tts' || parsedUrl.pathname === '/api/tts/speaker-similarity' || parsedUrl.pathname === '/api/tts/info' || parsedUrl.pathname === '/health') {
    // Forward TTS requests to Coqui TTS server
    const options = {
      hostname: COQUI_HOST,
      port: COQUI_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${COQUI_HOST}:${COQUI_PORT}`
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      // Copy status code and headers
      res.writeHead(proxyRes.statusCode, proxyRes.headers);

      // Pipe the response
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err);
      res.writeHead(500);
      res.end('Proxy error');
    });

    // Pipe the request body
    req.pipe(proxyReq);
  } else if (parsedUrl.pathname === '/upload-voice' && req.method === 'POST') {
    // Handle voice upload for cloning
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { audioData, filename } = data;

        // Save audio file temporarily for Coqui TTS to access
        const audioBuffer = Buffer.from(audioData.split(',')[1], 'base64');
        const tempPath = path.join(__dirname, 'temp_voices', filename);

        // Create temp directory if it doesn't exist
        const tempDir = path.dirname(tempPath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        fs.writeFileSync(tempPath, audioBuffer);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          audioUrl: `http://localhost:${PORT}/temp_voices/${filename}`
        }));
      } catch (error) {
        console.error('Voice upload error:', error);
        res.writeHead(500);
        res.end('Upload error');
      }
    });
  } else if (parsedUrl.pathname.startsWith('/temp_voices/')) {
    // Serve temporary voice files
    const filename = parsedUrl.pathname.replace('/temp_voices/', '');
    const filePath = path.join(__dirname, 'temp_voices', filename);

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);

      // Determine MIME type based on file extension
      let contentType = 'audio/wav'; // Default to WAV
      if (filename.endsWith('.webm')) {
        contentType = 'audio/webm';
      } else if (filename.endsWith('.mp3')) {
        contentType = 'audio/mpeg';
      } else if (filename.endsWith('.mp4')) {
        contentType = 'audio/mp4';
      } else if (filename.endsWith('.ogg')) {
        contentType = 'audio/ogg';
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('File not found');
    }
  } else {
    // Return 404 for other paths
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Coqui TTS Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying requests to Coqui TTS server at http://${COQUI_HOST}:${COQUI_PORT}`);
  console.log('✅ CORS enabled for all origins');
});
