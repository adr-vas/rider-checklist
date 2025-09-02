/**
 * Main Application Controller
 * Orchestrates all modules and handles UI interactions
 */

class RiderApp {
    constructor() {
        try {
            this.filesCache = [];
            this.extractedText = '';
            this.parsedData = null;
            this.isProcessing = false;
            
            // Initialize on DOM ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.init());
            } else {
                this.init();
            }
        } catch (error) {
            console.error('Error in constructor:', error);
        }
    }

    /**
     * Initialize application
     */
    init() {
        try {
            console.log('Initializing Rider Checklist Builder...');
            
            // Initialize modules
            this.initializeModules();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Check for saved state
            this.checkSavedState();
            
            // Setup autosave
            this.setupAutosave();
            
            // Show welcome message
            this.showWelcome();
        } catch (error) {
            console.error('Error initializing application:', error);
            showToast('Error initializing application', 'error');
        }
    }

    /**
     * Initialize all modules
     */
    initializeModules() {
        try {
            // Toast system
            try {
                Toast.init();
            } catch (error) {
                console.error('Error initializing Toast system:', error);
            }
            
            // Check for API keys
            try {
                this.checkAPIKeys();
            } catch (error) {
                console.error('Error checking API keys:', error);
            }
            
            // Check for required libraries
            try {
                this.checkRequiredLibraries();
            } catch (error) {
                console.error('Error checking required libraries:', error);
            }
            
            // Initialize drag and drop
            try {
                this.initDragDrop();
            } catch (error) {
                console.error('Error initializing drag and drop:', error);
            }
        } catch (error) {
            console.error('Error initializing modules:', error);
        }
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        try {
            // File upload
            const fileInput = DOM.get('#fileInput');
            const uploadArea = DOM.get('#uploadArea');
            const processBtn = DOM.get('#processBtn');
            const clearBtn = DOM.get('#clearBtn');
            
            if (fileInput) {
                try {
                    fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
                } catch (error) {
                    console.error('Error adding file input change listener:', error);
                }
            }
            
            if (uploadArea) {
                try {
                    uploadArea.addEventListener('click', () => fileInput?.click());
                } catch (error) {
                    console.error('Error adding upload area click listener:', error);
                }
            }
            
            if (processBtn) {
                try {
                    processBtn.addEventListener('click', () => this.processFiles());
                } catch (error) {
                    console.error('Error adding process button click listener:', error);
                }
            }
            
            if (clearBtn) {
                try {
                    clearBtn.addEventListener('click', () => this.clearAll());
                } catch (error) {
                    console.error('Error adding clear button click listener:', error);
                }
            }
            
            // Analysis section
            const generateBtn = DOM.get('#generateBtn');
            const editTextBtn = DOM.get('#editTextBtn');
            const reanalyzeBtn = DOM.get('#reanalyzeBtn');
            const closeEditorBtn = DOM.get('#closeEditorBtn');
            
            if (generateBtn) {
                try {
                    generateBtn.addEventListener('click', () => this.generateChecklist());
                } catch (error) {
                    console.error('Error adding generate button click listener:', error);
                }
            }
            
            if (editTextBtn) {
                try {
                    editTextBtn.addEventListener('click', () => this.showTextEditor());
                } catch (error) {
                    console.error('Error adding edit text button click listener:', error);
                }
            }
            
            if (reanalyzeBtn) {
                try {
                    reanalyzeBtn.addEventListener('click', () => this.reanalyzeText());
                } catch (error) {
                    console.error('Error adding reanalyze button click listener:', error);
                }
            }
            
            if (closeEditorBtn) {
                try {
                    closeEditorBtn.addEventListener('click', () => this.hideTextEditor());
                } catch (error) {
                    console.error('Error adding close editor button click listener:', error);
                }
            }
            
            // Keyboard shortcuts
            try {
                document.addEventListener('keydown', (e) => this.handleKeyboard(e));
            } catch (error) {
                console.error('Error adding keyboard event listener:', error);
            }
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    /**
     * Initialize drag and drop
     */
    initDragDrop() {
        try {
            const uploadArea = DOM.get('#uploadArea');
            if (!uploadArea) return;
            
            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                try {
                    uploadArea.addEventListener(eventName, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    });
                    document.body.addEventListener(eventName, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    });
                } catch (error) {
                    console.error(`Error adding drag event listener for ${eventName}:`, error);
                }
            });
            
            // Highlight drop area when item is dragged over it
            ['dragenter', 'dragover'].forEach(eventName => {
                try {
                    uploadArea.addEventListener(eventName, () => {
                        uploadArea.classList.add('drag-over');
                    });
                } catch (error) {
                    console.error(`Error adding drag highlight listener for ${eventName}:`, error);
                }
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                try {
                    uploadArea.addEventListener(eventName, () => {
                        uploadArea.classList.remove('drag-over');
                    });
                } catch (error) {
                    console.error(`Error adding drag unhighlight listener for ${eventName}:`, error);
                }
            });
            
            // Handle dropped files
            try {
                uploadArea.addEventListener('drop', (e) => {
                    const files = e.dataTransfer.files;
                    this.handleFiles(files);
                });
            } catch (error) {
                console.error('Error adding drop event listener:', error);
            }
        } catch (error) {
            console.error('Error initializing drag and drop:', error);
        }
    }

    /**
     * Handle file selection
     */
    handleFileSelect(event) {
        const files = event.target.files;
        this.handleFiles(files);
    }

    /**
     * Handle files
     */
    handleFiles(files) {
        if (!files || files.length === 0) return;
        
        // Validate files
        const validFiles = [];
        const errors = [];
        
        Array.from(files).forEach(file => {
            try {
                // Check file type
                if (!FileUtils.isValidType(file)) {
                    errors.push(`${file.name}: Unsupported file type`);
                    return;
                }
                
                // Check file size
                if (!FileUtils.isValidSize(file)) {
                    errors.push(`${file.name}: File too large (max ${FileUtils.formatSize(CONFIG.upload.maxFileSize)})`);
                    return;
                }
                
                // Check duplicates
                if (this.filesCache.some(f => f.name === file.name && f.size === file.size)) {
                    errors.push(`${file.name}: Already added`);
                    return;
                }
                
                validFiles.push(file);
            } catch (error) {
                console.error(`Error validating file ${file.name}:`, error);
                errors.push(`${file.name}: Validation error`);
            }
        });
        
        // Show errors
        if (errors.length > 0) {
            errors.forEach(error => showToast(error, 'error'));
        }
        
        // Add valid files
        if (validFiles.length > 0) {
            try {
                this.filesCache.push(...validFiles);
                this.updateFileList();
                this.updateStatus(`${this.filesCache.length} file(s) ready to process`, 'info');
                
                // Enable process button
                const processBtn = DOM.get('#processBtn');
                if (processBtn) processBtn.disabled = false;
            } catch (error) {
                console.error('Error adding files to cache:', error);
                showToast('Error adding files to cache', 'error');
            }
        }
    }

    /**
     * Update file list display
     */
    updateFileList() {
        try {
            const fileList = DOM.get('#fileList');
            if (!fileList) return;
            
            if (this.filesCache.length === 0) {
                fileList.innerHTML = '';
                return;
            }
            
            fileList.innerHTML = '';
            
            this.filesCache.forEach((file, index) => {
                try {
                    const fileItem = DOM.create('div', {
                        className: 'file-item',
                        innerHTML: `
                            <div class="file-info">
                                <span class="file-icon">📄</span>
                                <span class="file-name">${file.name}</span>
                                <span class="file-size">${FileUtils.formatSize(file.size)}</span>
                            </div>
                            <button class="file-remove" data-index="${index}">×</button>
                        `
                    });
                    
                    // Add remove handler
                    const removeBtn = fileItem.querySelector('.file-remove');
                    if (removeBtn) {
                        removeBtn.addEventListener('click', () => this.removeFile(index));
                    }
                    
                    fileList.appendChild(fileItem);
                } catch (error) {
                    console.error(`Error creating file item for ${file.name}:`, error);
                }
            });
        } catch (error) {
            console.error('Error updating file list:', error);
        }
    }

    /**
     * Remove file from list
     */
    removeFile(index) {
        try {
            this.filesCache.splice(index, 1);
            this.updateFileList();
            
            if (this.filesCache.length === 0) {
                this.updateStatus('Ready to process rider documents', 'info');
                const processBtn = DOM.get('#processBtn');
                if (processBtn) processBtn.disabled = true;
            } else {
                this.updateStatus(`${this.filesCache.length} file(s) ready to process`, 'info');
            }
        } catch (error) {
            console.error('Error removing file:', error);
            showToast('Error removing file', 'error');
        }
    }

    /**
     * Process uploaded files
     */
    async processFiles() {
        if (this.filesCache.length === 0) {
            showToast('Please upload files first', 'warning');
            return;
        }
        
        if (this.isProcessing) {
            showToast('Already processing files', 'warning');
            return;
        }
        
        // Check if required libraries are available
        if (typeof pdfjsLib === 'undefined' || typeof Tesseract === 'undefined') {
            showToast('Required libraries not loaded. Please refresh the page.', 'error');
            return;
        }
        
        this.isProcessing = true;
        this.showProcessing(true);
        
        try {
            // Extract text from files
            const result = await ocrProcessor.processFiles(
                this.filesCache,
                (progress) => this.updateProcessingProgress(progress)
            );
            
            this.extractedText = result.totalText;
            
            // Update text editor
            const textArea = DOM.get('#extractedText');
            if (textArea) {
                textArea.value = this.extractedText;
            }
            
            // Parse the extracted text
            await this.parseText();
            
            // Show success
            this.updateStatus(
                `Successfully processed ${result.successCount} file(s)`,
                'success'
            );
            
            // Show analysis section
            DOM.show('#analysisSection');
            DOM.show('#textEditorSection');
            
            // Scroll to analysis
            DOM.get('#analysisSection')?.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            console.error('Processing error:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
            showToast('Failed to process files', 'error');
        } finally {
            this.isProcessing = false;
            this.showProcessing(false);
        }
    }

    /**
     * Parse extracted text
     */
    async parseText() {
        if (!this.extractedText) {
            showToast('No text to parse', 'warning');
            return;
        }
        
        try {
            // Parse with intelligent parser
            this.parsedData = await riderParser.parse(this.extractedText);
            
            // Display detected information
            this.displayDetectedInfo();
            
            // Display structure preview
            this.displayStructurePreview();
            
            // Enable generate button
            const generateBtn = DOM.get('#generateBtn');
            if (generateBtn) {
                generateBtn.style.display = 'inline-flex';
                generateBtn.disabled = false;
            }
            
        } catch (error) {
            console.error('Parsing error:', error);
            showToast('Failed to parse text', 'error');
        }
    }

    /**
     * Display detected information
     */
    displayDetectedInfo() {
        const infoGrid = DOM.get('#infoGrid');
        if (!infoGrid || !this.parsedData) return;
        
        infoGrid.innerHTML = '';
        
        // Artists
        if (this.parsedData.artists.length > 0) {
            infoGrid.appendChild(DOM.create('div', {
                className: 'info-item',
                innerHTML: `
                    <span class="info-label">Artists:</span>
                    <span class="info-value">
                        ${this.parsedData.artists.map(a => `<span class="badge">${a}</span>`).join('')}
                    </span>
                `
            }));
        }
        
        // Rooms
        if (this.parsedData.rooms.length > 0) {
            infoGrid.appendChild(DOM.create('div', {
                className: 'info-item',
                innerHTML: `
                    <span class="info-label">Rooms:</span>
                    <span class="info-value">${this.parsedData.rooms.length} detected</span>
                `
            }));
        }
        
        // Items count
        const itemCount = this.parsedData.items?.length || 
                         Object.values(this.parsedData.categories || {}).flat().length || 0;
        
        if (itemCount > 0) {
            infoGrid.appendChild(DOM.create('div', {
                className: 'info-item',
                innerHTML: `
                    <span class="info-label">Total Items:</span>
                    <span class="info-value">${itemCount}</span>
                `
            }));
        }
        
        // Allergies
        if (this.parsedData.allergies.length > 0) {
            infoGrid.appendChild(DOM.create('div', {
                className: 'info-item',
                innerHTML: `
                    <span class="info-label">⚠️ Allergies:</span>
                    <span class="info-value">
                        ${this.parsedData.allergies.map(a => `<span class="badge warning">${a}</span>`).join('')}
                    </span>
                `
            }));
        }
        
        // Contacts
        if (this.parsedData.contacts.length > 0) {
            infoGrid.appendChild(DOM.create('div', {
                className: 'info-item',
                innerHTML: `
                    <span class="info-label">Contacts:</span>
                    <span class="info-value">${this.parsedData.contacts.length} found</span>
                `
            }));
        }
    }

    /**
     * Display structure preview
     */
    displayStructurePreview() {
        const preview = DOM.get('#structurePreview');
        if (!preview || !this.parsedData) return;
        
        preview.innerHTML = '<h3>Detected Structure</h3>';
        
        // Show by rooms if available
        if (this.parsedData.rooms.length > 0) {
            this.parsedData.rooms.forEach(room => {
                if (room.items.length === 0) return;
                
                const roomSection = DOM.create('div', {
                    className: 'room-section',
                    innerHTML: `
                        <div class="room-title">Room ${room.id} ${room.description ? `- ${room.description}` : ''}</div>
                    `
                });
                
                // Group items by category
                const categories = {};
                room.items.forEach(item => {
                    const cat = item.category || 'General';
                    if (!categories[cat]) categories[cat] = [];
                    categories[cat].push(item);
                });
                
                Object.entries(categories).forEach(([cat, items]) => {
                    const categoryDiv = DOM.create('div', {
                        className: 'category-group',
                        innerHTML: `
                            <div class="category-title">${cat}</div>
                            ${items.map(item => `
                                <div class="item-preview">
                                    • ${item.quantity > 1 ? `(${item.quantity}) ` : ''}${item.name}
                                </div>
                            `).join('')}
                        `
                    });
                    roomSection.appendChild(categoryDiv);
                });
                
                preview.appendChild(roomSection);
            });
        } else if (this.parsedData.categories) {
            // Show by categories
            Object.entries(this.parsedData.categories).forEach(([cat, items]) => {
                if (items.length === 0) return;
                
                const categorySection = DOM.create('div', {
                    className: 'category-group',
                    innerHTML: `
                        <div class="category-title">${cat}</div>
                        ${items.map(item => `
                            <div class="item-preview">
                                • ${item.quantity > 1 ? `(${item.quantity}) ` : ''}${item.name}
                            </div>
                        `).join('')}
                    `
                });
                preview.appendChild(categorySection);
            });
        }
    }

    /**
     * Generate interactive checklist
     */
    generateChecklist() {
        if (!this.parsedData) {
            showToast('No data to generate checklist', 'warning');
            return;
        }
        
        // Generate checklist
        const checklistHTML = checklistManager.generate(this.parsedData);
        
        // Display in modal
        const modal = DOM.get('#checklistModal');
        const container = DOM.get('#checklistContainer');
        
        if (modal && container) {
            container.innerHTML = '';
            container.appendChild(checklistHTML);
            modal.classList.add('active');
            
            // Update progress
            checklistManager.updateProgress();
            
            // Enable autosave
            enableAutosave(() => checklistManager.saveState());
        }
        
        showToast('Checklist generated successfully', 'success');
    }

    /**
     * Show/hide text editor
     */
    showTextEditor() {
        DOM.show('#textEditorSection');
        const textArea = DOM.get('#extractedText');
        if (textArea) {
            textArea.value = this.extractedText;
            textArea.focus();
        }
    }

    hideTextEditor() {
        DOM.hide('#textEditorSection');
    }

    /**
     * Re-analyze edited text
     */
    async reanalyzeText() {
        const textArea = DOM.get('#extractedText');
        if (!textArea) return;
        
        this.extractedText = textArea.value;
        
        if (!this.extractedText) {
            showToast('No text to analyze', 'warning');
            return;
        }
        
        showToast('Re-analyzing text...', 'info');
        await this.parseText();
        showToast('Text re-analyzed successfully', 'success');
    }

    /**
     * Clear all data
     */
    clearAll() {
        if (this.filesCache.length > 0 || this.extractedText) {
            if (!confirm('Clear all files and data?')) return;
        }
        
        this.filesCache = [];
        this.extractedText = '';
        this.parsedData = null;
        
        // Clear UI
        this.updateFileList();
        DOM.hide('#analysisSection');
        DOM.hide('#textEditorSection');
        
        // Clear text area
        const textArea = DOM.get('#extractedText');
        if (textArea) textArea.value = '';
        
        // Reset status
        this.updateStatus('Ready to process rider documents', 'info');
        
        // Disable buttons
        const processBtn = DOM.get('#processBtn');
        if (processBtn) processBtn.disabled = true;
        
        showToast('All data cleared', 'info');
    }

    /**
     * Update status message
     */
    updateStatus(message, type = 'info') {
        try {
            const statusDiv = DOM.get('#statusMessage');
            if (!statusDiv) return;
            
            statusDiv.className = `status-message ${type}`;
            
            const icons = {
                info: 'ℹ️',
                success: '✅',
                warning: '⚠️',
                error: '❌'
            };
            
            statusDiv.innerHTML = `
                <span class="status-icon">${icons[type]}</span>
                <span class="status-text">${message}</span>
            `;
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }

    /**
     * Show/hide processing overlay
     */
    showProcessing(show) {
        try {
            const overlay = DOM.get('#processingOverlay');
            if (overlay) {
                overlay.classList.toggle('active', show);
            }
        } catch (error) {
            console.error('Error showing/hiding processing overlay:', error);
        }
    }

    /**
     * Update processing progress
     */
    updateProcessingProgress(progress) {
        try {
            const text = DOM.get('#processingText');
            const progressBar = DOM.get('#processingProgress');
            
            if (text) {
                text.textContent = progress.message || 'Processing...';
            }
            
            if (progressBar && progress.progress) {
                progressBar.style.width = `${Math.round(progress.progress * 100)}%`;
            }
        } catch (error) {
            console.error('Error updating processing progress:', error);
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(event) {
        try {
            // Ctrl/Cmd + O: Open files
            if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
                event.preventDefault();
                DOM.get('#fileInput')?.click();
            }
            
            // Ctrl/Cmd + S: Save
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                if (this.parsedData) {
                    try {
                        checklistManager.saveState();
                        showToast('Progress saved', 'success');
                    } catch (error) {
                        console.error('Error saving state:', error);
                        showToast('Error saving progress', 'error');
                    }
                }
            }
            
            // Escape: Close modal
            if (event.key === 'Escape') {
                this.closeChecklistModal();
            }
        } catch (error) {
            console.error('Error handling keyboard event:', error);
        }
    }

    /**
     * Close checklist modal
     */
    closeChecklistModal() {
        try {
            const modal = DOM.get('#checklistModal');
            if (modal) {
                modal.classList.remove('active');
            }
        } catch (error) {
            console.error('Error closing checklist modal:', error);
        }
    }

    /**
     * Check for saved state
     */
    checkSavedState() {
        try {
            const state = Storage.get(CONFIG.storage.checklistState);
            
            if (state && state.currentData) {
                const lastSaved = state.lastSaved ? DateUtils.relative(state.lastSaved) : 'unknown time';
                
                const restore = confirm(`Found saved checklist from ${lastSaved}. Would you like to restore it?`);
                
                if (restore) {
                    this.parsedData = state.currentData;
                    this.displayDetectedInfo();
                    this.displayStructurePreview();
                    DOM.show('#analysisSection');
                    showToast('Previous checklist restored', 'success');
                }
            }
        } catch (error) {
            console.error('Error checking saved state:', error);
        }
    }

    /**
     * Check for API keys
     */
    checkAPIKeys() {
        const apiKey = localStorage.getItem('riderLLMKey');
        
        if (apiKey) {
            showToast('LLM parsing enabled', 'success');
        } else {
            console.log('No API key found - using regex parsing');
        }
    }

    /**
     * Check for required libraries
     */
    checkRequiredLibraries() {
        // Check PDF.js
        if (typeof pdfjsLib === 'undefined') {
            console.warn('PDF.js library not loaded - PDF processing will be disabled');
            showToast('PDF processing disabled - PDF.js not loaded', 'warning');
        } else {
            console.log('PDF.js library loaded successfully');
        }
        
        // Check Tesseract.js
        if (typeof Tesseract === 'undefined') {
            console.warn('Tesseract.js library not loaded - OCR processing will be disabled');
            showToast('OCR processing disabled - Tesseract.js not loaded', 'warning');
        } else {
            console.log('Tesseract.js library loaded successfully');
        }
    }

    /**
     * Setup autosave
     */
    setupAutosave() {
        // Autosave every 30 seconds if there's data
        setInterval(() => {
            try {
                if (this.parsedData && checklistManager.currentData) {
                    checklistManager.saveState();
                }
            } catch (error) {
                console.error('Error in autosave:', error);
            }
        }, CONFIG.ui.autosaveInterval);
    }

    /**
     * Show welcome message
     */
    showWelcome() {
        try {
            const hasVisited = Storage.get('hasVisitedBefore');
            
            if (!hasVisited) {
                setTimeout(() => {
                    try {
                        showToast('Welcome! Upload rider PDFs or images to get started', 'info', 5000);
                        Storage.set('hasVisitedBefore', true);
                    } catch (error) {
                        console.error('Error showing welcome toast:', error);
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Error in showWelcome:', error);
        }
    }
}

// Make closeChecklistModal globally available
window.closeChecklistModal = () => {
    try {
        const modal = DOM.get('#checklistModal');
        if (modal) {
            modal.classList.remove('active');
        }
    } catch (error) {
        console.error('Error closing checklist modal:', error);
    }
};

// Initialize application
try {
    const app = new RiderApp();
    
    // Export for debugging
    window.riderApp = app;
} catch (error) {
    console.error('Error creating RiderApp instance:', error);
    showToast('Error initializing application', 'error');
}