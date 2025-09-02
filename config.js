/**
 * Configuration and Constants for Rider Checklist Builder
 */

const CONFIG = {
    // PDF.js Configuration
    pdf: {
        workerSrc: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.js',
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/standard_fonts/'
    },

    // Tesseract.js Configuration
    ocr: {
        lang: 'eng',
        logger: null, // Will be set dynamically for progress tracking
        errorHandler: null
    },

    // File Upload Configuration
    upload: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        acceptedFormats: [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/bmp',
            'image/tiff',
            'image/webp'
        ],
        maxFiles: 10
    },

    // Text Parsing Configuration
    parsing: {
        minArtistNameLength: 3,
        maxArtistNameLength: 50,
        minCategoryLength: 3,
        maxCategoryLength: 40,
        minItemLength: 3,
        maxItemLength: 200,
        confidenceThreshold: 0.7
    },

    // Local Storage Keys
    storage: {
        lastRider: 'riderChecklist_lastRider',
        preferences: 'riderChecklist_preferences',
        history: 'riderChecklist_history',
        checklistState: 'riderChecklist_state'
    },

    // UI Configuration
    ui: {
        toastDuration: 3000,
        animationDuration: 300,
        debounceDelay: 500,
        autosaveInterval: 30000 // 30 seconds
    },

    // LLM Configuration
    llm: {
        enabled: false, // Set to true when API key is provided
        provider: 'openai', // 'openai', 'anthropic', or 'local'
        apiKey: '', // Will be set from UI or environment
        model: 'gpt-4o-mini', // or 'claude-3-haiku-20240307'
        temperature: 0.3,
        maxTokens: 4096,
        systemPrompt: `You are a tour rider parser. Extract and structure information from tour riders.
Return JSON with this exact structure:
{
  "artists": ["artist names"],
  "rooms": [{
    "id": "1",
    "name": "Dressing Room 1",
    "description": "Artist room",
    "items": []
  }],
  "categories": {
    "Beverages": [],
    "Food": [],
    "Equipment": []
  },
  "items": [{
    "name": "item name",
    "quantity": 1,
    "unit": "bottles",
    "brand": "specific brand if mentioned",
    "room": "1",
    "category": "Beverages",
    "notes": "special requirements",
    "mustHave": false
  }],
  "allergies": ["list of allergies"],
  "contacts": [{
    "name": "name",
    "role": "Tour Manager",
    "email": "email",
    "phone": "phone"
  }],
  "specialRequirements": ["temperature requirements", "timing requirements"]
}`
    }
};

// Regular Expression Patterns for Parsing
const PATTERNS = {
    // Artist/Performer Detection
    artist: [
        /(?:artist|performer|talent|act)[\s:]+([A-Z][A-Za-z\s&'\-\.]+?)(?:\n|tour|rider|dressing|management)/gi,
        /([A-Z][A-Za-z\s&'\-\.]+?)(?:'s)?\s+(?:tour\s+)?rider/gi,
        /(?:for|featuring|presents?)[\s:]+([A-Z][A-Za-z\s&'\-\.]+?)(?:\n|tour|rider)/gi,
        /dressing\s+room\s+\d+\s*[-–:]\s*([A-Z][A-Za-z\s&'\-\.]+)/gi
    ],

    // Room Detection
    room: [
        /(?:dressing\s+room|room|dr|d\.r\.|area)\s*#?\s*(\d+|[A-Z])\s*[-–:)]?\s*([^\n]+)?/gi,
        /(?:green\s+room|backstage|production\s+office|hospitality)\s*#?\s*(\d+|[A-Z])?/gi,
        /(?:artist|talent|performer)\s+(?:room|area)\s*#?\s*(\d+|[A-Z])?/gi
    ],

    // Contact Information
    contact: {
        name: /(?:contact|manager|coordinator|director)[\s:]+([A-Z][A-Za-z\s]+?)(?:\n|phone|cell|email|@)/gi,
        email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
        phone: /(?:\+?1?\s*)?(?:\(?\d{3}\)?[\s.\-]?)?\d{3}[\s.\-]?\d{4}/g
    },

    // Allergies and Restrictions
    allergy: [
        /(?:allerg(?:y|ic|ies)|cannot\s+have|no|avoid|restriction)[\s:]*(?:to|for)?\s*([^\n\.]+)/gi,
        /(?:do\s+not\s+(?:provide|include|serve))[\s:]*([^\n\.]+)/gi,
        /\*+\s*([^\n]+?)\s+(?:allergy|allergic|restriction)/gi
    ],

    // Quantities
    quantity: {
        numeric: /^(\d+)\s+/,
        written: /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|half.?dozen)\s+/i,
        parenthetical: /\((\d+)\)/,
        multiplier: /(\d+)\s*x\s*(\d+)/i
    },

    // Categories
    category: [
        /^(beverages?|drinks?|alcohol|liquor|bar|spirits)/i,
        /^(food|catering|meals?|snacks?|fruit|vegetables?)/i,
        /^(equipment|technical|production|av|audio|video|lighting)/i,
        /^(furniture|furnishings?|decor|amenities)/i,
        /^(toiletries|personal\s+care|hygiene|bathroom)/i,
        /^(flowers?|arrangements?|decorations?)/i,
        /^(hospitality|service|staff|crew)/i,
        /^(security|access|credentials|passes)/i,
        /^(transportation|parking|vehicles?)/i,
        /^(wardrobe|clothing|laundry|costumes?)/i
    ],

    // Special Requirements
    special: {
        mustHave: /(?:must\s+have|essential|required|mandatory|critical)/i,
        brand: /(?:brand|specific|only|no\s+substitutions?)/i,
        temperature: /(\d+)\s*°?\s*([CF])/i,
        timing: /(?:by|before|after|at)\s+(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:hours?|hrs?|minutes?|mins?))/i
    },

    // Items and Products
    item: /^[\s\-•*]*(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten|dozen)\s+)?(?:\((\d+)\)\s+)?([^\n]+?)(?:\s*[-–]\s*([^\n]+))?$/i
};

// Category Keywords for Better Detection
const CATEGORY_KEYWORDS = {
    beverages: ['water', 'soda', 'juice', 'tea', 'coffee', 'beer', 'wine', 'vodka', 'whiskey', 'tequila', 'rum', 'champagne', 'drinks', 'bottle', 'can', 'beverage'],
    food: ['sandwich', 'salad', 'fruit', 'vegetable', 'snack', 'meal', 'dinner', 'lunch', 'breakfast', 'pizza', 'chips', 'candy', 'chocolate', 'nuts', 'cheese', 'meat', 'chicken', 'beef', 'fish'],
    equipment: ['microphone', 'speaker', 'cable', 'stand', 'light', 'projector', 'screen', 'computer', 'laptop', 'printer', 'phone', 'charger', 'adapter', 'extension'],
    furniture: ['chair', 'table', 'sofa', 'couch', 'desk', 'lamp', 'mirror', 'rug', 'carpet', 'stool', 'bench', 'rack', 'shelf', 'cabinet'],
    toiletries: ['soap', 'shampoo', 'towel', 'tissue', 'toilet', 'toothbrush', 'toothpaste', 'deodorant', 'lotion', 'cream', 'razor', 'cotton', 'wipes'],
    wardrobe: ['iron', 'steamer', 'hanger', 'rack', 'laundry', 'dry cleaning', 'pressing', 'garment', 'costume', 'outfit', 'clothing'],
    hospitality: ['tea', 'coffee', 'sugar', 'cream', 'milk', 'honey', 'lemon', 'ice', 'napkin', 'plate', 'cup', 'glass', 'utensil', 'service']
};

// Quantity Mappings
const QUANTITY_MAP = {
    'one': 1,
    'two': 2,
    'three': 3,
    'four': 4,
    'five': 5,
    'six': 6,
    'seven': 7,
    'eight': 8,
    'nine': 9,
    'ten': 10,
    'eleven': 11,
    'twelve': 12,
    'dozen': 12,
    'half dozen': 6,
    'half-dozen': 6,
    'case': 24,
    'pair': 2,
    'couple': 2,
    'few': 3,
    'several': 4,
    'many': 6
};

// Room Type Mappings
const ROOM_TYPES = {
    'dressing room': 'Dressing Room',
    'green room': 'Green Room',
    'production office': 'Production Office',
    'hospitality': 'Hospitality Suite',
    'backstage': 'Backstage Area',
    'stage': 'Stage',
    'loading dock': 'Loading Dock',
    'catering': 'Catering Area',
    'crew room': 'Crew Room',
    'wardrobe': 'Wardrobe Room',
    'makeup': 'Makeup Room',
    'vip': 'VIP Area'
};

// Common Allergens to Highlight
const COMMON_ALLERGENS = [
    'nuts', 'peanuts', 'tree nuts', 'almonds', 'cashews', 'walnuts', 'pecans',
    'dairy', 'milk', 'cheese', 'lactose', 'butter', 'cream',
    'gluten', 'wheat', 'bread', 'flour',
    'shellfish', 'shrimp', 'lobster', 'crab', 'oysters',
    'eggs', 'egg',
    'soy', 'soybean',
    'fish', 'salmon', 'tuna', 'cod',
    'sesame', 'sesame seeds',
    'sulfites', 'preservatives'
];

// Export configuration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        PATTERNS,
        CATEGORY_KEYWORDS,
        QUANTITY_MAP,
        ROOM_TYPES,
        COMMON_ALLERGENS
    };
}