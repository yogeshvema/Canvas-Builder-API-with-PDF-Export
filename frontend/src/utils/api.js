// src/utils/api.js

// Render backend URL
export const API_BASE_URL = "https://canvas-backend-7ukd.onrender.com";
// export const API_BASE_URL = "http://localhost:3000";

// Initialize canvas
export const initCanvas = async (width, height) => {
  const res = await fetch(`${API_BASE_URL}/api/canvas/init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ width, height }),
  });

  if (!res.ok) {
    throw new Error("Failed to initialize canvas");
  }

  return res.json();
};

// Export PDF
export const exportPDF = async ({ elements, width, height }) => {
  const res = await fetch(`${API_BASE_URL}/api/canvas/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      width,
      height,
      elements, // 🔥 MUST be an ARRAY (NOT stringified)
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "PDF export failed");
  }

  return await res.blob(); // ✅ real PDF blob
};
