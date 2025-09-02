#!/usr/bin/env node

/**
 * CDN Availability Checker
 * This script checks various CDN endpoints to find the most reliable ones
 */

const https = require('https');
const http = require('http');

// CDN endpoints to test
const CDN_ENDPOINTS = {
    'PDF.js': [
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
        'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js',
        'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.min.js'
    ],
    'Tesseract.js': [
        'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.5/tesseract.min.js',
        'https://unpkg.com/tesseract.js@5.0.5/dist/tesseract.min.js',
        'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js'
    ]
};

// Test a single URL
function testURL(url) {
    return new Promise((resolve) => {
        const protocol = url.startsWith('https:') ? https : http;
        const startTime = Date.now();
        
        const req = protocol.get(url, { timeout: 10000 }, (res) => {
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            resolve({
                url,
                status: res.statusCode,
                statusText: res.statusMessage,
                responseTime,
                headers: res.headers,
                success: res.statusCode >= 200 && res.statusCode < 400
            });
        });
        
        req.on('error', (error) => {
            resolve({
                url,
                error: error.message,
                success: false
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve({
                url,
                error: 'Timeout',
                success: false
            });
        });
    });
}

// Test all CDNs
async function testAllCDNs() {
    console.log('🔍 Testing CDN Availability...\n');
    
    const results = {};
    
    for (const [library, urls] of Object.entries(CDN_ENDPOINTS)) {
        console.log(`📄 Testing ${library}:`);
        results[library] = [];
        
        for (const url of urls) {
            process.stdout.write(`  Testing ${url}... `);
            const result = await testURL(url);
            results[library].push(result);
            
            if (result.success) {
                console.log(`✅ ${result.status} (${result.responseTime}ms)`);
            } else {
                console.log(`❌ ${result.error || result.status}`);
            }
        }
        console.log('');
    }
    
    return results;
}

// Generate recommendations
function generateRecommendations(results) {
    console.log('🎯 CDN Recommendations:\n');
    
    for (const [library, urls] of Object.entries(results)) {
        const working = urls.filter(r => r.success);
        const failed = urls.filter(r => !r.success);
        
        console.log(`${library}:`);
        
        if (working.length > 0) {
            // Sort by response time (fastest first)
            const sorted = working.sort((a, b) => a.responseTime - b.responseTime);
            
            console.log(`  ✅ Working (${working.length}/${urls.length}):`);
            sorted.forEach((result, index) => {
                const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
                console.log(`    ${rank} ${result.url} (${result.responseTime}ms)`);
            });
        }
        
        if (failed.length > 0) {
            console.log(`  ❌ Failed (${failed.length}/${urls.length}):`);
            failed.forEach(result => {
                console.log(`      ${result.url} - ${result.error || result.status}`);
            });
        }
        
        console.log('');
    }
}

// Check specific version availability
async function checkVersionAvailability() {
    console.log('🔍 Checking Latest Version Availability...\n');
    
    const versions = [
        '3.11.174', '3.11.175', '3.11.176',
        '4.0.379', '4.0.380', '4.0.381',
        '4.1.0', '4.2.0', '4.3.0'
    ];
    
    const baseUrls = [
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/',
        'https://unpkg.com/pdfjs-dist@',
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@'
    ];
    
    const availableVersions = {};
    
    for (const baseUrl of baseUrls) {
        const cdnName = baseUrl.includes('cdnjs') ? 'CDNJS' : 
                       baseUrl.includes('unpkg') ? 'UNPKG' : 'JSDelivr';
        
        availableVersions[cdnName] = [];
        
        for (const version of versions) {
            const url = baseUrl + version + '/build/pdf.min.js';
            const result = await testURL(url);
            
            if (result.success) {
                availableVersions[cdnName].push(version);
            }
        }
    }
    
    console.log('📊 Available Versions by CDN:');
    for (const [cdn, versions] of Object.entries(availableVersions)) {
        console.log(`  ${cdn}: ${versions.length > 0 ? versions.join(', ') : 'None'}`);
    }
    console.log('');
}

// Main execution
async function main() {
    try {
        const results = await testAllCDNs();
        generateRecommendations(results);
        
        if (process.argv.includes('--check-versions')) {
            await checkVersionAvailability();
        }
        
        // Exit with error code if no CDNs are working
        const totalWorking = Object.values(results).flat().filter(r => r.success).length;
        if (totalWorking === 0) {
            console.error('❌ No CDNs are working! This is a critical issue.');
            process.exit(1);
        } else {
            console.log(`✅ Found ${totalWorking} working CDN endpoints.`);
        }
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { testURL, testAllCDNs, generateRecommendations };
