import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
// Import the real API functions and URL from your utility file
import { API_BASE_URL, exportPDF } from "./utils/api";
// Import lucide-react icons
import { Square, Circle, Type, Image as ImageIcon, Download, MousePointer2, Triangle, Hexagon, Palette, Undo, Redo, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Save, FolderOpen, Grid, PenTool, RotateCw, Clipboard, CheckCircle, XCircle, Ungroup, Group } from 'lucide-react';

// --- Constants ---
// Resize sensitivity: 1.0 = normal, 0.5 = slower, 2.0 = faster
const RESIZE_SENSITIVITY_FACTOR = 0.5;
const MAX_HISTORY_LENGTH = 50;
const SNAP_TOLERANCE = 5;
const TEXT_BOUNDING_BUFFER = 5;
const COLOR_PRESETS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#000000', '#ffffff', '#6366f1', '#e879f9'];

// --- Toast/Notification Component ---
const Toast = ({ message, type, onClose }) => {
    const icon = type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />;
    const colorClass = type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);
    return (
        <div className={`fixed bottom-4 right-4 z-50 p-4 rounded-lg shadow-xl text-white flex items-center gap-3 transition-opacity duration-300 ${colorClass}`}>
            {icon}
            <span>{message}</span>
            <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
                &times;
            </button>
        </div>
    );
};

// --- Context Menu Component (Externalized) ---
const ContextMenu = ({ x, y, elementId, selectedId, copiedElement, onAction, onClose }) => {
    const isElementSelected = elementId !== null && elementId === selectedId;
    const isCopiedElementArray = Array.isArray(copiedElement) && copiedElement.length > 0;

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (e.button === 0 && !e.target.closest('.custom-context-menu')) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            className="custom-context-menu absolute z-50 rounded-lg shadow-xl bg-gray-800 text-white p-1 border border-gray-700"
            style={{ top: y, left: x, minWidth: 180 }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <ul className="list-none p-0 m-0">

                <li className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-600 rounded-md transition ${isElementSelected ? '' : 'opacity-50 cursor-not-allowed'}`}
                    onClick={isElementSelected ? () => onAction('bring-front') : null}>
                    Bring to Front (Ctrl+])
                </li>
                <li className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-600 rounded-md transition ${isElementSelected ? '' : 'opacity-50 cursor-not-allowed'}`}
                    onClick={isElementSelected ? () => onAction('send-back') : null}>
                    Send to Back (Ctrl+[)
                </li>
                <li className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-600 rounded-md transition ${isElementSelected ? '' : 'opacity-50 cursor-not-allowed'}`}
                    onClick={isElementSelected ? () => onAction('duplicate') : null}>
                    Duplicate (Ctrl+D)
                </li>

                <hr className="my-1 border-gray-700" />

                <li className={`px-3 py-2 text-sm cursor-pointer hover:bg-emerald-600 rounded-md transition ${isElementSelected ? '' : 'opacity-50 cursor-not-allowed'}`}
                    onClick={isElementSelected ? () => onAction('copy') : null}>
                    Copy (Ctrl+C)
                </li>

                <li className={`px-3 py-2 text-sm cursor-pointer hover:bg-emerald-600 rounded-md transition ${isCopiedElementArray ? '' : 'opacity-50 cursor-not-allowed'}`}
                    onClick={isCopiedElementArray ? () => onAction('paste') : null}>
                    Paste (Ctrl+V)
                </li>

                <hr className="my-1 border-gray-700" />

                <li className={`flex items-center px-3 py-2 text-sm cursor-pointer rounded-md transition ${isElementSelected ? 'bg-red-600 hover:bg-red-700 font-semibold' : 'opacity-50 cursor-not-allowed text-red-300'}`}
                    onClick={isElementSelected ? () => onAction('delete') : null}>
                    Delete (Del/Back)
                </li>
            </ul>
        </div>
    );
};

// --- Element Properties Component (Externalized) ---
const ElementProperties = ({ selectedElement, setElements, setSelectedIds, moveLayer, moveLayerToExtreme, toggleGroupStatus, isExpanded, toggleExpand }) => {

    const isImage = selectedElement?.type === 'image';
    const isText = selectedElement?.type === 'text';
    const isShape = selectedElement && !isImage && !isText;

    if (!selectedElement) {
        return null;
    }

    const currentColor = selectedElement.color || '#000000';
    const currentFontSize = selectedElement.fontSize || 24;
    const currentStrokeWidth = selectedElement.strokeWidth || 0;
    const currentStrokeColor = selectedElement.strokeColor || '#000000';
    const currentRotation = selectedElement.rotation || 0;
    const currentOpacity = selectedElement.opacity !== undefined ? selectedElement.opacity : 1;

    const handleStyleChange = (key, value) => {
        setElements(prevElements =>
            prevElements.map(el =>
                el.id === selectedElement.id
                    ? { ...el, [key]: value }
                    : el
            )
        );
    };

    const handleTextContentChange = (e) => handleStyleChange('text', e.target.value);
    const handleColorChange = (e) => handleStyleChange('color', e.target.value);
    const handleFontSizeChange = (e) => handleStyleChange('fontSize', parseInt(e.target.value));
    const handleStrokeColorChange = (e) => handleStyleChange('strokeColor', e.target.value);
    const handleStrokeWidthChange = (e) => handleStyleChange('strokeWidth', parseInt(e.target.value) || 0);
    const handleRotationChange = (e) => handleStyleChange('rotation', parseInt(e.target.value) || 0);
    const handleOpacityChange = (e) => handleStyleChange('opacity', parseFloat(e.target.value));

    const handleDelete = () => {
        setElements(prevElements => prevElements.filter(el => el.id !== selectedElement.id));
        setSelectedIds([]);
    };

    const isGrouped = selectedElement.isGrouped || false;

    return (
        // Changed outer div to always show header, using padding to prevent inner content shift
        <div className="border-t border-white/10 bg-white/5">
            {/* Collapse/Expand Header (Always visible when an element is selected) */}
            <div className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-white/10 transition" onClick={toggleExpand}>
                <h2 className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">
                    Selected Element (Primary)
                </h2>
                <button title={isExpanded ? "Collapse Properties" : "Expand Properties"}>
                    {isExpanded ? <ChevronUp size={16} className="text-white" /> : <ChevronDown size={16} className="text-white" />}
                </button>
            </div>

            {/* Collapsible Content Area */}
            {isExpanded && (
                <div className="p-6 pt-0">
                    <p className="text-xs text-emerald-300 mb-4">ID: {selectedElement.id}</p>

                    {/* Text Content Input */}
                    {isText && (
                        <div className="mb-4 p-3 bg-white/10 rounded-lg">
                            <label className="text-xs text-emerald-300 mb-2 block">Text Content</label>
                            <textarea
                                rows="3"
                                value={selectedElement.text}
                                onChange={handleTextContentChange}
                                className="w-full bg-white/20 border border-white/20 text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                            />
                        </div>
                    )}

                    {/* Fill Color Picker Section */}
                    {!isImage && (
                        <div className="mb-4 p-3 bg-white/10 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Palette size={18} className="text-emerald-300" />
                                    <span className="text-sm font-medium text-white">{isText ? 'Text Color' : 'Fill Color'}</span>
                                </div>

                                <input
                                    type="color"
                                    value={currentColor}
                                    onChange={handleColorChange}
                                    className="w-8 h-8 cursor-pointer rounded-full border-2 border-white/50 overflow-hidden"
                                    title="Choose element color"
                                />
                            </div>

                            {/* Color Presets */}
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10 mt-2">
                                {COLOR_PRESETS.map((color) => (
                                    <button
                                        key={color}
                                        style={{ backgroundColor: color }}
                                        className={`w-6 h-6 rounded-full border-2 transition ${currentColor === color ? 'border-white ring-2 ring-emerald-400' : 'border-transparent'}`}
                                        onClick={() => handleStyleChange('color', color)}
                                        title={color}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Stroke/Border Controls */}
                    {isShape && (
                        <div className="mb-4 p-3 bg-white/10 rounded-lg">
                            <h3 className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-2">Border/Stroke</h3>

                            {/* Stroke Width Slider */}
                            <div className="mb-3">
                                <label className="text-xs text-emerald-300 mb-2 block">Width ({currentStrokeWidth}px)</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="20"
                                    value={currentStrokeWidth}
                                    onChange={handleStrokeWidthChange}
                                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            {/* Stroke Color Picker */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <PenTool size={18} className="text-emerald-300" />
                                    <span className="text-sm font-medium text-white">Stroke Color</span>
                                </div>
                                <input
                                    type="color"
                                    value={currentStrokeColor}
                                    onChange={handleStrokeColorChange}
                                    className="w-8 h-8 cursor-pointer rounded-full border-2 border-white/50 overflow-hidden"
                                    title="Choose border color"
                                />
                            </div>
                        </div>
                    )}

                    {/* Opacity Control */}
                    <div className="mb-4 p-3 bg-white/10 rounded-lg">
                        <label className="text-xs text-emerald-300 mb-2 block">Opacity ({Math.round(currentOpacity * 100)}%)</label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={currentOpacity}
                            onChange={handleOpacityChange}
                            className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    {/* Rotation Control */}
                    {!isImage && (
                        <div className="mb-4 p-3 bg-white/10 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <RotateCw size={18} className="text-emerald-300" />
                                    <span className="text-sm font-medium text-white">Rotation ({currentRotation}°)</span>
                                </div>
                                <button
                                    onClick={() => handleStyleChange('rotation', (currentRotation + 45) % 360)}
                                    className="p-1 bg-white/10 text-emerald-300 rounded-md hover:bg-emerald-600 hover:text-white transition"
                                    title="Rotate 45 degrees"
                                >
                                    <RotateCw size={16} />
                                </button>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="360"
                                value={currentRotation}
                                onChange={handleRotationChange}
                                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    )}

                    {/* Font Size Control for Text */}
                    {isText && (
                        <div className="mb-4 p-3 bg-white/10 rounded-lg">
                            <label className="text-xs text-emerald-300 mb-2 block">Font Size ({currentFontSize}px)</label>
                            <input
                                type="range"
                                min="8"
                                max="120"
                                value={currentFontSize}
                                onChange={handleFontSizeChange}
                                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    )}

                    {/* Grouping Button (Conceptual) */}
                    <button
                        onClick={() => toggleGroupStatus(selectedElement.id)}
                        className={`mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-semibold transition ${isGrouped ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-400/30 hover:bg-indigo-700/40' : 'bg-gray-500/20 text-gray-300 border border-gray-400/30 hover:bg-gray-600/30'}`}
                    >
                        {isGrouped ? <Ungroup size={16} /> : <Group size={16} />}
                        {isGrouped ? 'Ungroup' : 'Group (Conceptual)'}
                    </button>

                    {/* Layer Controls */}
                    <div className="mb-4 mt-4">
                        <h3 className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-2">Layer Order</h3>
                        <div className="grid grid-cols-4 gap-2">
                            <button onClick={() => moveLayerToExtreme(selectedElement.id, 'front')} className="p-2 bg-white/10 text-emerald-300 rounded-md hover:bg-emerald-600 hover:text-white transition" title="Bring to Front (Ctrl+])">
                                <ChevronsUp size={16} />
                            </button>
                            <button onClick={() => moveLayer(selectedElement.id, 'forward')} className="p-2 bg-white/10 text-emerald-300 rounded-md hover:bg-emerald-600 hover:text-white transition" title="Bring Forward (Ctrl+Shift+])">
                                <ChevronUp size={16} />
                            </button>
                            <button onClick={() => moveLayer(selectedElement.id, 'backward')} className="p-2 bg-white/10 text-emerald-300 rounded-md hover:bg-emerald-600 hover:text-white transition" title="Send Backward (Ctrl+Shift+[)">
                                <ChevronDown size={16} />
                            </button>
                            <button onClick={() => moveLayerToExtreme(selectedElement.id, 'back')} className="p-2 bg-white/10 text-emerald-300 rounded-md hover:bg-emerald-600 hover:text-white transition" title="Send to Back (Ctrl+[)">
                                <ChevronsDown size={16} />
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={handleDelete}
                        className="mt-4 w-full bg-red-500/20 text-red-200 border border-red-400/30 py-2 rounded-md text-xs font-semibold hover:bg-red-500/30 transition"
                    >
                        Delete Element (Del/Backspace)
                    </button>
                    <p className="text-xs text-emerald-300 mt-2 italic">Right-click on the canvas element for more actions.</p>
                </div>
            )}
        </div>
    );
};


function App() {
    const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 1000 });
    const [elements, setElements] = useState([]);

    const [selectedIds, setSelectedIds] = useState([]);
    const [projectId, setProjectId] = useState(null);

    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const [isResizing, setIsResizing] = useState(false);
    const [resizeHandle, setResizeHandle] = useState(null);
    const [resizeStartPoint, setResizeStartPoint] = useState({ x: 0, y: 0 });
    const [resizeStartBounds, setResizeStartBounds] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [copiedElement, setCopiedElement] = useState([]);

    const [history, setHistory] = useState([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [activeGuides, setActiveGuides] = useState({ x: [], y: [] });
    const [showGrid, setShowGrid] = useState(false);
    const [gridSize, setGridSize] = useState(50);

    const [toast, setToast] = useState(null);

    // NEW STATE: For collapsible element properties panel
    const [isPropertiesExpanded, setIsPropertiesExpanded] = useState(true);
    const togglePropertiesExpand = useCallback(() => {
        setIsPropertiesExpanded(prev => !prev);
    }, []);

    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const loadFileInputRef = useRef(null);

    const ctxRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current) {
            ctxRef.current = canvasRef.current.getContext('2d');
        }
    }, []);

    const selectedElements = elements.filter(el => selectedIds.includes(el.id));
    const primarySelected = selectedElements[selectedElements.length - 1] || null;

    // Auto-expand properties when a new element is selected
    useEffect(() => {
        if (primarySelected) {
            setIsPropertiesExpanded(true);
        }
    }, [primarySelected]);

    const toggleGroupStatus = useCallback((id) => {
        const element = elements.find(el => el.id === id);
        const isCurrentlyGrouped = element?.isGrouped || false;

        setElements(prevElements =>
            prevElements.map(el =>
                el.id === id
                    ? { ...el, isGrouped: !isCurrentlyGrouped }
                    : el
            )
        );
        setToast({ message: isCurrentlyGrouped ? 'Element ungrouped (Concept).' : 'Element marked as grouped (Concept).', type: 'success' });
    }, [elements, setToast]);

    const saveHistory = useCallback((newElements) => {
        setHistory(prevHistory => {
            const newHistory = prevHistory.slice(0, historyIndex + 1);

            if (JSON.stringify(newHistory[newHistory.length - 1]) === JSON.stringify(newElements)) {
                return prevHistory;
            }
            if (newHistory.length >= MAX_HISTORY_LENGTH) {
                newHistory.shift();
            } else {
                setHistoryIndex(newHistory.length);
            }

            return [...newHistory, newElements];
        });
    }, [historyIndex]);

    const isIgnoringHistory = useRef(false);

    useEffect(() => {
        if (isIgnoringHistory.current) {
            isIgnoringHistory.current = false;
            return;
        }

        const timeout = setTimeout(() => {
            const serializableElements = elements.map(({ img, ...rest }) => rest);
            saveHistory(serializableElements);
        }, 100);

        return () => clearTimeout(timeout);
    }, [elements, saveHistory]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            isIgnoringHistory.current = true;
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);

            const elementsToLoad = history[newIndex];

            const newElements = elementsToLoad.map(el => {
                if (el.type === 'image' && el.src) {
                    const img = new Image();
                    img.onload = () => {
                        setElements(prev => prev.map(p => p.id === el.id ? { ...p, img: img } : p));
                    };
                    img.src = el.src;
                    return { ...el, img: img };
                }
                return el;
            });
            setElements(newElements);
            setSelectedIds([]);
            setToast({ message: 'Undo successful.', type: 'success' });
        } else {
            setToast({ message: 'Nothing left to undo.', type: 'error' });
        }
    }, [history, historyIndex, setToast]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            isIgnoringHistory.current = true;
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);

            const elementsToLoad = history[newIndex];
            const newElements = elementsToLoad.map(el => {
                if (el.type === 'image' && el.src) {
                    const img = new Image();
                    img.onload = () => {
                        setElements(prev => prev.map(p => p.id === el.id ? { ...p, img: img } : p));
                    };
                    img.src = el.src;
                    return { ...el, img: img };
                }
                return el;
            });

            setElements(newElements);
            setSelectedIds([]);
            setToast({ message: 'Redo successful.', type: 'success' });
        } else {
            setToast({ message: 'Nothing left to redo.', type: 'error' });
        }
    }, [history, historyIndex, setToast]);

    const moveLayer = useCallback((id, direction) => {
        setElements(prevElements => {
            const index = prevElements.findIndex(el => el.id === id);
            if (index === -1) return prevElements;
            const element = prevElements[index];
            const newElements = [...prevElements];

            if (direction === 'forward' && index < newElements.length - 1) {
                newElements.splice(index, 1);
                newElements.splice(index + 1, 0, element);
            } else if (direction === 'backward' && index > 0) {
                newElements.splice(index, 1);
                newElements.splice(index - 1, 0, element);
            }
            return newElements;
        });
    }, []);

    const moveLayerToExtreme = useCallback((id, position) => {
        setElements(prevElements => {
            const index = prevElements.findIndex(el => el.id === id);
            if (index === -1) return prevElements;
            const element = prevElements[index];
            const newElements = prevElements.filter(el => el.id !== id);

            if (position === 'front') {
                newElements.push(element);
            } else if (position === 'back') {
                newElements.unshift(element);
            }
            return newElements;
        });
    }, []);

    const getPolygonVertices = (sides, cx, cy, radius) => {
        const vertices = [];
        const startAngle = -Math.PI / 2;
        for (let i = 0; i < sides; i++) {
            const angle = startAngle + i * 2 * Math.PI / sides;
            vertices.push({
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle),
            });
        }
        return vertices;
    };

    const drawPolygonPath = (ctx, el) => {
        const radius = el.size / 2;
        const cx = el.x + radius;
        const cy = el.y + radius;

        const vertices = getPolygonVertices(el.sides, cx, cy, radius);

        ctx.beginPath();
        if (vertices.length > 0) {
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
                ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.closePath();
        }
    };

    const getElementBounds = useCallback((el, ctx) => {
        let x, y, w, h;
        const strokeOffset = (el.strokeWidth || 0) / 2;

        if (el.type === 'rect' || el.type === 'image') {
            x = el.x - strokeOffset;
            y = el.y - strokeOffset;
            w = el.width + (strokeOffset * 2);
            h = el.height + (strokeOffset * 2);
        } else if (el.type === 'circle') {
            x = el.x - strokeOffset;
            y = el.y - strokeOffset;
            w = el.radius * 2 + (strokeOffset * 2);
            h = el.radius * 2 + (strokeOffset * 2);
        } else if (el.type === 'polygon') {
            x = el.x - strokeOffset;
            y = el.y - strokeOffset;
            w = el.size + (strokeOffset * 2);
            h = el.size + (strokeOffset * 2);
        } else if (el.type === 'text' && ctx) {
            ctx.font = `${el.fontSize || 12}px Arial`;
            const textMetrics = ctx.measureText(el.text);
            const ascent = textMetrics.actualBoundingBoxAscent || (el.fontSize * 0.8);
            const descent = textMetrics.actualBoundingBoxDescent || (el.fontSize * 0.2);
            const width = textMetrics.width;

            y = el.y - ascent;
            w = width;
            h = ascent + descent;
            x = el.x;

            x -= TEXT_BOUNDING_BUFFER;
            y -= TEXT_BOUNDING_BUFFER;
            w += 2 * TEXT_BOUNDING_BUFFER;
            h += 2 * TEXT_BOUNDING_BUFFER;
        } else if (el.type === 'text') {
            const height = el.fontSize || 12;
            const width = (el.text.length * height) * 0.6;
            x = el.x; y = el.y - height; w = width; h = height;
        } else {
            return { x: 0, y: 0, w: 0, h: 0 };
        }
        return { x: x, y: y, w: w, h: h };
    }, []);

    const getSnapGuides = useCallback((currentElementId, canvasW, canvasH) => {
        const allGuides = { x: [], y: [] };

        allGuides.x.push(0, canvasW / 2, canvasW);
        allGuides.y.push(0, canvasH / 2, canvasH);

        elements.forEach(el => {
            if (el.id === currentElementId) return;
            const bounds = getElementBounds(el, ctxRef.current);

            allGuides.x.push(bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w);
            allGuides.y.push(bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h);
        });

        if (showGrid && gridSize > 0) {
            for (let i = 0; i <= canvasW; i += gridSize) {
                allGuides.x.push(i);
            }
            for (let i = 0; i <= canvasH; i += gridSize) {
                allGuides.y.push(i);
            }
        }
        allGuides.x = [...new Set(allGuides.x.map(Math.round))];
        allGuides.y = [...new Set(allGuides.y.map(Math.round))];
        return allGuides;
    }, [elements, getElementBounds, showGrid, gridSize]);

    const applySnap = (newX, newY, newW, newH, guides) => {
        const tolerance = SNAP_TOLERANCE;
        const snap = { x: newX, y: newY, guides: { x: [], y: [] } };

        const checkX = [newX, newX + newW / 2, newX + newW];
        for (let i = 0; i < checkX.length; i++) {
            const elementPos = checkX[i];
            for (const guideX of guides.x) {
                if (Math.abs(elementPos - guideX) < tolerance) {
                    const offset = guideX - elementPos;
                    snap.x += offset;
                    snap.guides.x.push(guideX);
                    i = checkX.length;
                    break;
                }
            }
        }
        const checkY = [newY, newY + newH / 2, newY + newH];
        for (let i = 0; i < checkY.length; i++) {
            const elementPos = checkY[i];
            for (const guideY of guides.y) {
                if (Math.abs(elementPos - guideY) < tolerance) {
                    const offset = guideY - elementPos;
                    snap.y += offset;
                    snap.guides.y.push(guideY);
                    i = checkY.length;
                    break;
                }
            }
        }

        return snap;
    };

    const isPointInElement = useCallback((x, y, el) => {
        const ctx = ctxRef.current;
        if (!ctx) return false;

        const bounds = getElementBounds(el, ctx);

        if (el.type === 'rect' || el.type === 'image' || el.type === 'text' || el.type === 'polygon') {
            return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
        } else if (el.type === 'circle') {
            if (x < bounds.x || x > bounds.x + bounds.w || y < bounds.y || y > bounds.y + bounds.h) return false;

            const radius = el.radius + (el.strokeWidth || 0) / 2;
            const cx = el.x + el.radius;
            const cy = el.y + el.radius;
            const dx = x - cx;
            const dy = y - cy;

            return (dx * dx) + (dy * dy) <= (radius * radius);
        }
        return false;
    }, [getElementBounds]);

    const isPointOnHandle = useCallback((px, py, el) => {
        const ctx = ctxRef.current;
        const handleSize = 8;
        const halfHandle = handleSize / 2;
        const bounds = getElementBounds(el, ctx);
        const handles = {
            'tl': { x: bounds.x, y: bounds.y },
            'tr': { x: bounds.x + bounds.w, y: bounds.y },
            'bl': { x: bounds.x, y: bounds.y + bounds.h },
            'br': { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
        };
        for (const [key, pos] of Object.entries(handles)) {
            if (
                px >= pos.x - halfHandle && px <= pos.x + halfHandle &&
                py >= pos.y - halfHandle && py <= pos.y + halfHandle
            ) {
                return key;
            }
        }
        return null;
    }, [getElementBounds]);

    const drawHandles = (ctx, bounds) => {
        const handleSize = 8;
        const handles = [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.w, y: bounds.y },
            { x: bounds.x, y: bounds.y + bounds.h },
            { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
        ];
        ctx.fillStyle = '#10b981';
        handles.forEach(pos => {
            ctx.fillRect(pos.x - 4, pos.y - 4, handleSize, handleSize);
        });
    };

    const drawGrid = (ctx, width, height, size) => {
        if (!size || size <= 0) return;

        ctx.save();
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 0.5;

        for (let x = 0; x <= width; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += size) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        ctx.restore();
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (showGrid) {
            drawGrid(ctx, canvasSize.width, canvasSize.height, gridSize);
        }

        elements.forEach(el => {
            ctx.save();

            const color = el.color || '#000000';
            const strokeWidth = el.strokeWidth || 0;
            const rotation = el.rotation || 0;

            ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;

            if (rotation !== 0) {
                let centerX, centerY;

                if (el.type === 'rect' || el.type === 'image' || el.type === 'polygon') {
                    const w = el.width || el.size;
                    const h = el.height || el.size;
                    centerX = el.x + w / 2;
                    centerY = el.y + h / 2;
                } else if (el.type === 'circle') {
                    centerX = el.x + el.radius;
                    centerY = el.y + el.radius;
                } else if (el.type === 'text') {
                    const bounds = getElementBounds(el, ctx);
                    centerX = bounds.x + bounds.w / 2;
                    centerY = bounds.y + bounds.h / 2;
                }

                if (centerX !== undefined && centerY !== undefined) {
                    ctx.translate(centerX, centerY);
                    ctx.rotate(rotation * Math.PI / 180);
                    ctx.translate(-centerX, -centerY);
                }
            }

            if (el.type === 'rect') {
                ctx.beginPath();
                ctx.rect(el.x, el.y, el.width, el.height);
            } else if (el.type === 'circle') {
                ctx.beginPath();
                ctx.arc(el.x + el.radius, el.y + el.radius, el.radius, 0, 2 * Math.PI);
            } else if (el.type === 'polygon') {
                drawPolygonPath(ctx, el);
            }

            if (el.type !== 'text' && el.type !== 'image') {
                ctx.fillStyle = color;
                ctx.fill();
            }

            if (strokeWidth > 0 && (el.type === 'rect' || el.type === 'circle' || el.type === 'polygon')) {
                ctx.strokeStyle = el.strokeColor || '#000000';
                ctx.lineWidth = strokeWidth;
                ctx.stroke();
            }

            if (el.type === 'text') {
                ctx.fillStyle = color;
                ctx.font = `${el.fontSize || 12}px Arial`;
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(el.text, el.x, el.y);
            }

            if (el.type === 'image' && el.img) {
                ctx.drawImage(el.img, el.x, el.y, el.width, el.height);
            }

            if (selectedIds.includes(el.id)) {
                ctx.restore();
                ctx.save();
                const bounds = getElementBounds(el, ctx);

                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 1;
                ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

                if (el.id === primarySelected?.id && selectedIds.length === 1) {
                    drawHandles(ctx, bounds);
                }
            }

            ctx.restore();
        });

        ctx.save();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 2]);

        activeGuides.x.forEach(guideX => {
            ctx.beginPath();
            ctx.moveTo(guideX, 0);
            ctx.lineTo(guideX, canvas.height);
            ctx.stroke();
        });
        activeGuides.y.forEach(guideY => {
            ctx.beginPath();
            ctx.moveTo(0, guideY);
            ctx.lineTo(canvas.width, guideY);
            ctx.stroke();
        });

        ctx.restore();
        ctx.setLineDash([]);
    }, [elements, canvasSize, selectedIds, primarySelected, activeGuides, showGrid, gridSize, getElementBounds]);

    const handleMouseDown = (e) => {
        if (contextMenu && e.button === 0) {
            setContextMenu(null);
        }

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (primarySelected && selectedIds.length === 1) {
            const handle = isPointOnHandle(x, y, primarySelected);
            if (handle) {
                setIsResizing(true);
                setResizeHandle(handle);
                setResizeStartPoint({ x, y });
                setResizeStartBounds(getElementBounds(primarySelected, ctxRef.current));
                return;
            }
        }

        for (let i = elements.length - 1; i >= 0; i--) {
            if (isPointInElement(x, y, elements[i])) {
                const clickedId = elements[i].id;

                if (e.shiftKey) {
                    setSelectedIds(prev =>
                        prev.includes(clickedId)
                            ? prev.filter(id => id !== clickedId)
                            : [...prev, clickedId]
                    );
                } else {
                    setSelectedIds([clickedId]);
                }

                setIsDragging(true);
                setDragOffset({ x: x - elements[i].x, y: y - elements[i].y });
                return;
            }
        }

        setSelectedIds([]);
    };

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        const shiftKey = e.shiftKey;

        if (isDragging) {
            canvas.style.cursor = 'grabbing';
        } else if (isResizing) {
            const cursors = {
                'tl': 'nwse-resize', 'br': 'nwse-resize',
                'tr': 'nesw-resize', 'bl': 'nesw-resize'
            };
            canvas.style.cursor = cursors[resizeHandle] || 'default';
        } else if (primarySelected && selectedIds.length === 1) {
            const handle = isPointOnHandle(x, y, primarySelected);
            const cursors = {
                'tl': 'nwse-resize', 'br': 'nwse-resize',
                'tr': 'nesw-resize', 'bl': 'nesw-resize'
            };
            canvas.style.cursor = handle ? cursors[handle] : 'grab';
        } else {
            canvas.style.cursor = 'default';
        }

        if (isDragging && primarySelected) {
            const currentElement = elements.find(el => el.id === primarySelected.id);
            if (!currentElement) return;

            const dx_raw = x - (currentElement.x + dragOffset.x);
            const dy_raw = y - (currentElement.y + dragOffset.y);

            let finalDx = dx_raw;
            let finalDy = dy_raw;
            setActiveGuides({ x: [], y: [] });

            if (selectedIds.length === 1) {
                const bounds = getElementBounds(currentElement, ctxRef.current);
                const guides = getSnapGuides(primarySelected.id, canvasSize.width, canvasSize.height);

                let potentialCoreX = currentElement.x + dx_raw;
                let potentialCoreY = currentElement.y + dy_raw;

                const strokeOffset = (currentElement.strokeWidth || 0) / 2;
                let potentialBoundsX;
                let potentialBoundsY;

                if (currentElement.type === 'text') {
                    const textBoundsHeight = bounds.h - (2 * TEXT_BOUNDING_BUFFER);
                    const estimatedAscent = textBoundsHeight * 0.8;

                    potentialBoundsX = potentialCoreX - TEXT_BOUNDING_BUFFER;
                    potentialBoundsY = potentialCoreY - estimatedAscent - TEXT_BOUNDING_BUFFER;
                } else {
                    potentialBoundsX = potentialCoreX - strokeOffset;
                    potentialBoundsY = potentialCoreY - strokeOffset;
                }

                const snapResult = applySnap(
                    potentialBoundsX,
                    potentialBoundsY,
                    bounds.w,
                    bounds.h,
                    guides
                );

                const snapCorrectionX = snapResult.x - potentialBoundsX;
                const snapCorrectionY = snapResult.y - potentialBoundsY;

                finalDx = dx_raw + snapCorrectionX;
                finalDy = dy_raw + snapCorrectionY;

                setActiveGuides(snapResult.guides);
            }

            setElements(elements.map(el => {
                if (selectedIds.includes(el.id)) {
                    return {
                        ...el,
                        x: el.x + finalDx,
                        y: el.y + finalDy
                    };
                }
                return el;
            }));
            return;
        }

        if (isResizing && primarySelected && resizeHandle && selectedIds.length === 1 && resizeStartBounds) {
            const originalEl = primarySelected;
            const bounds = resizeStartBounds; // Use initial bounds, not current

            const rawDx = x - resizeStartPoint.x;
            const rawDy = y - resizeStartPoint.y;
            const dx = rawDx * RESIZE_SENSITIVITY_FACTOR;
            const dy = rawDy * RESIZE_SENSITIVITY_FACTOR;

            let newX = bounds.x;
            let newY = bounds.y;
            let newW = bounds.w;
            let newH = bounds.h;
            let aspectRatio = bounds.w / bounds.h;

            switch (resizeHandle) {
                case 'tl':
                    newX = bounds.x + dx; newY = bounds.y + dy;
                    newW = bounds.w - dx; newH = bounds.h - dy;
                    break;
                case 'tr':
                    newX = bounds.x; newY = bounds.y + dy;
                    newW = bounds.w + dx; newH = bounds.h - dy;
                    break;
                case 'bl':
                    newX = bounds.x + dx; newY = bounds.y;
                    newW = bounds.w - dx; newH = bounds.h + dy;
                    break;
                case 'br':
                    newX = bounds.x; newY = bounds.y;
                    newW = bounds.w + dx; newH = bounds.h + dy;
                    break;
                default:
                    return;
            }

            if (shiftKey && originalEl.type !== 'text') {
                const targetW = newW;
                const targetH = newH;
                const newRatio = Math.abs(targetW / targetH);

                if (newRatio > aspectRatio) {
                    newW = aspectRatio * targetH;
                } else {
                    newH = targetW / aspectRatio;
                }

                if (resizeHandle.includes('t')) {
                    newY = bounds.y + (bounds.h - newH);
                }
                if (resizeHandle.includes('l')) {
                    newX = bounds.x + (bounds.w - newW);
                }
            }

            newW = Math.max(10, newW);
            newH = Math.max(10, newH);

            if (newW < 10) newX = bounds.x + bounds.w - 10;
            if (newH < 10) newY = bounds.y + bounds.h - 10;

            setActiveGuides({ x: [], y: [] });

            setElements(elements.map(el => {
                if (el.id === primarySelected.id) {
                    const strokeOffset = (el.strokeWidth || 0) / 2;
                    if (el.type === 'rect' || el.type === 'image') {
                        return {
                            ...el,
                            x: newX + strokeOffset,
                            y: newY + strokeOffset,
                            width: newW - (strokeOffset * 2),
                            height: newH - (strokeOffset * 2)
                        };
                    } else if (el.type === 'circle') {
                        const newRadius = Math.max(5, (Math.min(newW, newH) - (strokeOffset * 2)) / 2);
                        return {
                            ...el,
                            x: newX + strokeOffset,
                            y: newY + strokeOffset,
                            radius: newRadius
                        };
                    } else if (el.type === 'polygon') {
                        const newSize = Math.max(20, Math.min(newW, newH) - (strokeOffset * 2));
                        return {
                            ...el,
                            x: newX + strokeOffset,
                            y: newY + strokeOffset,
                            size: newSize
                        };
                    } else if (el.type === 'text') {
                        const newFontSize = Math.max(8, newH - (2 * TEXT_BOUNDING_BUFFER));
                        const estimatedAscent = newFontSize * 0.8;
                        const newTextY = newY + TEXT_BOUNDING_BUFFER + estimatedAscent;

                        return {
                            ...el,
                            x: newX + TEXT_BOUNDING_BUFFER,
                            y: newTextY,
                            fontSize: newFontSize
                        };
                    }
                }
                return el;
            }));
            return;
        }

        if (!isDragging && !isResizing) {
            setActiveGuides({ x: [], y: [] });
        }
    };

    const handleMouseUp = () => {
        if (isDragging || isResizing) {
            setActiveGuides({ x: [], y: [] });
        }
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
        setResizeStartPoint({ x: 0, y: 0 });
        setResizeStartBounds(null);
    };

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        let clickedElementId = null;
        for (let i = elements.length - 1; i >= 0; i--) {
            if (isPointInElement(x, y, elements[i])) {
                clickedElementId = elements[i].id;
                if (!selectedIds.includes(clickedElementId)) {
                    setSelectedIds([clickedElementId]);
                }
                break;
            }
        }

        setContextMenu({ x: e.clientX, y: e.clientY, elementId: clickedElementId });
    }, [elements, isPointInElement, selectedIds]);

    const handleCloseMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleAction = (action) => {
        const elementId = contextMenu?.elementId;
        const primaryTargetId = primarySelected?.id || elementId;

        if (action === 'delete') {
            const idsToDelete = selectedIds.length > 0 ? selectedIds : (elementId ? [elementId] : []);
            if (idsToDelete.length > 0) {
                setElements(elements.filter(el => !idsToDelete.includes(el.id)));
                setSelectedIds([]);
            }
        } else if (action === 'copy') {
            if (selectedIds.length > 0) {
                const elementsToCopy = elements
                    .filter(el => selectedIds.includes(el.id))
                    .map(({ img, ...rest }) => rest);
                setCopiedElement(elementsToCopy);
                setToast({ message: `${elementsToCopy.length} element(s) copied to clipboard.`, type: 'success' });
            }
        } else if (action === 'paste') {
            if (copiedElement && copiedElement.length > 0) {
                const newElements = [];
                const newIds = [];
                const newTime = Date.now();

                copiedElement.forEach((el, index) => {
                    const newId = newTime + index + Math.random();
                    newIds.push(newId);

                    const baseElement = {
                        ...el,
                        id: newId,
                        x: el.x + 20,
                        y: el.y + 20,
                        rotation: el.rotation || 0,
                        opacity: el.opacity || 1,
                        isGrouped: el.isGrouped || false,
                    };

                    if (baseElement.type === 'image' && baseElement.src) {
                        const img = new Image();
                        img.onload = () => {
                            setElements(prev => prev.map(p => p.id === newId ? { ...p, img: img } : p));
                        };
                        img.src = baseElement.src;
                        newElements.push({ ...baseElement, img: undefined });
                    } else {
                        newElements.push(baseElement);
                    }
                });

                setElements(prev => [...prev, ...newElements]);
                setSelectedIds(newIds);
                setToast({ message: `${newElements.length} element(s) pasted.`, type: 'success' });
            }
        }
        else if (action === 'bring-front' && primaryTargetId) {
            moveLayerToExtreme(primaryTargetId, 'front');
            setToast({ message: 'Element brought to front.', type: 'success' });
        }
        else if (action === 'send-back' && primaryTargetId) {
            moveLayerToExtreme(primaryTargetId, 'back');
            setToast({ message: 'Element sent to back.', type: 'success' });
        }
        else if (action === 'duplicate' && primaryTargetId) {
            const elementToDuplicate = elements.find(el => el.id === primaryTargetId);
            if (elementToDuplicate) {
                const { img, ...copyData } = elementToDuplicate;
                const newId = Date.now() + Math.random();
                const newElement = {
                    ...copyData,
                    id: newId,
                    x: copyData.x + 20,
                    y: copyData.y + 20,
                    rotation: copyData.rotation || 0,
                    opacity: copyData.opacity || 1,
                };
                if (newElement.type === 'image' && newElement.src) {
                    const img = new Image();
                    img.onload = () => {
                        setElements(prev => prev.map(p => p.id === newId ? { ...el, img: img } : p));
                    };
                    img.src = newElement.src;
                    setElements(prev => [...prev, { ...newElement, img: undefined }]);
                } else {
                    setElements(prev => [...prev, newElement]);
                }
                setSelectedIds([newId]);
                setToast({ message: 'Element duplicated.', type: 'success' });
            }
        }

        setContextMenu(null);
    };

    const addRect = () => {
        const newId = Date.now();
        setElements([...elements, {
            type: 'rect', x: 50, y: 50, width: 100, height: 100,
            color: '#ef4444', strokeWidth: 0, strokeColor: '#000000', rotation: 0, opacity: 1, isGrouped: false, id: newId
        }]);
        setSelectedIds([newId]);
    };
    const addCircle = () => {
        const newId = Date.now();
        setElements([...elements, {
            type: 'circle', x: 200, y: 200, radius: 50,
            color: '#3b82f6', strokeWidth: 0, strokeColor: '#000000', rotation: 0, opacity: 1, isGrouped: false, id: newId
        }]);
        setSelectedIds([newId]);
    };
    const addTriangle = () => {
        const newId = Date.now();
        setElements([...elements, {
            type: 'polygon', x: 300, y: 50, sides: 3, size: 100,
            color: '#f59e0b', strokeWidth: 0, strokeColor: '#000000', rotation: 0, opacity: 1, isGrouped: false, id: newId
        }]);
        setSelectedIds([newId]);
    };
    const addPentagon = () => {
        const newId = Date.now();
        setElements([...elements, {
            type: 'polygon', x: 450, y: 50, sides: 5, size: 100,
            color: '#10b981', strokeWidth: 0, strokeColor: '#000000', rotation: 0, opacity: 1, isGrouped: false, id: newId
        }]);
        setSelectedIds([newId]);
    };
    const addText = () => {
        const text = prompt("Enter text:", "Hello World");
        if (text) {
            const newId = Date.now();
            setElements([...elements, {
                type: 'text', x: 100, y: 100, text: text, fontSize: 24, color: '#000000', rotation: 0, opacity: 1, isGrouped: false, id: newId
            }]);
            setSelectedIds([newId]);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('image', file);

            try {
                // Now using API_BASE_URL from the utility file
                const response = await axios.post(`${API_BASE_URL}/api/assets/upload`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });

                const imageUrl = response.data.url;
                const newId = Date.now();

                const img = new Image();
                img.onload = () => {
                    setElements(prev => [...prev, {
                        type: 'image',
                        x: 50, y: 50,
                        width: 200,
                        height: 200 * (img.height / img.width),
                        src: imageUrl,
                        img: img,
                        rotation: 0, opacity: 1, isGrouped: false, id: newId
                    }]);
                    setSelectedIds([newId]);
                };
                img.src = imageUrl;

            } catch (error) {
                console.error("Image upload failed:", error);
                setToast({ message: 'Failed to upload image. (Check API status)', type: 'error' });
            }
        }
        e.target.value = '';
    };

    const handleSaveCanvas = async () => {
        try {
            const elementsToSend = elements.map(({ img, ...rest }) => rest);
            // Now using API_BASE_URL from the utility file
            const response = await axios.post(`${API_BASE_URL}/api/projects/save`, {
                id: projectId,
                name: 'My New Project',
                canvasSize,
                elements: elementsToSend,
            });

            setProjectId(response.data.projectId);
            setToast({ message: `Canvas saved (ID: ${response.data.projectId})`, type: 'success' });

        } catch (error) {
            console.error('Save failed:', error);
            setToast({ message: 'Failed to save canvas. (Check API status)', type: 'error' });
        }
    };

    const handleLoadCanvas = async () => {
        const id = prompt("Enter Project ID to Load (e.g., proj_1700000000000):");
        if (!id) return;

        try {
            // Now using API_BASE_URL from the utility file
            const response = await axios.get(`${API_BASE_URL}/api/projects/load/${id}`);
            const canvasData = response.data;

            setCanvasSize(canvasData.canvasSize);
            setProjectId(canvasData.projectId);
            setHistory([[]]);
            setHistoryIndex(0);

            const loadedElements = canvasData.elements.map(el => {
                if (el.opacity === undefined) el.opacity = 1;
                if (el.isGrouped === undefined) el.isGrouped = false;

                if (el.type === 'image' && el.src) {
                    const img = new Image();
                    img.onload = () => {
                        setElements(prev => prev.map(p => p.id === el.id ? { ...p, img: img } : p));
                    };
                    img.src = el.src;
                    return { ...el, img: undefined };
                }
                return el;
            });

            setElements(loadedElements);
            setSelectedIds([]);
            setToast({ message: `Canvas loaded: ${canvasData.name}`, type: 'success' });

        } catch (error) {
            console.error('Load failed:', error);
            setToast({ message: 'Failed to load canvas: Check Project ID or API status.', type: 'error' });
        }
    };

    const handleExport = async (type) => {
        try {
            const elementsToSend = elements.map(({ img, ...rest }) => rest);

            if (type === 'pdf') {
                // ✅ FIX: Use the dedicated exportPDF function which handles the blob response
                const pdfBlob = await exportPDF({
                    width: canvasSize.width,
                    height: canvasSize.height,
                    elements: elementsToSend, // Pass raw element data (NOT stringified)
                });

                const url = window.URL.createObjectURL(pdfBlob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `canvas-export.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);

            } else if (type === 'png') {
                // PNG export uses the same backend structure as the previous working code
                const endpoint = `/api/canvas/export/${type}`;
                const response = await axios.post(`${API_BASE_URL}${endpoint}`, {
                    width: canvasSize.width,
                    height: canvasSize.height,
                    elements: JSON.stringify(elementsToSend),
                    settings: { scale: 2 } // Mock setting for scale
                }, {
                    responseType: 'blob'
                });

                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `canvas-export.${type}`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
            }

            setToast({ message: `${type.toUpperCase()} export successful!`, type: 'success' });
        } catch (error) {
            console.error("Export failed:", error);
            setToast({ message: `Failed to export ${type.toUpperCase()}. (Check API status: ${API_BASE_URL})`, type: 'error' });
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            const isCtrl = e.ctrlKey || e.metaKey;

            if (isCtrl && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
                return;
            }

            if ((isCtrl && e.key === 'y') || (isCtrl && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                handleRedo();
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedIds.length > 0) {
                    e.preventDefault();
                    setElements(prevElements => prevElements.filter(el => !selectedIds.includes(el.id)));
                    setSelectedIds([]);
                }
                return;
            }

            if (selectedIds.length > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();

                const nudgeAmount = e.shiftKey ? 10 : 1;

                setElements(prevElements =>
                    prevElements.map(el => {
                        if (selectedIds.includes(el.id)) {
                            let newX = el.x;
                            let newY = el.y;

                            switch (e.key) {
                                case 'ArrowUp':
                                    newY -= nudgeAmount;
                                    break;
                                case 'ArrowDown':
                                    newY += nudgeAmount;
                                    break;
                                case 'ArrowLeft':
                                    newX -= nudgeAmount;
                                    break;
                                case 'ArrowRight':
                                    newX += nudgeAmount;
                                    break;
                            }

                            return { ...el, x: newX, y: newY };
                        }
                        return el;
                    })
                );
                return;
            }

            if (e.key === 'Escape') {
                setSelectedIds([]);
                setContextMenu(null);
                setActiveGuides({ x: [], y: [] });
            }

            if (isCtrl && e.key === 'c' && selectedIds.length > 0) {
                e.preventDefault();
                const elementsToCopy = elements
                    .filter(el => selectedIds.includes(el.id))
                    .map(({ img, ...rest }) => rest);
                setCopiedElement(elementsToCopy);
                setToast({ message: `${elementsToCopy.length} element(s) copied to clipboard.`, type: 'success' });
            }

            if (isCtrl && e.key === 'v' && copiedElement.length > 0) {
                e.preventDefault();
                handleAction('paste');
            }

            if (isCtrl && e.key === 'a') {
                e.preventDefault();
                if (elements.length > 0) {
                    setSelectedIds(elements.map(el => el.id));
                }
            }

            if (isCtrl && e.key === 'd' && selectedIds.length > 0) {
                e.preventDefault();
                const elementsToDuplicate = elements
                    .filter(el => selectedIds.includes(el.id))
                    .map(({ img, ...rest }) => rest);

                if (elementsToDuplicate.length > 0) {
                    const newElements = [];
                    const newIds = [];
                    const newTime = Date.now();

                    elementsToDuplicate.forEach((el, index) => {
                        const newId = newTime + index + Math.random();
                        newIds.push(newId);

                        const baseElement = {
                            ...el,
                            id: newId,
                            x: el.x + 20,
                            y: el.y + 20,
                            rotation: el.rotation || 0,
                            opacity: el.opacity || 1,
                        };

                        if (baseElement.type === 'image' && baseElement.src) {
                            const img = new Image();
                            img.onload = () => {
                                setElements(prev => prev.map(p => p.id === newId ? { ...el, img: img } : p));
                            };
                            img.src = baseElement.src;
                            newElements.push({ ...baseElement, img: undefined });
                        } else {
                            newElements.push(baseElement);
                        }
                    });

                    setElements(prev => [...prev, ...newElements]);
                    setSelectedIds(newIds);
                    setToast({ message: `${newElements.length} element(s) duplicated.`, type: 'success' });
                }
            }

            if (isCtrl && primarySelected) {
                if (e.key === ']') {
                    e.preventDefault();
                    moveLayerToExtreme(primarySelected.id, 'front');
                } else if (e.key === '[') {
                    e.preventDefault();
                    moveLayerToExtreme(primarySelected.id, 'back');
                } else if (e.shiftKey && e.key === '}') {
                    e.preventDefault();
                    moveLayer(primarySelected.id, 'forward');
                } else if (e.shiftKey && e.key === '{') {
                    e.preventDefault();
                    moveLayer(primarySelected.id, 'backward');
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds, elements, copiedElement, primarySelected, handleUndo, handleRedo, moveLayer, moveLayerToExtreme, setElements, setSelectedIds, setCopiedElement, setContextMenu, setToast, handleAction]);

    return (
        // TOP LEVEL: h-screen and overflow-hidden ensure the entire application stays within the viewport.
        <div className="h-screen flex flex-col bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-900 font-sans text-gray-800 overflow-hidden">
            {/* Header - Fixed height, does not scroll */}
            <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-lg p-4 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <div className="bg-emerald-600 p-2 rounded-lg shadow-lg">
                        <MousePointer2 className="text-white" size={20} />
                    </div>
                    <h1 className="text-xl font-bold text-white">Canvas Studio</h1>
                </div>

                {/* Visual Clipboard Indicator */}
                {copiedElement.length > 0 && (
                    <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-lg border border-yellow-400/30 text-sm">
                        <Clipboard size={16} />
                        <span>Clipboard: {copiedElement.length} element(s) copied</span>
                    </div>
                )}

                {/* UNDO / REDO / SAVE / LOAD BUTTONS */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleUndo}
                        disabled={historyIndex === 0}
                        className={`p-2 rounded-lg transition ${historyIndex === 0 ? 'text-gray-500 bg-white/5' : 'text-white bg-white/20 hover:bg-white/30'}`}
                        title="Undo (Ctrl + Z)"
                    >
                        <Undo size={18} />
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={historyIndex === history.length - 1}
                        className={`p-2 rounded-lg transition ${historyIndex === history.length - 1 ? 'text-gray-500 bg-white/5' : 'text-white bg-white/20 hover:bg-white/30'}`}
                        title="Redo (Ctrl + Y or Ctrl + Shift + Z)"
                    >
                        <Redo size={18} />
                    </button>

                    {/* SAVE BUTTON */}
                    <button
                        onClick={handleSaveCanvas}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition shadow-lg font-medium"
                        title={`Save design ${projectId ? '(Update)' : '(New)'}`}
                    >
                        <Save size={18} />
                        {projectId ? 'Update Canvas' : 'Save Canvas'}
                    </button>

                    {/* LOAD BUTTON */}
                    <button
                        onClick={handleLoadCanvas}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 transition shadow-lg font-medium"
                        title="Load design by Project ID"
                    >
                        <FolderOpen size={18} />
                        Load Canvas
                    </button>

                    {/* EXPORT DROPDOWN */}
                    <div className="relative group">
                        <button
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-lg hover:from-emerald-700 hover:to-teal-700 transition shadow-lg font-medium"
                            title="Export options"
                        >
                            <Download size={18} />
                            Export
                        </button>
                        {/* THE FIX: top-full ensures no gap between the button and the dropdown menu, keeping the hover state active */}
                        <div className="absolute right-0 top-full w-40 bg-gray-800 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto z-50">
                            <button onClick={() => handleExport('pdf')} className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-emerald-600 rounded-t-md">
                                Export PDF
                            </button>
                            <button onClick={() => handleExport('png')} className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-emerald-600 rounded-b-md">
                                Export PNG
                            </button>
                        </div>
                    </div>

                </div>
            </header>

            {/* Main Content Area (Below Header) - flex-1 is crucial to occupy remaining vertical space and prevent outer scrolling */}
            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Controls - flex-col is maintained, content below the grid controls is made scrollable */}
                <div className="w-72 bg-white/10 backdrop-blur-lg border-r border-white/20 flex flex-col flex-shrink-0">

                    {/* FIXED TOP SECTIONS */}

                    {/* CANVAS SIZE SECTION */}
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-4">Canvas Size</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col">
                                <label className="text-xs text-emerald-300 mb-1">Width (px)</label>
                                <input
                                    type="number"
                                    value={canvasSize.width}
                                    onChange={(e) => setCanvasSize({ ...canvasSize, width: Math.max(1, parseInt(e.target.value) || 1) })}
                                    className="bg-white/10 border border-white/20 text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                    min="1" // Changed min to 1
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs text-emerald-300 mb-1">Height (px)</label>
                                <input
                                    type="number"
                                    value={canvasSize.height}
                                    onChange={(e) => setCanvasSize({ ...canvasSize, height: Math.max(1, parseInt(e.target.value) || 1) })}
                                    className="bg-white/10 border border-white/20 text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                    min="1" // Changed min to 1
                                />
                            </div>
                        </div>
                    </div>

                    {/* GRID CONTROLS */}
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-4">Grid & Snapping</h2>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Grid size={18} className="text-emerald-300" />
                                <span className="text-sm font-medium text-white">Show Grid</span>
                            </div>
                            <button
                                onClick={() => setShowGrid(!showGrid)}
                                className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${showGrid ? 'bg-emerald-500' : 'bg-gray-600'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${showGrid ? 'translate-x-6' : 'translate-x-0'}`}></div>
                            </button>
                        </div>

                        <div className="flex flex-col">
                            <label className="text-xs text-emerald-300 mb-1">Grid Size (px)</label>
                            <input
                                type="number"
                                value={gridSize}
                                min="10"
                                step="10"
                                onChange={(e) => setGridSize(Math.max(10, parseInt(e.target.value) || 10))}
                                className="bg-white/10 border border-white/20 text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                disabled={!showGrid}
                            />
                            <p className="text-xs text-gray-400 mt-1 italic">Snaps to elements, canvas, and grid.</p>
                        </div>
                    </div>

                    {/* SCROLLABLE SECTION WRAPPER - Correctly handles scrolling for elements and properties if content overflows sidebar height */}
                    <div className="flex-1 overflow-y-auto">

                        {/* ELEMENTS CREATION SECTION */}
                        <div className="p-6">
                            <h2 className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-4">Elements</h2>
                            <div className="grid grid-cols-3 gap-3">
                                {/* Row 1 */}
                                <button onClick={addRect} className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/20 rounded-xl hover:bg-white/10 hover:border-emerald-400 transition group">
                                    <Square size={24} className="text-emerald-300 group-hover:text-emerald-200 mb-2" />
                                    <span className="text-xs font-medium text-emerald-200">Rect</span>
                                </button>
                                <button onClick={addCircle} className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/20 rounded-xl hover:bg-white/10 hover:border-emerald-400 transition group">
                                    <Circle size={24} className="text-emerald-300 group-hover:text-emerald-200 mb-2" />
                                    <span className="text-xs font-medium text-emerald-200">Circle</span>
                                </button>
                                <button onClick={addText} className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/20 rounded-xl hover:bg-white/10 hover:border-emerald-400 transition group">
                                    <Type size={24} className="text-emerald-300 group-hover:text-emerald-200 mb-2" />
                                    <span className="text-xs font-medium text-emerald-200">Text</span>
                                </button>

                                {/* Row 2: Shapes and Image */}
                                <button onClick={addTriangle} className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/20 rounded-xl hover:bg-white/10 hover:border-emerald-400 transition group">
                                    <Triangle size={24} className="text-emerald-300 group-hover:text-emerald-200 mb-2" />
                                    <span className="text-xs font-medium text-emerald-200">Triangle</span>
                                </button>
                                <button onClick={addPentagon} className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/20 rounded-xl hover:bg-white/10 hover:border-emerald-400 transition group">
                                    <Hexagon size={24} className="text-emerald-300 group-hover:text-emerald-200 mb-2" />
                                    <span className="text-xs font-medium text-emerald-200">Pentagon</span>
                                </button>
                                <button onClick={() => fileInputRef.current.click()} className="flex flex-col items-center justify-center p-4 bg-white/5 border border-white/20 rounded-xl hover:bg-white/10 hover:border-emerald-400 transition group">
                                    <ImageIcon size={24} className="text-emerald-300 group-hover:text-emerald-200 mb-2" />
                                    <span className="text-xs font-medium text-emerald-200">Image</span>
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                        </div>

                        {/* Element Properties */}
                        {primarySelected && (
                            <ElementProperties
                                selectedElement={primarySelected}
                                setElements={setElements}
                                setSelectedIds={setSelectedIds}
                                moveLayer={moveLayer}
                                moveLayerToExtreme={moveLayerToExtreme}
                                toggleGroupStatus={toggleGroupStatus}
                                // Pass new state and toggle function
                                isExpanded={isPropertiesExpanded}
                                toggleExpand={togglePropertiesExpand}
                            />
                        )}

                    </div> {/* END of scrollable wrapper */}

                </div>

                {/* Canvas Area - overflow-auto enables scrolling ONLY when content (canvas) exceeds area size */}
                <div className="flex-1 bg-gradient-to-br from-emerald-800/50 to-teal-900/50 overflow-auto flex justify-center p-8 relative">
                    <div className="relative shadow-2xl">
                        <canvas
                            ref={canvasRef}
                            width={canvasSize.width}
                            height={canvasSize.height}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onContextMenu={handleContextMenu}
                            className="bg-white rounded-lg"
                        />
                        <div className="absolute -top-6 left-0 text-xs text-emerald-300 font-medium">
                            {canvasSize.width} x {canvasSize.height} px ({selectedIds.length} elements selected)
                        </div>
                    </div>
                </div>
            </div>

            {/* RENDER CUSTOM CONTEXT MENU */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    elementId={contextMenu.elementId}
                    selectedId={primarySelected?.id || null}
                    copiedElement={copiedElement}
                    onAction={handleAction}
                    onClose={handleCloseMenu}
                />
            )}

            {/* RENDER TOAST NOTIFICATION */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}

export default App;