/**
 * OCR and Text Extraction Module
 */

class OCRProcessor {
    constructor() {
        this.isInitialized = false;
        this.worker = null;
        this.currentProgress = 0;
        this.progressCallback = null;
        
        // Initialize PDF.js
        this.initPDFJS();
    }

    /**
     * Initialize PDF.js configuration
     */
    initPDFJS() {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.pdf.workerSrc;
            this.isInitialized = true;
        } else {
            console.error('PDF.js library not loaded');
        }
    }

    /**
     * Initialize Tesseract worker
     */
    async initTesseract() {
        if (!this.worker) {
            this.worker = await Tesseract.createWorker({
                logger: m => {
                    if (this.progressCallback && m.status === 'recognizing text') {
                        this.progressCallback({
                            type: 'ocr',
                            progress: m.progress,
                            message: `OCR: ${Math.round(m.progress * 100)}%`
                        });
                    }
                }
            });
            
            await this.worker.loadLanguage('eng');
            await this.worker.initialize('eng');
        }
        return this.worker;
    }

    /**
     * Process multiple files
     */
    async processFiles(files, progressCallback) {
        this.progressCallback = progressCallback;
        const results = [];
        let totalText = '';
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (progressCallback) {
                progressCallback({
                    type: 'file',
                    current: i + 1,
                    total: files.length,
                    filename: file.name,
                    message: `Processing ${file.name} (${i + 1}/${files.length})`
                });
            }
            
            try {
                let text = '';
                
                if (file.type === 'application/pdf') {
                    text = await this.extractPDFText(file);
                } else if (file.type.startsWith('image/')) {
                    text = await this.extractImageText(file);
                } else {
                    console.warn(`Unsupported file type: ${file.type}`);
                    continue;
                }
                
                results.push({
                    filename: file.name,
                    type: file.type,
                    size: file.size,
                    text: text,
                    success: true
                });
                
                totalText += `\n\n--- ${file.name} ---\n\n${text}`;
                
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                results.push({
                    filename: file.name,
                    type: file.type,
                    size: file.size,
                    text: '',
                    success: false,
                    error: error.message
                });
                
                if (progressCallback) {
                    progressCallback({
                        type: 'error',
                        filename: file.name,
                        message: `Error processing ${file.name}: ${error.message}`
                    });
                }
            }
        }
        
        // Clean up Tesseract worker if initialized
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
        
        return {
            results: results,
            totalText: totalText.trim(),
            successCount: results.filter(r => r.success).length,
            failCount: results.filter(r => !r.success).length
        };
    }

    /**
     * Extract text from PDF
     */
    async extractPDFText(file) {
        if (!this.isInitialized) {
            throw new Error('PDF.js not initialized');
        }
        
        const arrayBuffer = await this.fileToArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: CONFIG.pdf.cMapUrl,
            cMapPacked: CONFIG.pdf.cMapPacked
        }).promise;
        
        let fullText = '';
        const numPages = pdf.numPages;
        
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            if (this.progressCallback) {
                this.progressCallback({
                    type: 'pdf',
                    current: pageNum,
                    total: numPages,
                    progress: pageNum / numPages,
                    message: `Extracting page ${pageNum} of ${numPages}`
                });
            }
            
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // Process text items and maintain layout
            const pageText = this.processTextContent(textContent);
            fullText += pageText + '\n\n';
        }
        
        return this.cleanExtractedText(fullText);
    }

    /**
     * Process PDF text content to maintain structure
     */
    processTextContent(textContent) {
        if (!textContent.items || textContent.items.length === 0) {
            return '';
        }
        
        const items = textContent.items;
        let text = '';
        let lastY = null;
        let line = '';
        
        // Group items by vertical position (Y coordinate)
        items.forEach((item, index) => {
            // Skip empty strings
            if (!item.str || !item.str.trim()) return;
            
            // Check if we're on a new line
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                // Add the completed line
                text += line.trim() + '\n';
                line = '';
            }
            
            // Add item to current line
            line += item.str;
            
            // Add space if not at end and next item is on same line
            if (index < items.length - 1) {
                const nextItem = items[index + 1];
                if (nextItem && Math.abs(nextItem.transform[5] - item.transform[5]) < 5) {
                    // Check if space is needed between items
                    if (!item.str.endsWith(' ') && !nextItem.str.startsWith(' ')) {
                        line += ' ';
                    }
                }
            }
            
            lastY = item.transform[5];
        });
        
        // Add the last line
        if (line.trim()) {
            text += line.trim();
        }
        
        return text;
    }

    /**
     * Extract text from image using OCR
     */
    async extractImageText(file) {
        // Initialize Tesseract worker if needed
        await this.initTesseract();
        
        // Convert file to data URL for Tesseract
        const dataUrl = await this.fileToDataURL(file);
        
        // Perform OCR
        const { data: { text } } = await this.worker.recognize(dataUrl);
        
        return this.cleanExtractedText(text);
    }

    /**
     * Clean and normalize extracted text
     */
    cleanExtractedText(text) {
        return text
            // Remove excessive whitespace
            .replace(/\s+/g, ' ')
            // Preserve line breaks but normalize them
            .replace(/\n\s*\n\s*\n+/g, '\n\n')
            // Remove leading/trailing whitespace from lines
            .split('\n')
            .map(line => line.trim())
            .join('\n')
            // Remove page numbers and headers/footers (common patterns)
            .replace(/^Page \d+.*$/gm, '')
            .replace(/^\d+\s*$/gm, '')
            // Fix common OCR errors
            .replace(/[Il1]\s*\)/g, '1)')
            .replace(/[oO0]\s*\)/g, '0)')
            .replace(/\bl\s+'/g, "I'")
            .trim();
    }

    /**
     * Convert file to ArrayBuffer
     */
    fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Convert file to Data URL
     */
    fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Preprocess image for better OCR (optional enhancement)
     */
    async preprocessImage(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Set canvas size
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw image
                ctx.drawImage(img, 0, 0);
                
                // Get image data
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // Convert to grayscale and increase contrast
                for (let i = 0; i < data.length; i += 4) {
                    // Convert to grayscale
                    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                    
                    // Increase contrast
                    const contrast = 1.5;
                    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                    const newValue = factor * (gray - 128) + 128;
                    
                    // Apply threshold for better text recognition
                    const threshold = newValue > 180 ? 255 : (newValue < 75 ? 0 : newValue);
                    
                    data[i] = threshold;
                    data[i + 1] = threshold;
                    data[i + 2] = threshold;
                }
                
                // Put processed image data back
                ctx.putImageData(imageData, 0, 0);
                
                // Return processed image as data URL
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = dataUrl;
        });
    }

    /**
     * Detect text orientation and rotate if needed
     */
    async detectAndCorrectOrientation(dataUrl) {
        // This would use Tesseract's orientation detection
        // For now, returning the original image
        return dataUrl;
    }

    /**
     * Extract text from specific region of image
     */
    async extractRegion(file, x, y, width, height) {
        const dataUrl = await this.fileToDataURL(file);
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw specific region
                ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
                
                const regionDataUrl = canvas.toDataURL('image/png');
                
                // Perform OCR on region
                await this.initTesseract();
                const { data: { text } } = await this.worker.recognize(regionDataUrl);
                
                resolve(text);
            };
            img.src = dataUrl;
        });
    }

    /**
     * Batch process with parallel execution
     */
    async batchProcess(files, maxConcurrent = 3) {
        const results = [];
        const chunks = [];
        
        // Split files into chunks for parallel processing
        for (let i = 0; i < files.length; i += maxConcurrent) {
            chunks.push(files.slice(i, i + maxConcurrent));
        }
        
        // Process chunks
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(file => this.processFile(file));
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
        }
        
        return results;
    }

    /**
     * Process single file
     */
    async processFile(file) {
        try {
            let text = '';
            
            if (file.type === 'application/pdf') {
                text = await this.extractPDFText(file);
            } else if (file.type.startsWith('image/')) {
                text = await this.extractImageText(file);
            }
            
            return {
                filename: file.name,
                text: text,
                success: true
            };
        } catch (error) {
            return {
                filename: file.name,
                text: '',
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get supported file types
     */
    getSupportedTypes() {
        return CONFIG.upload.acceptedFormats;
    }

    /**
     * Check if file is supported
     */
    isSupported(file) {
        return this.getSupportedTypes().includes(file.type);
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}

// Create global instance
const ocrProcessor = new OCRProcessor();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OCRProcessor;
}