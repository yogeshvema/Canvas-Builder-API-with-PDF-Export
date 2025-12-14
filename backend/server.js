const express = require('express');
const cors = require('cors');
const { createCanvas, loadImage } = require('canvas');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// --- Setup ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multer setup for image uploads
const upload = multer({ dest: 'uploads/' });

// Ensure directories exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
const PROJECTS_DB_PATH = path.join(__dirname, 'projects.json');
if (!fs.existsSync(PROJECTS_DB_PATH)) {
    fs.writeFileSync(PROJECTS_DB_PATH, JSON.stringify({}));
}

// Serve static uploaded assets
app.use('/assets', express.static(path.join(__dirname, 'uploads')));

// --- Utility Functions (Simulated DB) ---

const loadProjectsDB = () => {
    try {
        const data = fs.readFileSync(PROJECTS_DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading projects.json:", error);
        return {};
    }
};

const saveProjectsDB = (projects) => {
    fs.writeFileSync(PROJECTS_DB_PATH, JSON.stringify(projects, null, 2), 'utf8');
};


// --- API Endpoints ---

// 1. ASSET UPLOAD ENDPOINT
app.post('/api/assets/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Create a unique name with extension
        const extension = path.extname(req.file.originalname) || '.png';
        const newFileName = req.file.filename + extension;
        const newPath = path.join('uploads', newFileName);
        
        fs.renameSync(req.file.path, newPath);

        // Return the URL path
        const fileUrl = `/assets/${newFileName}`; 

        res.json({ 
            message: 'File uploaded successfully', 
            url: fileUrl 
        });
    } catch (error) {
        console.error('Error handling uploaded file:', error);
        res.status(500).json({ error: 'Failed to process file' });
    }
});

// 2. PROJECT PERSISTENCE ENDPOINTS

// Save Project (POST/PUT)
app.post('/api/projects/save', (req, res) => {
    try {
        // In a real app, you would require authentication and check userId
        const { id, name, canvasSize, elements } = req.body;
        const projects = loadProjectsDB();
        const now = new Date().toISOString();
        let projectId = id;
        
        const projectData = {
            name: name || `Untitled Project ${Object.keys(projects).length + 1}`,
            userId: 'demo_user', 
            canvasSize,
            elements: JSON.stringify(elements), // Store the elements array as a string
            updatedAt: now,
        };

        if (id && projects[id]) {
            projects[id] = { ...projects[id], ...projectData };
        } else {
            projectId = `proj_${Date.now()}`;
            projects[projectId] = { ...projectData, createdAt: now, id: projectId };
        }

        saveProjectsDB(projects);
        res.json({ message: 'Project saved successfully', projectId: projectId, updatedAt: now });

    } catch (error) {
        console.error('Error saving project:', error);
        res.status(500).json({ error: 'Failed to save project' });
    }
});

// Load Project (GET)
app.get('/api/projects/load/:id', (req, res) => {
    try {
        const projects = loadProjectsDB();
        const project = projects[req.params.id];

        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({
            projectId: project.id,
            name: project.name,
            canvasSize: project.canvasSize,
            elements: JSON.parse(project.elements), // Parse the elements array back
            updatedAt: project.updatedAt
        });

    } catch (error) {
        console.error('Error loading project:', error);
        res.status(500).json({ error: 'Failed to load project' });
    }
});

// 3. EXPORT ENDPOINTS

// Export PDF
app.post('/api/canvas/export/pdf', async (req, res) => {
    try {
        const { width, height, elements } = req.body;
        const parsedElements = JSON.parse(elements);

        const doc = new PDFDocument({
            size: [parseInt(width), parseInt(height)],
            compress: true
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=canvas-export.pdf');

        doc.pipe(res);

        for (const el of parsedElements) {
            // NOTE: PDFKit drawing is simpler and needs careful implementation for shapes/text styles
            if (el.type === 'rect') {
                doc.rect(el.x, el.y, el.width, el.height)
                   .fill(el.color);
            } else if (el.type === 'circle') {
                doc.circle(el.x + el.radius, el.y + el.radius, el.radius)
                   .fill(el.color);
            } else if (el.type === 'text') {
                doc.fontSize(el.fontSize || 12)
                   .fillColor(el.color || 'black')
                   .text(el.text, el.x, el.y, { opacity: el.opacity || 1 });
            } else if (el.type === 'image' && el.src) {
                const isLocalAsset = el.src.startsWith('/assets/');
                const imagePath = isLocalAsset 
                    ? path.join(__dirname, 'uploads', path.basename(el.src))
                    : null; // External or Data URI fallback

                if (isLocalAsset && imagePath && fs.existsSync(imagePath)) {
                    // Draw local image from file path
                    doc.image(imagePath, el.x, el.y, { width: el.width, height: el.height, opacity: el.opacity || 1 });
                } else if (el.src.startsWith('data:image')) {
                    // Handle Data URI (less efficient)
                    const base64Data = el.src.replace(/^data:image\/\w+;base64,/, "");
                    const imgBuffer = Buffer.from(base64Data, 'base64');
                    doc.image(imgBuffer, el.x, el.y, { width: el.width, height: el.height, opacity: el.opacity || 1 });
                }
            }
        }

        doc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});


// Export PNG (Server-Side Raster Rendering)
app.post('/api/canvas/export/png', async (req, res) => {
    try {
        const { width, height, elements, settings = {} } = req.body;
        const parsedElements = JSON.parse(elements);
        
        // Use a scale factor for high resolution (e.g., 2x for high-DPI)
        const scale = settings.scale || 2; 
        const canvasWidth = parseInt(width);
        const canvasHeight = parseInt(height);

        const canvas = createCanvas(canvasWidth * scale, canvasHeight * scale);
        const ctx = canvas.getContext('2d');
        
        ctx.scale(scale, scale);

        // 1. Draw White Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. Draw Elements 
        for (const el of parsedElements) {
            ctx.save(); // Save context before applying transformations/opacity

            // Apply Opacity
            ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;

            // --- NOTE: Full rotation logic would need to be re-implemented here ---
            // Simplified drawing for demonstration:

            if (el.type === 'rect') {
                ctx.fillStyle = el.color;
                ctx.fillRect(el.x, el.y, el.width, el.height);
            } else if (el.type === 'circle') {
                ctx.fillStyle = el.color;
                ctx.beginPath();
                ctx.arc(el.x + el.radius, el.y + el.radius, el.radius, 0, 2 * Math.PI);
                ctx.fill();
            } else if (el.type === 'text') {
                ctx.font = `${el.fontSize || 12}px Arial`;
                ctx.fillStyle = el.color || 'black';
                ctx.fillText(el.text, el.x, el.y);
            } else if (el.type === 'image' && el.src) {
                const isLocalAsset = el.src.startsWith('/assets/');
                const imagePath = isLocalAsset 
                    ? path.join(__dirname, 'uploads', path.basename(el.src))
                    : el.src; 

                try {
                    const image = await loadImage(imagePath);
                    ctx.drawImage(image, el.x, el.y, el.width, el.height);
                } catch (imgError) {
                    console.error('Failed to load image for PNG export:', imgError);
                }
            }
            
            ctx.restore();
        }

        // Send the PNG buffer
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', 'attachment; filename=canvas-export.png');
        canvas.createPNGStream().pipe(res);

    } catch (error) {
        console.error('Error generating PNG:', error);
        res.status(500).json({ error: 'Failed to generate PNG' });
    }
});


// 4. Server Start
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});