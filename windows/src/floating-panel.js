/**
 * FloatingPanelController - Non-modal movable inspector and adjustment panels
 * 
 * Matches Swift FloatingPanelTests (CompositorTests/FloatingPanelTests.swift)
 */

class FloatingPanelController {
    constructor(name, options = {}) {
        this.name = name;
        this.isVisible = false;
        this.title = options.title || '';
        this.x = options.x || 100;
        this.y = options.y || 100;
        this.width = options.width || 320;
        this.height = options.height || 240;
        this.onClose = null;
        this.onCommit = null;
        this.content = null;
    }

    show(content, session = null) {
        this.content = content;
        this.session = session;
        this.isVisible = true;
    }

    close(commit = false) {
        if (!this.isVisible) return;
        this.isVisible = false;
        if (commit) {
            if (typeof this.onCommit === 'function') this.onCommit();
        } else {
            if (typeof this.onClose === 'function') this.onClose();
        }
        this.content = null;
    }

    clampToViewport(viewportWidth, viewportHeight) {
        this.x = Math.max(0, Math.min(viewportWidth - this.width, this.x));
        this.y = Math.max(0, Math.min(viewportHeight - this.height, this.y));
    }

    moveTo(newX, newY, viewportWidth = 1920, viewportHeight = 1080) {
        this.x = newX;
        this.y = newY;
        this.clampToViewport(viewportWidth, viewportHeight);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloatingPanelController;
}
