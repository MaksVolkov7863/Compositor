/**
 * CursorManager - Canvas and Tool Cursor State Management
 * 
 * Matches Swift CursorTests (CompositorTests/CursorTests.swift)
 */

class CursorManager {
    constructor() {
        this.currentCursor = 'default';
        this.isCanvasActive = true;
        this.isDragging = false;
        this.currentTool = 'move';
        this.brushSize = 20;
    }

    setTool(tool) {
        this.currentTool = tool;
        this.updateCursor();
    }

    setBrushSize(size) {
        this.brushSize = Math.max(1, Math.min(1000, size));
        if (this.currentTool === 'brush' || this.currentTool === 'eraser' || this.currentTool === 'healing') {
            this.updateCursor();
        }
    }

    mouseEnterCanvas() {
        this.isCanvasActive = true;
        this.updateCursor();
    }

    mouseLeaveCanvas() {
        // Leaving the canvas always restores default arrow cursor with every tool
        this.isCanvasActive = false;
        if (!this.isDragging) {
            this.currentCursor = 'default';
        }
    }

    mouseDown(tool) {
        this.isDragging = true;
        if (this.currentTool === 'hand') {
            this.currentCursor = 'grabbing';
        }
    }

    mouseUp(outsideCanvas = false) {
        this.isDragging = false;
        if (outsideCanvas || !this.isCanvasActive) {
            this.currentCursor = 'default';
        } else {
            this.updateCursor();
        }
    }

    getToolCursor(tool) {
        switch (tool) {
            case 'hand':
                return this.isDragging ? 'grabbing' : 'grab';
            case 'brush':
            case 'eraser':
            case 'healing':
                return `circle-${this.brushSize}`;
            case 'eyedropper':
            case 'marquee':
            case 'lasso':
            case 'wand':
                return 'crosshair';
            case 'type':
                return 'text';
            case 'zoom':
                return 'zoom-in';
            case 'move':
            default:
                return 'default';
        }
    }

    updateCursor() {
        if (!this.isCanvasActive) {
            this.currentCursor = 'default';
            return;
        }
        this.currentCursor = this.getToolCursor(this.currentTool);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CursorManager;
}
