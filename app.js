/**
 * Main Application Controller
 * Orchestrates all modules and handles UI interactions
 */

class RiderApp {
    constructor() {
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
    }

    /**
     * Initialize application
     */
    init() {
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
    }

    /**
     * Initialize all modules
     */
    initializeModules() {
        // Toast system
        Toast.init();
        
        // Check for API keys
        this.checkAPIKeys();
        
        // Initialize drag and drop
        this.initDragDrop();
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // File upload
        const fileInput = DOM.get('#fileInput');
        const uploadArea = DOM.get('#uploadArea');
        const processBtn = DOM.get('#processBtn');
        const clearBtn = DOM.get('#clearBtn');
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        if (uploadArea) {
            uploadArea.addEventListener('click', () => fileInput?.click());
        }
        
        if (processBtn) {
            processBtn.addEventListener('click', () => this.processFiles());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAll());
        }
        
        // Analysis section
        const generateBtn = DOM.get('#generateBtn');
        const editTextBtn = DOM.get('#editTextBtn');
        const reanalyzeBtn = DOM.get('#reanalyzeBtn');
        const closeEditorBtn = DOM.get('#closeEditorBtn');
        
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateChecklist());
        }
        
        if (editTextBtn) {
            editTextBtn.addEventListener('click', () => this.showTextEditor());
        }
        
        if (reanalyzeBtn) {
            reanalyzeBtn.addEventListener('click', () => this.reanalyzeText());
        }
        
        if (closeEditorBtn) {
            closeEditorBtn.addEventListener('click', () => this.hideTextEditor());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    /**
     * Initialize drag and drop
     */
    initDragDrop() {
        const uploadArea = DOM.get('#uploadArea');
        if (!uploadArea) return;
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            document.body.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.add('drag-over');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => {
                uploadArea.classList.remove('drag-over');
            });
        });
        
        // Handle dropped files
        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
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
        });
        
        // Show errors
        if (errors.length > 0) {
            errors.forEach(error => showToast(error, 'error'));
        }
        
        // Add valid files
        if (validFiles.length > 0) {
            this.filesCache.push(...validFiles);
            this.updateFileList();
            this.updateStatus(`${this.filesCache.length} file(s) ready to process`, 'info');
            
            // Enable process button
            const processBtn = DOM.get('#processBtn');
            if (processBtn) processBtn.disabled = false;
        }
    }

    /**
     * Update file list display
     */
    updateFileList() {
        const fileList = DOM.get('#fileList');
        if (!fileList) return;
        
        if (this.filesCache.length === 0) {
            fileList.innerHTML = '';
            return;
        }
        
        fileList.innerHTML = '';
        
        this.filesCache.forEach((file, index) => {
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
            removeBtn.addEventListener('click', () => this.removeFile(index));
            
            fileList.appendChild(fileItem);
        });
    }

    /**
     * Remove file from list
     */
    removeFile(index) {
        this.filesCache.splice(index, 1);
        this.updateFileList();
        
        if (this.filesCache.length === 0) {
            this.updateStatus('Ready to process rider documents', 'info');
            const processBtn = DOM.get('#processBtn');
            if (processBtn) processBtn.disabled = true;
        } else {
            this.updateStatus(`${this.filesCache.length} file(s) ready to process`, 'info');
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
    }

    /**
     * Show/hide processing overlay
     */
    showProcessing(show) {
        const overlay = DOM.get('#processingOverlay');
        if (overlay) {
            overlay.classList.toggle('active', show);
        }
    }

    /**
     * Update processing progress
     */
    updateProcessingProgress(progress) {
        const text = DOM.get('#processingText');
        const progressBar = DOM.get('#processingProgress');
        
        if (text) {
            text.textContent = progress.message || 'Processing...';
        }
        
        if (progressBar && progress.progress) {
            progressBar.style.width = `${Math.round(progress.progress * 100)}%`;
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboard(event) {
        // Ctrl/Cmd + O: Open files
        if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
            event.preventDefault();
            DOM.get('#fileInput')?.click();
        }
        
        // Ctrl/Cmd + S: Save
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            if (this.parsedData) {
                checklistManager.saveState();
                showToast('Progress saved', 'success');
            }
        }
        
        // Escape: Close modal
        if (event.key === 'Escape') {
            this.closeChecklistModal();
        }
    }

    /**
     * Close checklist modal
     */
    closeChecklistModal() {
        const modal = DOM.get('#checklistModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Check for saved state
     */
    checkSavedState() {
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
     * Setup autosave
     */
    setupAutosave() {
        // Autosave every 30 seconds if there's data
        setInterval(() => {
            if (this.parsedData && checklistManager.currentData) {
                checklistManager.saveState();
            }
        }, CONFIG.ui.autosaveInterval);
    }

    /**
     * Show welcome message
     */
    showWelcome() {
        const hasVisited = Storage.get('hasVisitedBefore');
        
        if (!hasVisited) {
            setTimeout(() => {
                showToast('Welcome! Upload rider PDFs or images to get started', 'info', 5000);
                Storage.set('hasVisitedBefore', true);
            }, 1000);
        }
    }
}

// Make closeChecklistModal globally available
window.closeChecklistModal = () => {
    const modal = DOM.get('#checklistModal');
    if (modal) {
        modal.classList.remove('active');
    }
};

// Initialize application
const app = new RiderApp();

// Export for debugging
window.riderApp = app;