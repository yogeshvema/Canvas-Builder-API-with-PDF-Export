# 🎨 Canvas Builder API

A full-stack web application that allows users to create, edit, and export canvas designs as high-quality PDF files. The project provides a backend API for canvas manipulation and a simple interactive frontend for previewing designs and triggering PDF exports.

---

## 🚀 Features

* Initialize a canvas with custom width and height
* Add basic shapes:

  * Rectangles
  * Circles
* Add text elements with custom styling
* Add images using image URLs or file upload
* Live preview of canvas on the frontend
* Export the final canvas as a **high-quality PDF**
* Basic PDF size optimization

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
npm start
npm run dev(if nodemon is used)
```

Server will run at:

```
echo Backend running on http://localhost:3000
echo Frontend running on http://localhost:5173
```

---

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend will run at:

```
http://localhost:3000
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

