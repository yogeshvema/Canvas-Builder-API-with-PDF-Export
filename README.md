# 🎨 Canvas Builder API

A full-stack web application that allows users to create, edit, and export canvas designs as high-quality PDF files. The project provides a backend API for canvas manipulation and a simple interactive frontend for previewing designs and triggering PDF exports.

---

## 🚀 Features

* Initialize a canvas with custom width and height
* Add multiple drawable elements:

  * Rectangles
  * Circles
  * Triangles
  * Pentagons
* Add text elements with custom styling
* Add images via file upload
* Select, move, and visually highlight elements on the canvas
* Change element colors dynamically
* Layer management (bring forward / send backward)
* Delete selected elements
* Save canvas state
* Load previously saved canvas designs
* Live preview of canvas on the frontend
* Export the final canvas as a **high-quality PDF**
* Basic PDF size optimization

## ✨ New Features & Functionality

### 🎨 Styling & Appearance
| Feature | Description |
|------|------------|
| Element Opacity Control | Control transparency (opacity) of all non-image elements using a dedicated slider in the properties panel. |
| Color Picker Presets | 8 pre-defined color swatches for quick and efficient color selection in the ElementProperties panel. |

---

### 🔄 Element Manipulation
| Feature | Description |
|------|------------|
| Rotation Control | Rotate shapes and text using a slider or quick-rotate button. Canvas rendering logic correctly handles transformations. |
| Live Text Editing | Edit text content via a textarea in the properties sidebar after creation. |

---

### 🧠 User Experience (UX)
| Feature | Description |
|------|------------|
| Toast Notification System | Non-blocking toast notifications replace browser alerts for actions like Save, Load, Copy/Paste, Undo/Redo, and Export. |
| Visual Clipboard Indicator | A small header banner confirms when an element is copied and ready to paste. |

---

### 📦 Grouping (Conceptual)
| Feature | Description |
|------|------------|
| Group / Ungroup | Toggles an `isGrouped` boolean on selected elements, laying the foundation for multi-selection and complex grouping logic. |

---

### 🧭 Sidebar & Interaction Improvements
- **Sidebar UX Optimization (CRITICAL):**  
  Reworked sidebar flow to ensure ElementProperties (color, rotation, opacity, layers) is immediately visible without scrolling.

- **Fixed Text Element Selection:**  
  Improved hit detection logic using robust bounding box calculations so text elements can be selected from any visible area.

---

### 📐 Grid & Alignment
| Feature | Description |
|------|------------|
| Grid Snapping | Visual grid with snap-to-grid support during drag and resize operations. |

---

### 🎯 Basic Styling Support
| Feature | Description |
|------|------------|
| Stroke Styling | Shapes (rect, circle, polygon) now support configurable `strokeWidth` and `strokeColor`. |

---

## 🛠️ Tech Stack

### Frontend

* HTML, CSS, JavaScript
* React (for interactive UI)

### Backend

* Node.js
* Express.js

### Canvas & PDF

* HTML5 Canvas (Node Canvas)
* PDFKit / canvas-to-pdf

---

## 📂 Project Structure

```
canvas-builder-api/
│
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   └── package.json
│
├── .gitignore
├── README.md
└── package.json
```

---

## 🔗 API Endpoints

### Initialize Canvas

```
POST /api/canvas/init
```

**Body:**

```json
{
  "width": 800,
  "height": 600
}
```

---

### Add Rectangle

```
POST /api/canvas/rectangle
```

### Add Circle

```
POST /api/canvas/circle
```

### Add Text

```
POST /api/canvas/text
```

### Add Image

```
POST /api/canvas/image
```

---

### Export Canvas as PDF

```
GET /api/canvas/export/pdf
```

Returns a downloadable PDF file.

---

## ▶️ Getting Started

### Prerequisites

* Node.js (v16 or later)
* npm or yarn

---

### Backend Setup

```bash
cd backend
npm install
node server.js
```

Server will run at:

```
http://localhost:3000
```

---

### Frontend Setup

```bash
cd frontend
npm install
npm run dev

```
Server will run at:

```
http://localhost:5173
```

---

## 📄 PDF Export

* Uses server-side canvas rendering
* Generates optimized, high-quality PDFs
* Supports download directly from the frontend

---

## 🌐 Deployment

* Backend: Node.js server
* Frontend: Deployed on **Vercel** (or equivalent)

---

## ✅ Assignment Compliance

This project fulfills all requirements mentioned in the assignment:

* Canvas initialization
* Shape, text, and image rendering
* PDF export functionality
* Clean project structure
* Hosted and documented on GitHub

---

## 📌 Future Improvements

* Layer management (z-index)
* Undo / Redo support
* Drag & resize elements
* Multiple canvas pages

---

## 👤 Author

**Yogesh Kumar**
B.Tech, IIT Mandi

---

⭐ If you find this project useful, feel free to star the repository!
