/**
 * Utility Functions and Helpers
 */

// DOM Utilities
const DOM = {
    /**
     * Safely query selector
     */
    get(selector) {
        return document.querySelector(selector);
    },

    /**
     * Query all elements
     */
    getAll(selector) {
        return document.querySelectorAll(selector);
    },

    /**
     * Create element with attributes
     */
    create(tag, attrs = {}, children = []) {
        const element = document.createElement(tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key.startsWith('on')) {
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        });
        return element;
    },

    /**
     * Show/hide elements
     */
    show(element, display = 'block') {
        if (typeof element === 'string') element = DOM.get(element);
        if (element) element.style.display = display;
    },

    hide(element) {
        if (typeof element === 'string') element = DOM.get(element);
        if (element) element.style.display = 'none';
    },

    /**
     * Toggle visibility
     */
    toggle(element) {
        if (typeof element === 'string') element = DOM.get(element);
        if (element) {
            element.style.display = element.style.display === 'none' ? 'block' : 'none';
        }
    }
};

// File Utilities
const FileUtils = {
    /**
     * Format file size
     */
    formatSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * Check if file type is valid
     */
    isValidType(file) {
        return CONFIG.upload.acceptedFormats.includes(file.type);
    },

    /**
     * Check if file size is valid
     */
    isValidSize(file) {
        return file.size <= CONFIG.upload.maxFileSize;
    },

    /**
     * Get file extension
     */
    getExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    },

    /**
     * Create file reader promise
     */
    readAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    readAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
};

// Storage Utilities
const Storage = {
    /**
     * Save to localStorage with JSON serialization
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    },

    /**
     * Get from localStorage with JSON parsing
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage error:', e);
            return defaultValue;
        }
    },

    /**
     * Remove from localStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    },

    /**
     * Clear all app storage
     */
    clearAll() {
        Object.values(CONFIG.storage).forEach(key => {
            Storage.remove(key);
        });
    },

    /**
     * Get storage size
     */
    getSize() {
        let size = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                size += localStorage[key].length + key.length;
            }
        }
        return size;
    }
};

// Toast Notification System
const Toast = {
    container: null,

    /**
     * Initialize toast container
     */
    init() {
        if (!Toast.container) {
            Toast.container = DOM.get('#toastContainer');
            if (!Toast.container) {
                Toast.container = DOM.create('div', {
                    id: 'toastContainer',
                    className: 'toast-container'
                });
                document.body.appendChild(Toast.container);
            }
        }
    },

    /**
     * Show toast notification
     */
    show(message, type = 'info', duration = CONFIG.ui.toastDuration) {
        Toast.init();

        const toast = DOM.create('div', {
            className: `toast ${type}`,
            innerHTML: `
                <span class="toast-icon">${Toast.getIcon(type)}</span>
                <span class="toast-message">${message}</span>
            `
        });

        Toast.container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }
};

// Export/Import Utilities
const DataExport = {
    /**
     * Export data as JSON
     */
    exportJSON(data, filename = 'rider-checklist.json') {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        DataExport.download(blob, filename);
    },

    /**
     * Export data as CSV
     */
    exportCSV(items, filename = 'rider-checklist.csv') {
        const headers = ['Item', 'Quantity', 'Category', 'Room', 'Notes', 'Completed'];
        const rows = items.map(item => [
            item.name,
            item.quantity,
            item.category,
            item.room || '',
            item.notes || '',
            item.completed ? 'Yes' : 'No'
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        DataExport.download(blob, filename);
    },

    /**
     * Export as printable HTML
     */
    exportHTML(data, filename = 'rider-checklist.html') {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${data.title || 'Rider Checklist'}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        h2 { color: #666; border-bottom: 2px solid #eee; padding-bottom: 5px; }
        .item { padding: 8px; border-bottom: 1px solid #eee; }
        .completed { text-decoration: line-through; opacity: 0.6; }
        .checkbox { width: 20px; height: 20px; margin-right: 10px; }
        @media print { body { max-width: 100%; } }
    </style>
</head>
<body>
    <h1>${data.title || 'Rider Checklist'}</h1>
    ${data.artists ? `<p><strong>Artists:</strong> ${data.artists.join(', ')}</p>` : ''}
    ${data.allergies ? `<p style="color: red;"><strong>⚠️ Allergies:</strong> ${data.allergies.join(', ')}</p>` : ''}
    ${DataExport.generateHTMLContent(data)}
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html' });
        DataExport.download(blob, filename);
    },

    generateHTMLContent(data) {
        let html = '';
        
        if (data.rooms && data.rooms.length > 0) {
            data.rooms.forEach(room => {
                if (room.items.length === 0) return;
                html += `<h2>Room ${room.id} ${room.description ? `- ${room.description}` : ''}</h2>`;
                room.items.forEach(item => {
                    html += `
                        <div class="item ${item.completed ? 'completed' : ''}">
                            <input type="checkbox" class="checkbox" ${item.completed ? 'checked' : ''}>
                            ${item.quantity > 1 ? `(${item.quantity}) ` : ''}${item.name}
                            ${item.notes ? `- ${item.notes}` : ''}
                        </div>`;
                });
            });
        } else if (data.categories) {
            Object.entries(data.categories).forEach(([category, items]) => {
                if (items.length === 0) return;
                html += `<h2>${category}</h2>`;
                items.forEach(item => {
                    html += `
                        <div class="item ${item.completed ? 'completed' : ''}">
                            <input type="checkbox" class="checkbox" ${item.completed ? 'checked' : ''}>
                            ${item.quantity > 1 ? `(${item.quantity}) ` : ''}${item.name}
                            ${item.notes ? `- ${item.notes}` : ''}
                        </div>`;
                });
            });
        }
        
        return html;
    },

    /**
     * Download blob as file
     */
    download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = DOM.create('a', {
            href: url,
            download: filename,
            style: 'display: none'
        });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Import JSON data
     */
    async importJSON(file) {
        const text = await FileUtils.readAsText(file);
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error('Invalid JSON file');
        }
    }
};

// Date/Time Utilities
const DateUtils = {
    /**
     * Format date
     */
    format(date, format = 'YYYY-MM-DD HH:mm') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes);
    },

    /**
     * Get relative time
     */
    relative(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
            }
        }
        
        return 'just now';
    }
};

// Performance Utilities
const Performance = {
    /**
     * Debounce function
     */
    debounce(func, wait = CONFIG.ui.debounceDelay) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit = 100) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Measure execution time
     */
    async measure(name, func) {
        const start = performance.now();
        const result = await func();
        const end = performance.now();
        console.log(`${name} took ${(end - start).toFixed(2)}ms`);
        return result;
    }
};

// Validation Utilities
const Validate = {
    /**
     * Validate email
     */
    email(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    /**
     * Validate phone
     */
    phone(phone) {
        return /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
    },

    /**
     * Validate required fields
     */
    required(value) {
        return value !== null && value !== undefined && value !== '' && value.length > 0;
    }
};

// Global helper functions
function showToast(message, type = 'info', duration) {
    Toast.show(message, type, duration);
}

function debounce(func, wait) {
    return Performance.debounce(func, wait);
}

function formatFileSize(bytes) {
    return FileUtils.formatSize(bytes);
}

// Auto-save functionality
let autosaveTimer = null;

function enableAutosave(saveFunction) {
    if (autosaveTimer) clearInterval(autosaveTimer);
    autosaveTimer = setInterval(() => {
        saveFunction();
        showToast('Auto-saved', 'success', 1000);
    }, CONFIG.ui.autosaveInterval);
}

function disableAutosave() {
    if (autosaveTimer) {
        clearInterval(autosaveTimer);
        autosaveTimer = null;
    }
}

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DOM,
        FileUtils,
        Storage,
        Toast,
        DataExport,
        DateUtils,
        Performance,
        Validate
    };
}