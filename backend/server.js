const express = require('express');
const cors = require('cors');
// const { createCanvas, loadImage } = require('canvas'); // Unused and causes install issues on Windows
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configure multer for image uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});



const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large canvas data



// --- API Endpoints ---

// Initialize Canvas (Just a placeholder for validation if needed)
app.post('/api/canvas/init', (req, res) => {
    const { width, height } = req.body;
    if (!width || !height) {
        return res.status(400).json({ error: 'Width and height are required' });
    }
    res.json({ message: 'Canvas initialized', width, height });
});

// Export PDF
app.post('/api/canvas/export', async (req, res) => {
    try {
        const { width, height, elements } = req.body;

        if (!width || !height || !elements) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const parsedElements =
            typeof elements === 'string'
                ? JSON.parse(elements)
                : elements;

        if (!Array.isArray(parsedElements)) {
            return res.status(400).json({ error: 'Elements must be an array' });
        }

        const doc = new PDFDocument({
            size: [parseInt(width), parseInt(height)],
            compress: true
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=canvas-export.pdf');

        doc.pipe(res);

        for (const el of parsedElements) {
            if (el.type === 'rect') {
                doc.rect(el.x, el.y, el.width, el.height).fill(el.color);
            }
            else if (el.type === 'circle') {
                doc.circle(
                    el.x + el.radius,
                    el.y + el.radius,
                    el.radius
                ).fill(el.color);
            }
            else if (el.type === 'text') {
                doc
                    .fontSize(el.fontSize || 12)
                    .fillColor(el.color || 'black')
                    .text(el.text, el.x, el.y);
            }
            else if (el.type === 'polygon') {
                const radius = el.size / 2;
                const cx = el.x + radius;
                const cy = el.y + radius;
                const sides = el.sides;

                const vertices = [];
                const startAngle = -Math.PI / 2;

                for (let i = 0; i < sides; i++) {
                    const angle = startAngle + i * 2 * Math.PI / sides;
                    vertices.push({
                        x: cx + radius * Math.cos(angle),
                        y: cy + radius * Math.sin(angle),
                    });
                }

                if (vertices.length > 0) {
                    doc.moveTo(vertices[0].x, vertices[0].y);
                    for (let i = 1; i < vertices.length; i++) {
                        doc.lineTo(vertices[i].x, vertices[i].y);
                    }
                    doc.closePath();
                    doc.fill(el.color);
                }
            }
            else if (el.type === 'image' && el.src) {
                const base64Data = el.src.replace(/^data:image\/\w+;base64,/, '');
                const imgBuffer = Buffer.from(base64Data, 'base64');

                doc.image(imgBuffer, el.x, el.y, {
                    width: el.width,
                    height: el.height
                });
            }
        }

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate PDF' });
        }
    }
});

// Image upload endpoint
app.post('/api/assets/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Convert buffer to base64 data URL
        const base64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;
        const dataUrl = `data:${mimeType};base64,${base64}`;

        res.json({ url: dataUrl });
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});