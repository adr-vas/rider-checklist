/**
 * Intelligent Rider Parser with LLM and Regex Support
 */

class RiderParser {
    constructor() {
        this.llmEnabled = false;
        this.apiKey = localStorage.getItem('riderLLMKey') || '';
        this.provider = localStorage.getItem('riderLLMProvider') || 'openai';
        
        if (this.apiKey) {
            this.llmEnabled = true;
            CONFIG.llm.apiKey = this.apiKey;
            CONFIG.llm.provider = this.provider;
        }
    }

    /**
     * Main parsing function - routes to LLM or regex based on configuration
     */
    async parse(text) {
        // Clean and normalize text
        const cleanedText = this.normalizeText(text);
        
        // Try LLM parsing first if enabled
        if (this.llmEnabled && this.apiKey) {
            try {
                const llmResult = await this.parseWithLLM(cleanedText);
                if (llmResult && llmResult.items && llmResult.items.length > 0) {
                    return this.standardizeOutput(llmResult);
                }
            } catch (error) {
                console.warn('LLM parsing failed, falling back to regex:', error);
                showToast('Using offline parsing due to API error', 'warning');
            }
        }
        
        // Fall back to regex parsing
        return this.parseWithRegex(cleanedText);
    }

    /**
     * Parse using LLM API
     */
    async parseWithLLM(text) {
        const provider = CONFIG.llm.provider;
        
        if (provider === 'openai') {
            return await this.parseWithOpenAI(text);
        } else if (provider === 'anthropic') {
            return await this.parseWithAnthropic(text);
        } else {
            throw new Error(`Unknown LLM provider: ${provider}`);
        }
    }

    /**
     * OpenAI GPT parsing
     */
    async parseWithOpenAI(text) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.llm.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: CONFIG.llm.model || 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: CONFIG.llm.systemPrompt
                    },
                    {
                        role: 'user',
                        content: `Parse this tour rider document and extract all information according to the JSON structure specified:\n\n${text}`
                    }
                ],
                temperature: CONFIG.llm.temperature || 0.3,
                max_tokens: CONFIG.llm.maxTokens || 4096,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
    }

    /**
     * Anthropic Claude parsing
     */
    async parseWithAnthropic(text) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': CONFIG.llm.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 4096,
                messages: [
                    {
                        role: 'user',
                        content: `${CONFIG.llm.systemPrompt}\n\nParse this tour rider:\n\n${text}`
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        return JSON.parse(data.content[0].text);
    }

    /**
     * Regex-based parsing fallback
     */
    parseWithRegex(text) {
        const result = {
            artists: [],
            rooms: [],
            categories: {},
            items: [],
            allergies: [],
            contacts: [],
            specialRequirements: []
        };

        // Parse artists
        result.artists = this.parseArtists(text);
        
        // Parse rooms
        result.rooms = this.parseRooms(text);
        
        // Parse contacts
        result.contacts = this.parseContacts(text);
        
        // Parse allergies
        result.allergies = this.parseAllergies(text);
        
        // Parse special requirements
        result.specialRequirements = this.parseSpecialRequirements(text);
        
        // Parse items and categories
        const itemsAndCategories = this.parseItemsAndCategories(text, result.rooms);
        result.items = itemsAndCategories.items;
        result.categories = itemsAndCategories.categories;
        
        return result;
    }

    /**
     * Parse artist names
     */
    parseArtists(text) {
        const artists = new Set();
        
        PATTERNS.artist.forEach(pattern => {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const artist = this.cleanName(match[1]);
                if (artist && artist.length >= CONFIG.parsing.minArtistNameLength) {
                    artists.add(artist);
                }
            }
        });
        
        return Array.from(artists);
    }

    /**
     * Parse room assignments
     */
    parseRooms(text) {
        const rooms = [];
        const seen = new Set();
        
        PATTERNS.room.forEach(pattern => {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const id = match[1];
                if (id && !seen.has(id)) {
                    seen.add(id);
                    rooms.push({
                        id: id,
                        name: `Room ${id}`,
                        description: match[2] ? this.cleanName(match[2]) : '',
                        items: []
                    });
                }
            }
        });
        
        return rooms;
    }

    /**
     * Parse contact information
     */
    parseContacts(text) {
        const contacts = [];
        
        // Extract names with roles
        const nameMatches = text.matchAll(PATTERNS.contact.name);
        for (const match of nameMatches) {
            const contact = {
                name: this.cleanName(match[1]),
                role: match[0].includes('Manager') ? 'Tour Manager' : 'Contact'
            };
            
            // Find associated email and phone
            const nearbyText = text.substring(
                Math.max(0, match.index - 100),
                Math.min(text.length, match.index + 200)
            );
            
            const emailMatch = nearbyText.match(PATTERNS.contact.email);
            if (emailMatch) contact.email = emailMatch[1];
            
            const phoneMatch = nearbyText.match(PATTERNS.contact.phone);
            if (phoneMatch) contact.phone = this.cleanPhone(phoneMatch[0]);
            
            if (contact.name) contacts.push(contact);
        }
        
        return contacts;
    }

    /**
     * Parse allergies and restrictions
     */
    parseAllergies(text) {
        const allergies = new Set();
        
        PATTERNS.allergy.forEach(pattern => {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                const allergy = this.cleanAllergy(match[1]);
                if (allergy && allergy.length < 100) {
                    // Check for common allergens
                    COMMON_ALLERGENS.forEach(common => {
                        if (allergy.toLowerCase().includes(common)) {
                            allergies.add(common);
                        }
                    });
                    
                    // Add the full allergy text if it's specific
                    if (allergy.length < 50) {
                        allergies.add(allergy);
                    }
                }
            }
        });
        
        return Array.from(allergies);
    }

    /**
     * Parse special requirements
     */
    parseSpecialRequirements(text) {
        const requirements = [];
        
        // Temperature requirements
        const tempMatches = text.matchAll(PATTERNS.special.temperature);
        for (const match of tempMatches) {
            requirements.push(`Temperature: ${match[1]}°${match[2]}`);
        }
        
        // Timing requirements
        const timeMatches = text.matchAll(PATTERNS.special.timing);
        for (const match of timeMatches) {
            requirements.push(`Timing: ${match[0]}`);
        }
        
        // Must-have items
        const mustHaveMatches = text.matchAll(PATTERNS.special.mustHave);
        for (const match of mustHaveMatches) {
            const context = text.substring(match.index, match.index + 100);
            const itemMatch = context.match(/([A-Za-z\s]+)/);
            if (itemMatch) {
                requirements.push(`Must Have: ${itemMatch[1].trim()}`);
            }
        }
        
        return requirements;
    }

    /**
     * Parse items and categories
     */
    parseItemsAndCategories(text, rooms) {
        const items = [];
        const categories = {};
        const lines = text.split('\n');
        
        let currentCategory = 'General';
        let currentRoom = null;
        
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            
            // Check for category headers
            const categoryMatch = this.detectCategory(trimmed);
            if (categoryMatch) {
                currentCategory = categoryMatch;
                if (!categories[currentCategory]) {
                    categories[currentCategory] = [];
                }
                return;
            }
            
            // Check for room context
            const roomMatch = this.detectRoomContext(trimmed);
            if (roomMatch) {
                currentRoom = roomMatch;
            }
            
            // Parse as item
            const item = this.parseItem(trimmed, currentCategory, currentRoom);
            if (item) {
                items.push(item);
                
                if (!categories[currentCategory]) {
                    categories[currentCategory] = [];
                }
                categories[currentCategory].push(item);
                
                // Add to room if specified
                if (currentRoom) {
                    const room = rooms.find(r => r.id === currentRoom);
                    if (room) {
                        room.items.push(item);
                    }
                }
            }
        });
        
        return { items, categories };
    }

    /**
     * Parse individual item
     */
    parseItem(line, category, room) {
        const match = line.match(PATTERNS.item);
        if (!match || !match[3]) return null;
        
        const itemName = this.cleanItemName(match[3]);
        if (!itemName || itemName.length < CONFIG.parsing.minItemLength) return null;
        
        return {
            name: itemName,
            quantity: this.parseQuantity(match[1] || match[2]),
            unit: this.detectUnit(itemName),
            brand: this.detectBrand(itemName),
            room: room,
            category: category,
            notes: match[4] || '',
            mustHave: PATTERNS.special.mustHave.test(line)
        };
    }

    /**
     * Detect category from line
     */
    detectCategory(line) {
        // Check against category patterns
        for (const pattern of PATTERNS.category) {
            if (pattern.test(line)) {
                return this.standardizeCategoryName(line);
            }
        }
        
        // Check against category keywords
        for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
            for (const keyword of keywords) {
                if (line.toLowerCase().includes(keyword)) {
                    return this.capitalizeFirst(category);
                }
            }
        }
        
        // Check if it looks like a header (all caps, short)
        if (/^[A-Z\s&]+$/.test(line) && line.length < CONFIG.parsing.maxCategoryLength) {
            return this.standardizeCategoryName(line);
        }
        
        return null;
    }

    /**
     * Detect room context
     */
    detectRoomContext(line) {
        for (const pattern of PATTERNS.room) {
            const match = line.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    /**
     * Parse quantity from string
     */
    parseQuantity(str) {
        if (!str) return 1;
        
        // Check numeric
        const num = parseInt(str);
        if (!isNaN(num)) return num;
        
        // Check written numbers
        const lower = str.toLowerCase();
        return QUANTITY_MAP[lower] || 1;
    }

    /**
     * Detect unit from item name
     */
    detectUnit(name) {
        const units = {
            'bottle': /bottles?/i,
            'can': /cans?/i,
            'case': /cases?/i,
            'pack': /packs?/i,
            'box': /box(es)?/i,
            'bag': /bags?/i,
            'dozen': /dozens?/i,
            'pound': /pounds?|lbs?/i,
            'gallon': /gallons?/i,
            'liter': /liters?|litres?/i
        };
        
        for (const [unit, pattern] of Object.entries(units)) {
            if (pattern.test(name)) return unit;
        }
        
        return 'item';
    }

    /**
     * Detect brand from item name
     */
    detectBrand(name) {
        const brands = [
            'Coca-Cola', 'Coke', 'Pepsi', 'Sprite', 'Dr Pepper',
            'Fiji', 'Evian', 'SmartWater', 'Dasani',
            'Red Bull', 'Monster', 'Rockstar',
            'Hennessy', 'Grey Goose', 'Patron', 'Don Julio', 'Casamigos',
            'Dove', 'Gillette', 'Colgate', 'Crest'
        ];
        
        for (const brand of brands) {
            if (name.includes(brand)) return brand;
        }
        
        return null;
    }

    /**
     * Utility functions
     */
    normalizeText(text) {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\n{3,}/g, '\n\n');
    }

    cleanName(str) {
        if (!str) return '';
        return str.trim().replace(/\s+/g, ' ');
    }

    cleanPhone(str) {
        return str.replace(/[^\d+\-().\s]/g, '').trim();
    }

    cleanAllergy(str) {
        return str.trim().replace(/[^\w\s,]/g, '').replace(/\s+/g, ' ');
    }

    cleanItemName(str) {
        return str
            .replace(/^[\-•*\s]+/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    standardizeCategoryName(str) {
        const map = {
            'BEVERAGES': 'Beverages',
            'DRINKS': 'Beverages',
            'FOOD': 'Food',
            'CATERING': 'Food',
            'EQUIPMENT': 'Equipment',
            'TECH': 'Equipment',
            'FURNITURE': 'Furniture',
            'TOILETRIES': 'Personal Care',
            'PERSONAL CARE': 'Personal Care',
            'HOSPITALITY': 'Hospitality'
        };
        
        const upper = str.toUpperCase().trim();
        return map[upper] || this.capitalizeFirst(str.toLowerCase());
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Standardize output format
     */
    standardizeOutput(data) {
        // Ensure all required fields exist
        return {
            artists: data.artists || [],
            rooms: data.rooms || [],
            categories: data.categories || {},
            items: data.items || [],
            allergies: data.allergies || [],
            contacts: data.contacts || [],
            specialRequirements: data.specialRequirements || []
        };
    }
}

// Initialize parser
const riderParser = new RiderParser();