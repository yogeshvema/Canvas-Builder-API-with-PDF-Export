import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Square, Circle, Type, Image as ImageIcon, Download, MousePointer2, Triangle, Hexagon, Palette, Undo, Redo, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, Save, FolderOpen, Grid, PenTool, RotateCw, Clipboard, CheckCircle, XCircle, Ungroup, Group } from 'lucide-react'; 

// --- Constants ---
const RESIZE_SENSITIVITY_FACTOR = 0.6;
const MAX_HISTORY_LENGTH = 50; 
const SNAP_TOLERANCE = 5; // Pixels distance to snap
// FEATURE 3: Color Presets
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
            style={{ top: y, left: x, minWidth: 160 }}
            onMouseDown={(e) => e.stopPropagation()} 
        >
            <ul className="list-none p-0 m-0">
                <li className="px-3 py-2 text-sm text-gray-400">Save Image As... (Placeholder)</li>
                
                <li className={`px-3 py-2 text-sm cursor-pointer hover:bg-emerald-600 rounded-md transition ${isElementSelected ? '' : 'opacity-50 cursor-not-allowed'}`}
                    onClick={isElementSelected ? () => onAction('copy') : null}>
                    Copy (Ctrl+C)
                </li>
                
                <li className={`px-3 py-2 text-sm cursor-pointer hover:bg-emerald-600 rounded-md transition ${copiedElement ? '' : 'opacity-50 cursor-not-allowed'}`}
                    onClick={copiedElement ? () => onAction('paste') : null}>
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

const ElementProperties = ({ selectedElement, setElements, setSelectedId, moveLayer, moveLayerToExtreme, toggleGroupStatus }) => {
    
    const isImage = selectedElement?.type === 'image';
    const isText = selectedElement?.type === 'text';
    const isShape = selectedElement && !isImage && !isText;
    
    if (!selectedElement) {
        return null;
    }

    // Styles
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
        setSelectedId(null);
    };
    
    // FEATURE 1: Grouping
    const isGrouped = selectedElement.isGrouped || false;


    return (
        <div className="p-6 border-t border-white/10 bg-white/5"> {/* Removed mt-auto here */}
            <h2 className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-2">Selected Element</h2>
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
                    
                    {/* FEATURE 3: Color Presets */}
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
            
            {/* FEATURE 1: Grouping Button (Conceptual) */}
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
    );
};


function App() {
    const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 1000});
    const [elements, setElements] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    
    const [isResizing, setIsResizing] = useState(false);
    const [resizeHandle, setResizeHandle] = useState(null); 
    const [resizeStartPoint, setResizeStartPoint] = useState({ x: 0, y: 0 });

    const [contextMenu, setContextMenu] = useState(null);
    const [copiedElement, setCopiedElement] = useState(null); 
    
    // --- UNDO/REDO STATE ---
    const [history, setHistory] = useState([[]]); 
    const [historyIndex, setHistoryIndex] = useState(0);
    
    // --- SNAP GUIDES STATE ---
    const [activeGuides, setActiveGuides] = useState({ x: [], y: [] }); 

    // --- GRID STATE ---
    const [showGrid, setShowGrid] = useState(false);
    const [gridSize, setGridSize] = useState(50); 
    
    // --- TOAST STATE ---
    const [toast, setToast] = useState(null); 
    // --- END TOAST STATE ---

    // --- EXPORT SETTINGS STATE ---
    const [exportSettings, setExportSettings] = useState({
        quality: 'medium', 
        dpi: 300,
        orientation: 'portrait' 
    });

    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const loadFileInputRef = useRef(null); 
    
    const ctxRef = useRef(null);
    
    useEffect(() => {
        if (canvasRef.current) {
            ctxRef.current = canvasRef.current.getContext('2d');
        }
    }, []);

    const selectedElement = elements.find(el => el.id === selectedId);


    // --- FEATURE 1: Grouping Logic Placeholder ---
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


    // --- HISTORY MANAGEMENT ---

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
            setSelectedId(null);
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
            setSelectedId(null);
            setToast({ message: 'Redo successful.', type: 'success' });
        } else {
            setToast({ message: 'Nothing left to redo.', type: 'error' });
        }
    }, [history, historyIndex, setToast]);


    // --- LAYER MANAGEMENT FUNCTIONS ---

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


    // --- GEOMETRY / BOUNDS HELPERS ---

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
    
    // Calculates the *unrotated* bounding box for selection/snapping
    const getElementBounds = (el, ctx) => {
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
            // FIX: Use robust metrics for accurate text selection bounding box
            ctx.font = `${el.fontSize || 12}px Arial`;
            const textMetrics = ctx.measureText(el.text);
            const width = textMetrics.width;
            // Use fallback estimates if bounding box properties are not supported by the browser
            const ascent = textMetrics.actualBoundingBoxAscent || (el.fontSize * 0.8);
            const descent = textMetrics.actualBoundingBoxDescent || (el.fontSize * 0.2);
            
            x = el.x; 
            y = el.y - ascent;
            w = width; 
            h = ascent + descent;

            // Add a small safety buffer for easier clicking/selection
            const buffer = 5; 
            x -= buffer;
            y -= buffer;
            w += 2 * buffer;
            h += 2 * buffer;

        } else if (el.type === 'text') {
            const height = el.fontSize || 12;
            const width = (el.text.length * height) * 0.6;
            x = el.x; y = el.y - height; w = width; h = height;
        } else {
            return { x: 0, y: 0, w: 0, h: 0 };
        }

        return { x: x, y: y, w: w, h: h };
    };

    // --- SNAP GUIDES LOGIC ---

    const getSnapGuides = (currentElementId, canvasW, canvasH) => {
        const allGuides = { x: [], y: [] };
        
        // 1. Canvas Boundary Guides
        allGuides.x.push(0, canvasW / 2, canvasW);
        allGuides.y.push(0, canvasH / 2, canvasH);
        
        // 2. Element Guides
        elements.forEach(el => {
            if (el.id === currentElementId) return;

            const bounds = getElementBounds(el, ctxRef.current);
            
            allGuides.x.push(bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w);
            allGuides.y.push(bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h);
        });
        
        // 3. Grid Guides
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
    };
    
    const applySnap = (newX, newY, newW, newH, guides) => {
        const tolerance = SNAP_TOLERANCE;
        const snap = { x: newX, y: newY, guides: { x: [], y: [] } };
        
        const checkX = [
            { pos: newX, type: 'left' },             
            { pos: newX + newW / 2, type: 'center' },  
            { pos: newX + newW, type: 'right' }      
        ];

        for (const { pos: elementPos } of checkX) {
            for (const guideX of guides.x) {
                if (Math.abs(elementPos - guideX) < tolerance) {
                    const offset = guideX - elementPos;
                    snap.x += offset;
                    snap.guides.x.push(guideX);
                    break;
                }
            }
            if (snap.guides.x.length > 0) break;
        }

        const checkY = [
            { pos: newY, type: 'top' },              
            { pos: newY + newH / 2, type: 'center' }, 
            { pos: newY + newH, type: 'bottom' }     
        ];

        for (const { pos: elementPos } of checkY) {
            for (const guideY of guides.y) {
                if (Math.abs(elementPos - guideY) < tolerance) {
                    const offset = guideY - elementPos;
                    snap.y += offset;
                    snap.guides.y.push(guideY);
                    break;
                }
            }
            if (snap.guides.y.length > 0) break;
        }

        return snap;
    };


    // --- Interaction Handlers ---

    const isPointInElement = (x, y, el) => {
        const ctx = ctxRef.current;
        if (!ctx) return false;

        // Use the robust bounds calculation for rectangular hit testing
        const bounds = getElementBounds(el, ctx);
        
        if (el.type === 'rect' || el.type === 'image' || el.type === 'text' || el.type === 'polygon') {
            // Check if point is within the element's bounding box
            return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
        } else if (el.type === 'circle') {
            // For circle, use a precise distance check if inside the bounding box
            if (x < bounds.x || x > bounds.x + bounds.w || y < bounds.y || y > bounds.y + bounds.h) return false;
            
            const radius = el.radius + (el.strokeWidth || 0) / 2;
            const cx = el.x + el.radius;
            const cy = el.y + el.radius;
            const dx = x - cx;
            const dy = y - cy;
            return dx * dx + dy * dy <= radius * radius;
        }
        return false;
    };

    const isPointOnHandle = (px, py, el) => {
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
    };

    // --- Drawing Logic ---

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
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // 1. Clear and Draw Base Background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw Grid
        if (showGrid) {
            drawGrid(ctx, canvasSize.width, canvasSize.height, gridSize);
        }

        // 3. Draw Elements (Updated for Rotation & Opacity)
        elements.forEach(el => {
            ctx.save();
            
            const color = el.color || '#000000';
            const strokeWidth = el.strokeWidth || 0;
            const rotation = el.rotation || 0;
            
            // --- Apply Opacity (FEATURE 2) ---
            ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1; 

            // --- Apply Rotation ---
            if (rotation !== 0) {
                let centerX, centerY;
                
                if (el.type === 'rect' || el.type === 'image' || el.type === 'polygon') {
                    // Use actual width/height/size if available, otherwise fallback
                    const w = el.width || el.size || 0;
                    const h = el.height || el.size || 0;
                    centerX = el.x + w / 2;
                    centerY = el.y + h / 2;
                } else if (el.type === 'circle') {
                    centerX = el.x + el.radius;
                    centerY = el.y + el.radius;
                } else if (el.type === 'text') {
                    // For text, rotation center is approximated at the center of the UNROTATED bounding box
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
            // --- End Rotation ---


            // Setup path for shapes
            if (el.type === 'rect') {
                ctx.beginPath();
                ctx.rect(el.x, el.y, el.width, el.height);
            } else if (el.type === 'circle') {
                ctx.beginPath();
                ctx.arc(el.x + el.radius, el.y + el.radius, el.radius, 0, 2 * Math.PI);
            } else if (el.type === 'polygon') {
                drawPolygonPath(ctx, el);
            }

            // Fill
            if (el.type !== 'text' && el.type !== 'image') {
                ctx.fillStyle = color;
                ctx.fill();
            }

            // Stroke
            if (strokeWidth > 0 && (el.type === 'rect' || el.type === 'circle' || el.type === 'polygon')) {
                ctx.strokeStyle = el.strokeColor || '#000000';
                ctx.lineWidth = strokeWidth;
                ctx.stroke();
            }
            
            // Text
            if (el.type === 'text') {
                ctx.fillStyle = color;
                ctx.font = `${el.fontSize || 12}px Arial`;
                ctx.fillText(el.text, el.x, el.y);
            } 
            
            // Image
            if (el.type === 'image' && el.img) {
                ctx.drawImage(el.img, el.x, el.y, el.width, el.height);
            }
            
            // Draw Handles for Selected Element
            if (el.id === selectedId) {
                const bounds = getElementBounds(el, ctx);
                
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 2;
                ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

                drawHandles(ctx, bounds);
            }
            
            ctx.restore();
        });

        // Reset globalAlpha outside of restore for alignment guides
        ctx.globalAlpha = 1;

        // 4. DRAW ALIGNMENT GUIDES (On top of everything)
        ctx.save();
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

    }, [elements, canvasSize, selectedId, activeGuides, showGrid, gridSize]); 

    const handleMouseDown = (e) => {
        if (contextMenu && e.button === 0) {
            setContextMenu(null);
        }

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setActiveGuides({ x: [], y: [] }); 

        if (selectedId) {
            const selectedEl = elements.find(el => el.id === selectedId);
            const handle = isPointOnHandle(x, y, selectedEl);
            if (handle) {
                setIsResizing(true);
                setResizeHandle(handle);
                setResizeStartPoint({ x, y });
                return;
            }
        }

        for (let i = elements.length - 1; i >= 0; i--) {
            if (isPointInElement(x, y, elements[i])) {
                setSelectedId(elements[i].id);
                setIsDragging(true);
                
                // Calculate drag offset based on element's core x/y 
                setDragOffset({ x: x - elements[i].x, y: y - elements[i].y });
                return;
            }
        }
        setSelectedId(null);
    };

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        const shiftKey = e.shiftKey;
        
        // Cursor logic
        if (isDragging) {
            canvas.style.cursor = 'grabbing';
        } else if (isResizing) {
            const cursors = {
                'tl': 'nwse-resize', 'br': 'nwse-resize',
                'tr': 'nesw-resize', 'bl': 'nesw-resize'
            };
            canvas.style.cursor = cursors[resizeHandle] || 'default';
        } else if (selectedElement) {
            const handle = isPointOnHandle(x, y, selectedElement);
            const cursors = {
                'tl': 'nwse-resize', 'br': 'nwse-resize',
                'tr': 'nesw-resize', 'bl': 'nesw-resize'
            };
            canvas.style.cursor = handle ? cursors[handle] : 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
        
        // --- Dragging Logic with Snap ---
        if (isDragging && selectedId) {
            const originalEl = elements.find(el => el.id === selectedId);
            if (!originalEl) return;

            // Calculate the potential core element position (no bounds/stroke adjustment yet)
            let potentialCoreX = x - dragOffset.x;
            let potentialCoreY = y - dragOffset.y;
            
            const bounds = getElementBounds(originalEl, ctxRef.current);
            const guides = getSnapGuides(selectedId, canvasSize.width, canvasSize.height);
            
            // 1. Adjust potential coordinates to match the bounds top-left
            const strokeOffset = (originalEl.strokeWidth || 0) / 2;
            let potentialBoundsX = potentialCoreX - strokeOffset;
            let potentialBoundsY = potentialCoreY - strokeOffset;
            
            // 2. Apply snap to the BOUNDS
            const snapResult = applySnap(
                potentialBoundsX, 
                potentialBoundsY, 
                bounds.w, 
                bounds.h, 
                guides
            );
            
            let finalSnapBoundsX = snapResult.x;
            let finalSnapBoundsY = snapResult.y;
            
            setActiveGuides(snapResult.guides);


            setElements(elements.map(el => {
                if (el.id === selectedId) {
                    
                    if (el.type === 'text') {
                        // For text, we apply the delta between the snapped bounds and the potential bounds 
                        // to the core element x/y (baseline).
                        const dx_snap = finalSnapBoundsX - potentialBoundsX;
                        const dy_snap = finalSnapBoundsY - potentialBoundsY;

                        return {
                            ...el,
                            x: potentialCoreX + dx_snap,
                            y: potentialCoreY + dy_snap,
                        };
                    }
                    
                    // Shapes/Images: Element x/y is top-left corner (requires adjusting for stroke)
                    return { 
                        ...el, 
                        x: finalSnapBoundsX + strokeOffset, 
                        y: finalSnapBoundsY + strokeOffset 
                    };
                }
                return el;
            }));
            return;
        } 
        
        // --- Resizing Logic ---
        if (isResizing && selectedId && resizeHandle) {
            const originalEl = elements.find(el => el.id === selectedId);
            if (!originalEl) return;

            const bounds = getElementBounds(originalEl, ctxRef.current);
            
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
                const lockedW = newW;
                const lockedH = newH;
                
                if (Math.abs(lockedW) / aspectRatio > Math.abs(lockedH)) {
                    newW = aspectRatio * lockedH;
                } else {
                    newH = lockedW / aspectRatio;
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

            if (newW < 10) newX = bounds.x + bounds.w - newW;
            if (newH < 10) newY = bounds.y + bounds.h - newH;

            setActiveGuides({ x: [], y: [] }); 

            setElements(elements.map(el => {
                if (el.id === selectedId) {
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
                        // Radius excludes stroke
                        const newRadius = Math.max(5, (newW - (strokeOffset * 2)) / 2);
                        return { 
                            ...el, 
                            x: newX + strokeOffset, 
                            y: newY + strokeOffset, 
                            radius: newRadius 
                        };
                    } else if (el.type === 'polygon') {
                        // Size excludes stroke
                        const newSize = Math.max(20, Math.max(newW, newH) - (strokeOffset * 2));
                        return { 
                            ...el, 
                            x: newX + strokeOffset, 
                            y: newY + strokeOffset, 
                            size: newSize 
                        };
                    } else if (el.type === 'text') {
                        const newFontSize = Math.max(8, newH - 10); 
                        
                        const estimatedAscent = newFontSize * 0.8;
                        const newTextY = newY + 5 + estimatedAscent; 
                        
                        return { 
                            ...el, 
                            x: newX + 5, 
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
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
        setResizeStartPoint({ x: 0, y: 0 }); 
        setActiveGuides({ x: [], y: [] }); 
    };
    
    // --- Context Menu Handlers ---

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
                setSelectedId(clickedElementId);
                break;
            }
        }
        
        setContextMenu({ x: e.clientX, y: e.clientY, elementId: clickedElementId });
    }, [elements]);

    const handleCloseMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleAction = (action) => {
        const elementId = contextMenu.elementId;

        if (action === 'delete') {
            if (elementId) {
                setElements(elements.filter(el => el.id !== elementId));
                setSelectedId(null);
            }
        } else if (action === 'copy') {
            if (elementId) {
                const elementToCopy = elements.find(el => el.id === elementId);
                const { img, ...copyData } = elementToCopy;
                setCopiedElement(copyData);
                setToast({ message: "Element copied to clipboard.", type: 'success' });
            }
        } else if (action === 'paste') {
            if (copiedElement) {
                const newElement = {
                    ...copiedElement,
                    id: Date.now(),
                    x: copiedElement.x + 20,
                    y: copiedElement.y + 20,
                    rotation: copiedElement.rotation || 0,
                    opacity: copiedElement.opacity || 1,
                };

                if (newElement.type === 'image' && newElement.src) {
                    const img = new Image();
                    img.onload = () => {
                        setElements(prev => prev.map(el => el.id === newElement.id ? { ...el, img: img } : el));
                    };
                    img.src = newElement.src;
                    setElements(prev => [...prev, { ...newElement, img: undefined }]);
                } else {
                    setElements(prev => [...prev, newElement]);
                }
                setSelectedId(newElement.id);
                setToast({ message: "Element pasted.", type: 'success' });
            }
        }

        setContextMenu(null);
    };

    // --- Element Creation ---

    const addRect = () => {
        setElements([...elements, {
            type: 'rect', x: 50, y: 50, width: 100, height: 100, 
            color: '#ef4444', 
            strokeWidth: 0, 
            strokeColor: '#000000', 
            rotation: 0, 
            opacity: 1, // Feature 2
            isGrouped: false, // Feature 1
            id: Date.now()
        }]);
    };

    const addCircle = () => {
        setElements([...elements, {
            type: 'circle', x: 200, y: 200, radius: 50, 
            color: '#3b82f6', 
            strokeWidth: 0, 
            strokeColor: '#000000', 
            rotation: 0, 
            opacity: 1, // Feature 2
            isGrouped: false, // Feature 1
            id: Date.now()
        }]);
    };
    
    const addTriangle = () => {
        setElements([...elements, {
            type: 'polygon', x: 300, y: 50, sides: 3, size: 100, 
            color: '#f59e0b', 
            strokeWidth: 0, 
            strokeColor: '#000000', 
            rotation: 0, 
            opacity: 1, // Feature 2
            isGrouped: false, // Feature 1
            id: Date.now()
        }]);
    };

    const addPentagon = () => {
        setElements([...elements, {
            type: 'polygon', x: 450, y: 50, sides: 5, size: 100, 
            color: '#10b981', 
            strokeWidth: 0, 
            strokeColor: '#000000', 
            rotation: 0, 
            opacity: 1, // Feature 2
            isGrouped: false, // Feature 1
            id: Date.now()
        }]);
    };

    const addText = () => {
        const text = prompt("Enter text:", "Hello World");
        if (text) {
            setElements([...elements, {
                type: 'text', x: 100, y: 100, text: text, fontSize: 24, color: '#000000', rotation: 0, opacity: 1, isGrouped: false, id: Date.now() // Feature 1 & 2
            }]);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    setElements([...elements, {
                        type: 'image',
                        x: 50,
                        y: 50,
                        width: 200,
                        height: 200 * (img.height / img.width),
                        src: event.target.result, 
                        img: img,
                        rotation: 0, 
                        opacity: 1, // Feature 2
                        isGrouped: false, // Feature 1
                        id: Date.now()
                    }]);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };
    
    // --- EXPORT/SAVE/LOAD HANDLERS ---

    const handleSaveCanvas = () => {
        try {
            const canvasData = {
                canvasSize,
                elements: elements.map(({ img, ...rest }) => rest),
                version: '1.0',
                savedAt: new Date().toISOString()
            };

            const dataStr = JSON.stringify(canvasData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `canvas-design-${Date.now()}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            setToast({ message: 'Canvas saved successfully!', type: 'success' });
        } catch (error) {
            console.error('Save failed:', error);
            setToast({ message: 'Failed to save canvas.', type: 'error' });
        }
    };

    const handleLoadCanvas = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const canvasData = JSON.parse(e.target.result);
                
                if (!canvasData.elements || !canvasData.canvasSize) {
                    throw new Error('Invalid canvas file format');
                }

                setCanvasSize(canvasData.canvasSize);
                setHistory([[]]);
                setHistoryIndex(0);

                const loadedElements = canvasData.elements.map(el => {
                    if (el.opacity === undefined) el.opacity = 1; // Ensure opacity compatibility
                    if (el.isGrouped === undefined) el.isGrouped = false; // Ensure grouping compatibility
                    
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
                setSelectedId(null);
                
                setToast({ message: 'Canvas loaded successfully!', type: 'success' });
            } catch (error) {
                console.error('Load failed:', error);
                setToast({ message: 'Failed to load canvas: Invalid file format.', type: 'error' });
            }
        };
        
        reader.readAsText(file);
        event.target.value = ''; 
    };

    const handleExport = async () => {
        try {
            const elementsToSend = elements.map(({ img, ...rest }) => rest);

            const response = await axios.post('http://localhost:3000/api/canvas/export', {
                width: canvasSize.width,
                height: canvasSize.height,
                elements: JSON.stringify(elementsToSend),
                settings: exportSettings
            }, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'canvas-export.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            setToast({ message: 'PDF export successful!', type: 'success' });
        } catch (error) {
            console.error("Export failed:", error);
            setToast({ message: 'Failed to export PDF.', type: 'error' });
        }
    };
    
    // --- COMPLETE KEYBOARD SHORTCUTS ---
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
                if (selectedId) {
                    e.preventDefault();
                    setElements(prevElements => prevElements.filter(el => el.id !== selectedId));
                    setSelectedId(null);
                }
                return;
            }

            if (selectedId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                
                const nudgeAmount = e.shiftKey ? 10 : 1;
                
                setElements(prevElements => 
                    prevElements.map(el => {
                        if (el.id === selectedId) {
                            let newX = el.x;
                            let newY = el.y;
                            
                            switch(e.key) {
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
                setSelectedId(null);
                setContextMenu(null);
            }

            // COPY (Ctrl+C)
            if (isCtrl && e.key === 'c' && selectedId) {
                e.preventDefault();
                const elementToCopy = elements.find(el => el.id === selectedId);
                if (elementToCopy) {
                    const { img, ...copyData } = elementToCopy;
                    setCopiedElement(copyData);
                    setToast({ message: "Element copied to clipboard.", type: 'success' });
                }
            }

            // PASTE (Ctrl+V)
            if (isCtrl && e.key === 'v' && copiedElement) {
                e.preventDefault();
                const newElement = {
                    ...copiedElement,
                    id: Date.now(),
                    x: copiedElement.x + 20,
                    y: copiedElement.y + 20,
                    rotation: copiedElement.rotation || 0,
                    opacity: copiedElement.opacity || 1,
                };

                if (newElement.type === 'image' && newElement.src) {
                    const img = new Image();
                    img.onload = () => {
                        setElements(prev => prev.map(el => el.id === newElement.id ? { ...el, img: img } : el));
                    };
                    img.src = newElement.src;
                    setElements(prev => [...prev, { ...newElement, img: undefined }]);
                } else {
                    setElements(prev => [...prev, newElement]);
                }
                setSelectedId(newElement.id);
                setToast({ message: "Element pasted.", type: 'success' });
            }

            if (isCtrl && e.key === 'a') {
                e.preventDefault();
                if (elements.length > 0) {
                    setSelectedId(elements[elements.length - 1].id);
                }
            }

            if (isCtrl && e.key === 'd' && selectedId) {
                e.preventDefault();
                const elementToDuplicate = elements.find(el => el.id === selectedId);
                if (elementToDuplicate) {
                    const { img, ...copyData } = elementToDuplicate;
                    const newElement = {
                        ...copyData,
                        id: Date.now(),
                        x: copyData.x + 20,
                        y: copyData.y + 20,
                        rotation: copyData.rotation || 0,
                        opacity: copyData.opacity || 1,
                    };

                    if (newElement.type === 'image' && newElement.src) {
                        const img = new Image();
                        img.onload = () => {
                            setElements(prev => prev.map(el => el.id === newElement.id ? { ...el, img: img } : el));
                        };
                        img.src = newElement.src;
                        setElements(prev => [...prev, { ...newElement, img: undefined }]);
                    } else {
                        setElements(prev => [...prev, newElement]);
                    }
                    setSelectedId(newElement.id);
                }
            }

            if (isCtrl && e.key === ']' && selectedId) {
                e.preventDefault();
                moveLayerToExtreme(selectedId, 'front');
            }

            if (isCtrl && e.key === '[' && selectedId) {
                e.preventDefault();
                moveLayerToExtreme(selectedId, 'back');
            }

            if (isCtrl && e.shiftKey && e.key === '}' && selectedId) {
                e.preventDefault();
                moveLayer(selectedId, 'forward');
            }

            if (isCtrl && e.shiftKey && e.key === '{' && selectedId) {
                e.preventDefault();
                moveLayer(selectedId, 'backward');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [selectedId, elements, copiedElement, handleUndo, handleRedo, moveLayer, moveLayerToExtreme, setElements, setSelectedId, setCopiedElement, setContextMenu, setToast]);


    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-900 font-sans text-gray-800">
            {/* Header */}
            <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-lg p-4 flex justify-between items-center z-10">
                <div className="flex items-center gap-2">
                    <div className="bg-emerald-600 p-2 rounded-lg shadow-lg">
                        <MousePointer2 className="text-white" size={20} />
                    </div>
                    <h1 className="text-xl font-bold text-white">Canvas Studio</h1>
                </div>
                
                {/* Visual Clipboard Indicator */}
                {copiedElement && (
                    <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-lg border border-yellow-400/30 text-sm">
                        <Clipboard size={16} />
                        <span>Clipboard: {copiedElement.type} copied</span>
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
                        title="Save design as JSON"
                    >
                        <Save size={18} />
                        Save Canvas
                    </button>

                    {/* LOAD BUTTON */}
                    <button
                        onClick={() => loadFileInputRef.current.click()}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 transition shadow-lg font-medium"
                        title="Load design from JSON"
                    >
                        <FolderOpen size={18} />
                        Load Canvas
                    </button>
                    
                    {/* Hidden Input for loading JSON files */}
                    <input
                        type="file"
                        ref={loadFileInputRef}
                        onChange={handleLoadCanvas}
                        accept=".json"
                        className="hidden"
                    />

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-lg hover:from-emerald-700 hover:to-teal-700 transition shadow-lg font-medium"
                    >
                        <Download size={18} />
                        Export PDF
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Controls */}
                <div className="w-72 bg-white/10 backdrop-blur-lg border-r border-white/20 flex flex-col overflow-y-auto">

                    {/* CANVAS SIZE SECTION */}
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xs font-semibold text-emerald-200 uppercase tracking-wider mb-4">Canvas Size</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col">
                                <label className="text-xs text-emerald-300 mb-1">Width (px)</label>
                                <input
                                    type="number"
                                    value={canvasSize.width}
                                    onChange={(e) => setCanvasSize({ ...canvasSize, width: parseInt(e.target.value) })}
                                    className="bg-white/10 border border-white/20 text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs text-emerald-300 mb-1">Height (px)</label>
                                <input
                                    type="number"
                                    value={canvasSize.height}
                                    onChange={(e) => setCanvasSize({ ...canvasSize, height: parseInt(e.target.value) })}
                                    className="bg-white/10 border border-white/20 text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
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
                                onChange={(e) => setGridSize(Math.max(10, parseInt(e.target.value)))}
                                className="bg-white/10 border border-white/20 text-white rounded-md p-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                                disabled={!showGrid}
                            />
                            <p className="text-xs text-gray-400 mt-1 italic">Snaps to grid when enabled.</p>
                        </div>
                    </div>


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

                    {/* Element Properties (FIXED POSITIONING: Placed here to ensure visibility without scrolling past Creation) */}
                    {selectedElement && (
                        <ElementProperties 
                            selectedElement={selectedElement}
                            setElements={setElements}
                            setSelectedId={setSelectedId}
                            moveLayer={moveLayer} 
                            moveLayerToExtreme={moveLayerToExtreme} 
                            toggleGroupStatus={toggleGroupStatus} // Feature 1
                        />
                    )}
                </div>

                {/* Canvas Area */}
                <div className="flex-1 bg-gradient-to-br from-emerald-800/50 to-teal-900/50 overflow-auto flex items-center justify-center p-8 relative">
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
                            {canvasSize.width} x {canvasSize.height} px
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
                    selectedId={selectedId}
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