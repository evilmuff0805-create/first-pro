const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Image proxy to avoid CORS issues with external image APIs ──
app.get('/api/proxy-image', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'Missing url parameter' });

        const response = await fetch(url, {
            headers: { 'User-Agent': 'StoryboardPro/1.0' },
            signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');

        const buffer = Buffer.from(await response.arrayBuffer());
        res.send(buffer);
    } catch (err) {
        console.error('Proxy image error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Storyboard Pro server running on port ${PORT}`);
});
