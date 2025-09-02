/**
 * Interactive Checklist Generation and Management
 */

class ChecklistManager {
    constructor() {
        this.currentData = null;
        this.checklistItems = [];
        this.completedItems = new Set();
        this.itemNotes = new Map();
        this.lastSaved = null;
        
        // Load saved state if exists
        this.loadState();
    }

    /**
     * Generate checklist from parsed data
     */
    generate(parsedData) {
        this.currentData = parsedData;
        this.checklistItems = this.flattenItems(parsedData);
        
        // Generate HTML
        const html = this.buildChecklistHTML(parsedData);
        
        // Store in memory
        this.saveState();
        
        return html;
    }

    /**
     * Flatten items from parsed data
     */
    flattenItems(data) {
        const items = [];
        let id = 0;
        
        // Process by rooms if available
        if (data.rooms && data.rooms.length > 0) {
            data.rooms.forEach(room => {
                room.items.forEach(item => {
                    items.push({
                        id: `item_${id++}`,
                        ...item,
                        roomId: room.id,
                        roomName: room.name || `Room ${room.id}`
                    });
                });
            });
        }
        
        // Process by categories
        if (data.categories) {
            Object.entries(data.categories).forEach(([category, categoryItems]) => {
                categoryItems.forEach(item => {
                    // Check if item already added from rooms
                    const exists = items.some(i => 
                        i.name === item.name && 
                        i.category === category &&
                        i.room === item.room
                    );
                    
                    if (!exists) {
                        items.push({
                            id: `item_${id++}`,
                            ...item,
                            category: category
                        });
                    }
                });
            });
        }
        
        // Process standalone items
        if (data.items) {
            data.items.forEach(item => {
                const exists = items.some(i => 
                    i.name === item.name && 
                    i.category === item.category
                );
                
                if (!exists) {
                    items.push({
                        id: `item_${id++}`,
                        ...item
                    });
                }
            });
        }
        
        return items;
    }

    /**
     * Build complete checklist HTML
     */
    buildChecklistHTML(data) {
        const container = DOM.create('div', { className: 'checklist-container' });
        
        // Header
        container.appendChild(this.buildHeader(data));
        
        // Progress bar
        container.appendChild(this.buildProgressBar());
        
        // Allergy warning
        if (data.allergies && data.allergies.length > 0) {
            container.appendChild(this.buildAllergyWarning(data.allergies));
        }
        
        // Action buttons
        container.appendChild(this.buildActionButtons());
        
        // Checklist items
        container.appendChild(this.buildItemsSection(data));
        
        // Footer actions
        container.appendChild(this.buildFooterActions());
        
        return container;
    }

    /**
     * Build checklist header
     */
    buildHeader(data) {
        const header = DOM.create('div', { className: 'checklist-header' });
        
        // Title
        const title = DOM.create('h2', {
            textContent: 'Tour Rider Checklist'
        });
        header.appendChild(title);
        
        // Artists
        if (data.artists && data.artists.length > 0) {
            const artists = DOM.create('div', {
                className: 'checklist-artists',
                innerHTML: data.artists.map(a => 
                    `<span class="badge">${a}</span>`
                ).join('')
            });
            header.appendChild(artists);
        }
        
        // Metadata
        const meta = DOM.create('div', { className: 'checklist-meta' });
        
        // Date
        meta.appendChild(DOM.create('span', {
            className: 'meta-item',
            textContent: `Date: ${DateUtils.format(new Date())}`
        }));
        
        // Total items
        meta.appendChild(DOM.create('span', {
            className: 'meta-item',
            textContent: `Total Items: ${this.checklistItems.length}`
        }));
        
        // Rooms
        if (data.rooms && data.rooms.length > 0) {
            meta.appendChild(DOM.create('span', {
                className: 'meta-item',
                textContent: `Rooms: ${data.rooms.length}`
            }));
        }
        
        header.appendChild(meta);
        
        return header;
    }

    /**
     * Build progress bar
     */
    buildProgressBar() {
        const container = DOM.create('div', { className: 'checklist-progress' });
        
        // Progress bar
        const progressBar = DOM.create('div', {
            className: 'progress-bar',
            innerHTML: '<div class="progress-fill" id="checklistProgressFill" style="width: 0%"></div>'
        });
        container.appendChild(progressBar);
        
        // Stats
        const stats = DOM.create('div', {
            className: 'checklist-stats',
            id: 'checklistStats',
            textContent: '0% Complete (0 of 0 items)'
        });
        container.appendChild(stats);
        
        return container;
    }

    /**
     * Build allergy warning
     */
    buildAllergyWarning(allergies) {
        return DOM.create('div', {
            className: 'allergy-warning',
            innerHTML: `
                <strong>⚠️ ALLERGY ALERT:</strong> 
                ${allergies.map(a => `<span class="allergy-item">${a}</span>`).join(', ')}
            `
        });
    }

    /**
     * Build action buttons
     */
    buildActionButtons() {
        const container = DOM.create('div', { className: 'checklist-actions-top' });
        
        // Quick actions
        const actions = [
            { text: 'Check All', icon: '✓', onclick: () => this.checkAll() },
            { text: 'Uncheck All', icon: '✗', onclick: () => this.uncheckAll() },
            { text: 'Expand All', icon: '▼', onclick: () => this.expandAll() },
            { text: 'Collapse All', icon: '▶', onclick: () => this.collapseAll() }
        ];
        
        actions.forEach(action => {
            container.appendChild(DOM.create('button', {
                className: 'btn btn-secondary btn-small',
                innerHTML: `<span>${action.icon}</span> ${action.text}`,
                onclick: action.onclick
            }));
        });
        
        return container;
    }

    /**
     * Build items section
     */
    buildItemsSection(data) {
        const container = DOM.create('div', { className: 'checklist-items' });
        
        // Group items by room or category
        if (data.rooms && data.rooms.length > 0) {
            // Organize by rooms
            data.rooms.forEach(room => {
                if (room.items.length === 0) return;
                
                const section = this.buildRoomSection(room);
                container.appendChild(section);
            });
            
            // Add items without room assignment
            const unassignedItems = this.checklistItems.filter(item => !item.roomId);
            if (unassignedItems.length > 0) {
                const section = this.buildCategorySection('Other Items', unassignedItems);
                container.appendChild(section);
            }
        } else {
            // Organize by categories
            const categorized = this.groupByCategory(this.checklistItems);
            Object.entries(categorized).forEach(([category, items]) => {
                const section = this.buildCategorySection(category, items);
                container.appendChild(section);
            });
        }
        
        return container;
    }

    /**
     * Build room section
     */
    buildRoomSection(room) {
        const section = DOM.create('div', {
            className: 'checklist-section',
            id: `room_${room.id}`
        });
        
        // Header
        const header = DOM.create('h3', {
            className: 'section-header',
            innerHTML: `
                <span class="section-toggle" onclick="checklistManager.toggleSection('room_${room.id}')">▼</span>
                Room ${room.id} ${room.description ? `- ${room.description}` : ''}
                <span class="section-count">(${room.items.length} items)</span>
            `
        });
        section.appendChild(header);
        
        // Items container
        const itemsContainer = DOM.create('div', {
            className: 'section-items'
        });
        
        // Group items by category within room
        const categorized = this.groupByCategory(room.items);
        Object.entries(categorized).forEach(([category, items]) => {
            const categoryDiv = DOM.create('div', { className: 'checklist-category' });
            
            // Category header
            categoryDiv.appendChild(DOM.create('h4', {
                className: 'category-header',
                textContent: category
            }));
            
            // Items
            items.forEach(item => {
                categoryDiv.appendChild(this.buildItemElement(item));
            });
            
            itemsContainer.appendChild(categoryDiv);
        });
        
        section.appendChild(itemsContainer);
        
        return section;
    }

    /**
     * Build category section
     */
    buildCategorySection(category, items) {
        const section = DOM.create('div', {
            className: 'checklist-section',
            id: `category_${category.replace(/\s+/g, '_')}`
        });
        
        // Header
        const header = DOM.create('h3', {
            className: 'section-header',
            innerHTML: `
                <span class="section-toggle" onclick="checklistManager.toggleSection('category_${category.replace(/\s+/g, '_')}')">▼</span>
                ${category}
                <span class="section-count">(${items.length} items)</span>
            `
        });
        section.appendChild(header);
        
        // Items container
        const itemsContainer = DOM.create('div', {
            className: 'section-items'
        });
        
        // Items
        items.forEach(item => {
            itemsContainer.appendChild(this.buildItemElement(item));
        });
        
        section.appendChild(itemsContainer);
        
        return section;
    }

    /**
     * Build individual item element
     */
    buildItemElement(item) {
        const itemDiv = DOM.create('div', {
            className: 'checklist-item',
            id: item.id
        });
        
        // Checkbox
        const checkbox = DOM.create('input', {
            type: 'checkbox',
            className: 'checklist-checkbox',
            id: `${item.id}_check`,
            checked: this.completedItems.has(item.id),
            onchange: (e) => this.toggleItem(item.id, e.target.checked)
        });
        itemDiv.appendChild(checkbox);
        
        // Label
        const label = DOM.create('label', {
            className: 'checklist-label',
            htmlFor: `${item.id}_check`
        });
        
        // Quantity
        if (item.quantity && item.quantity > 1) {
            label.appendChild(DOM.create('span', {
                className: 'quantity-badge',
                textContent: `(${item.quantity})`
            }));
        }
        
        // Item name
        label.appendChild(DOM.create('span', {
            textContent: item.name
        }));
        
        // Brand
        if (item.brand) {
            label.appendChild(DOM.create('span', {
                className: 'brand-badge',
                textContent: item.brand
            }));
        }
        
        // Room badge
        if (item.roomId) {
            label.appendChild(DOM.create('span', {
                className: 'room-badge',
                textContent: `Room ${item.roomId}`
            }));
        }
        
        // Must have indicator
        if (item.mustHave) {
            label.appendChild(DOM.create('span', {
                className: 'must-have-badge',
                textContent: 'MUST HAVE'
            }));
        }
        
        itemDiv.appendChild(label);
        
        // Notes input
        const notes = DOM.create('input', {
            type: 'text',
            className: 'checklist-notes',
            placeholder: 'Notes',
            value: this.itemNotes.get(item.id) || '',
            onchange: (e) => this.updateNotes(item.id, e.target.value)
        });
        itemDiv.appendChild(notes);
        
        // Update completed state
        if (this.completedItems.has(item.id)) {
            itemDiv.classList.add('completed');
        }
        
        return itemDiv;
    }

    /**
     * Build footer actions
     */
    buildFooterActions() {
        const container = DOM.create('div', { className: 'checklist-actions' });
        
        // Print button
        container.appendChild(DOM.create('button', {
            className: 'btn btn-primary',
            innerHTML: '<span>🖨️</span> Print Checklist',
            onclick: () => this.print()
        }));
        
        // Export button
        container.appendChild(DOM.create('button', {
            className: 'btn btn-success',
            innerHTML: '<span>💾</span> Export',
            onclick: () => this.showExportOptions()
        }));
        
        // Reset button
        container.appendChild(DOM.create('button', {
            className: 'btn btn-secondary',
            innerHTML: '<span>🔄</span> Reset All',
            onclick: () => this.resetAll()
        }));
        
        // Save button
        container.appendChild(DOM.create('button', {
            className: 'btn btn-primary',
            innerHTML: '<span>💾</span> Save Progress',
            onclick: () => this.saveProgress()
        }));
        
        return container;
    }

    /**
     * Toggle item completion
     */
    toggleItem(itemId, checked) {
        const itemElement = document.getElementById(itemId);
        
        if (checked) {
            this.completedItems.add(itemId);
            itemElement?.classList.add('completed');
        } else {
            this.completedItems.delete(itemId);
            itemElement?.classList.remove('completed');
        }
        
        this.updateProgress();
        this.saveState();
    }

    /**
     * Update item notes
     */
    updateNotes(itemId, notes) {
        if (notes) {
            this.itemNotes.set(itemId, notes);
        } else {
            this.itemNotes.delete(itemId);
        }
        this.saveState();
    }

    /**
     * Update progress display
     */
    updateProgress() {
        const total = this.checklistItems.length;
        const completed = this.completedItems.size;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        // Update progress bar
        const progressFill = document.getElementById('checklistProgressFill');
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        // Update stats
        const stats = document.getElementById('checklistStats');
        if (stats) {
            stats.textContent = `${percentage}% Complete (${completed} of ${total} items)`;
        }
    }

    /**
     * Group items by category
     */
    groupByCategory(items) {
        const grouped = {};
        
        items.forEach(item => {
            const category = item.category || 'General';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(item);
        });
        
        return grouped;
    }

    /**
     * Toggle section visibility
     */
    toggleSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;
        
        const items = section.querySelector('.section-items');
        const toggle = section.querySelector('.section-toggle');
        
        if (items.style.display === 'none') {
            items.style.display = 'block';
            toggle.textContent = '▼';
        } else {
            items.style.display = 'none';
            toggle.textContent = '▶';
        }
    }

    /**
     * Check all items
     */
    checkAll() {
        this.checklistItems.forEach(item => {
            this.completedItems.add(item.id);
            const checkbox = document.getElementById(`${item.id}_check`);
            if (checkbox) checkbox.checked = true;
            const itemElement = document.getElementById(item.id);
            if (itemElement) itemElement.classList.add('completed');
        });
        
        this.updateProgress();
        this.saveState();
    }

    /**
     * Uncheck all items
     */
    uncheckAll() {
        this.completedItems.clear();
        document.querySelectorAll('.checklist-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.checklist-item').forEach(item => item.classList.remove('completed'));
        
        this.updateProgress();
        this.saveState();
    }

    /**
     * Expand all sections
     */
    expandAll() {
        document.querySelectorAll('.section-items').forEach(section => {
            section.style.display = 'block';
        });
        document.querySelectorAll('.section-toggle').forEach(toggle => {
            toggle.textContent = '▼';
        });
    }

    /**
     * Collapse all sections
     */
    collapseAll() {
        document.querySelectorAll('.section-items').forEach(section => {
            section.style.display = 'none';
        });
        document.querySelectorAll('.section-toggle').forEach(toggle => {
            toggle.textContent = '▶';
        });
    }

    /**
     * Reset all progress
     */
    resetAll() {
        if (!confirm('Are you sure you want to reset all checkboxes and notes?')) return;
        
        this.completedItems.clear();
        this.itemNotes.clear();
        
        document.querySelectorAll('.checklist-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.checklist-notes').forEach(input => input.value = '');
        document.querySelectorAll('.checklist-item').forEach(item => item.classList.remove('completed'));
        
        this.updateProgress();
        this.saveState();
        
        showToast('Checklist reset', 'info');
    }

    /**
     * Print checklist
     */
    print() {
        window.print();
    }

    /**
     * Show export options
     */
    showExportOptions() {
        const data = this.getExportData();
        
        // Create export modal
        const modal = DOM.create('div', {
            className: 'export-modal',
            innerHTML: `
                <h3>Export Checklist</h3>
                <button onclick="checklistManager.exportJSON()">📄 Export as JSON</button>
                <button onclick="checklistManager.exportCSV()">📊 Export as CSV</button>
                <button onclick="checklistManager.exportHTML()">🌐 Export as HTML</button>
                <button onclick="checklistManager.exportPDF()">📑 Export as PDF</button>
            `
        });
        
        // For now, just export JSON
        this.exportJSON();
    }

    /**
     * Export as JSON
     */
    exportJSON() {
        const data = this.getExportData();
        const timestamp = DateUtils.format(new Date(), 'YYYY-MM-DD_HHmm');
        DataExport.exportJSON(data, `rider-checklist_${timestamp}.json`);
        showToast('Exported as JSON', 'success');
    }

    /**
     * Export as CSV
     */
    exportCSV() {
        const items = this.checklistItems.map(item => ({
            ...item,
            completed: this.completedItems.has(item.id),
            notes: this.itemNotes.get(item.id) || ''
        }));
        
        const timestamp = DateUtils.format(new Date(), 'YYYY-MM-DD_HHmm');
        DataExport.exportCSV(items, `rider-checklist_${timestamp}.csv`);
        showToast('Exported as CSV', 'success');
    }

    /**
     * Export as HTML
     */
    exportHTML() {
        const data = this.getExportData();
        const timestamp = DateUtils.format(new Date(), 'YYYY-MM-DD_HHmm');
        DataExport.exportHTML(data, `rider-checklist_${timestamp}.html`);
        showToast('Exported as HTML', 'success');
    }

    /**
     * Get export data
     */
    getExportData() {
        return {
            ...this.currentData,
            exportDate: new Date().toISOString(),
            completedItems: Array.from(this.completedItems),
            itemNotes: Array.from(this.itemNotes.entries()),
            progress: {
                total: this.checklistItems.length,
                completed: this.completedItems.size,
                percentage: Math.round((this.completedItems.size / this.checklistItems.length) * 100)
            }
        };
    }

    /**
     * Save progress
     */
    saveProgress() {
        this.saveState();
        showToast('Progress saved', 'success');
    }

    /**
     * Save state to localStorage
     */
    saveState() {
        const state = {
            currentData: this.currentData,
            completedItems: Array.from(this.completedItems),
            itemNotes: Array.from(this.itemNotes.entries()),
            lastSaved: new Date().toISOString()
        };
        
        Storage.set(CONFIG.storage.checklistState, state);
        this.lastSaved = new Date();
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        const state = Storage.get(CONFIG.storage.checklistState);
        
        if (state) {
            this.currentData = state.currentData;
            this.completedItems = new Set(state.completedItems || []);
            this.itemNotes = new Map(state.itemNotes || []);
            this.lastSaved = state.lastSaved ? new Date(state.lastSaved) : null;
            
            if (this.currentData) {
                this.checklistItems = this.flattenItems(this.currentData);
            }
        }
    }
}

// Create global instance
const checklistManager = new ChecklistManager();