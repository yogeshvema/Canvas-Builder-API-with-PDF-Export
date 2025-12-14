const express = require('express');
const cors = require('cors');
const { createCanvas, loadImage } = require('canvas');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large canvas data

// Multer setup for image uploads
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

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
app.post('/api/canvas/export', upload.any(), async (req, res) => {
    try {
        const { width, height, elements } = req.body;
        const parsedElements = typeof elements === 'string' ? JSON.parse(elements) : elements;

        const doc = new PDFDocument({
            size: [parseInt(width), parseInt(height)],
            compress: true
        });

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=canvas-export.pdf');

        doc.pipe(res);

        // Draw elements
        for (const el of parsedElements) {
            if (el.type === 'rect') {
                doc.rect(el.x, el.y, el.width, el.height).fill(el.color);
            } else if (el.type === 'circle') {
                doc.circle(el.x + el.radius, el.y + el.radius, el.radius).fill(el.color);
            } else if (el.type === 'text') {
                doc.fontSize(el.fontSize || 12).fillColor(el.color || 'black').text(el.text, el.x, el.y);
            } else if (el.type === 'image' && el.src) {
                try {
                    // Remove data URI prefix if present
                    const base64Data = el.src.replace(/^data:image\/\w+;base64,/, "");
                    const imgBuffer = Buffer.from(base64Data, 'base64');
                    doc.image(imgBuffer, el.x, el.y, { width: el.width, height: el.height });
                } catch (err) {
                    console.error('Error drawing image:', err);
                }
            }
        }

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
