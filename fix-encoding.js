#!/usr/bin/env node

/**
 * Fix UTF-8 Encoding Issues in Contract Studio
 * Run with: node fix-encoding.js ./app/auth/contract-studio/page.tsx
 * 
 * This script uses hex-encoded search patterns to avoid encoding issues.
 */

const fs = require('fs');

const filePath = process.argv[2];

if (!filePath) {
    console.error('Usage: node fix-encoding.js <path-to-file>');
    process.exit(1);
}

if (!fs.existsSync(filePath)) {
    console.error('File not found: ' + filePath);
    process.exit(1);
}

console.log('Reading file: ' + filePath);
let content = fs.readFileSync(filePath, 'utf8');

// Create backup
const backupPath = filePath + '.backup';
fs.writeFileSync(backupPath, content);
console.log('Backup created: ' + backupPath);

let totalReplacements = 0;

// Helper to convert hex string to actual characters
function fromHex(hexStr) {
    return Buffer.from(hexStr, 'hex').toString('utf8');
}

// Patterns as hex-encoded strings (corrupted) -> correct character
// This avoids any encoding issues with the script itself
const hexReplacements = [
    // Star: various corrupted forms -> ★
    ['c383c2a2c38bc593c3a2e2809a', '\u2605'],
    ['c3a2cb9ce280a6', '\u2605'],
    ['e29885', '\u2605'],

    // Checkmark -> ✓  
    ['c3a2c5939ce2809c', '\u2713'],
    ['e29c93', '\u2713'],

    // X mark -> ✗
    ['c3a2c5939ce2809b', '\u2717'],
    ['e29c97', '\u2717'],

    // Right arrow -> →
    ['c3a2e282ace284a2', '\u2192'],
    ['c3a2e280a0e280a2', '\u2192'],
    ['e28692', '\u2192'],

    // Left arrow -> ←
    ['c3a2e280a0c382', '\u2190'],
    ['e28690', '\u2190'],

    // Diamond -> ◆
    ['c3a2e280a2e280a0', '\u25c6'],
    ['e29786', '\u25c6'],

    // Hexagon -> ⬡
    ['c3a2c2acc2a1', '\u2b21'],

    // Warning -> ⚠
    ['c3a2c5a1c2a0', '\u26a0'],
    ['e29a a0', '\u26a0'],

    // Bullet -> •
    ['c3a2e282acc2a2', '\u2022'],

    // Speech bubble -> 💬
    ['c3b0c5b8e28099c2ac', '\ud83d\udcac'],
    ['c3b0c5b8e28098c2ac', '\ud83d\udcac'],

    // Lightbulb -> 💡
    ['c3b0c5b8e28099c2a1', '\ud83d\udca1'],
    ['c3b0c5b8e28098c2a1', '\ud83d\udca1'],

    // Rocket -> 🚀
    ['c3b0c5b8c5a1e282ac', '\ud83d\ude80'],

    // Party -> 🎉
    ['c3b0c5b8c5bde28099', '\ud83c\udf89'],

    // Lock -> 🔒
    ['c3b0c5b8e2809ae28099', '\ud83d\udd12'],

    // Pound -> £
    ['c383c2a3', '\u00a3'],
    ['c382c2a3', '\u00a3'],
    ['c2a3', '\u00a3'],

    // Euro -> €
    ['c3a2e282acc2ac', '\u20ac'],
    ['e282ac', '\u20ac'],

    // Hourglass -> ⏳
    ['c3a2c282c2b3', '\u23f3'],
    ['e28fb3', '\u23f3'],

    // Bidirectional arrow -> ↔️
    ['c3a2e280a1e2809e', '\u21c4'],
    ['e28694efb88f', '\u2194\ufe0f'],
];

// Try hex-based replacements
for (const [hexPattern, replacement] of hexReplacements) {
    try {
        const searchStr = fromHex(hexPattern);
        if (content.includes(searchStr)) {
            const count = content.split(searchStr).length - 1;
            console.log('  Found and replacing ' + count + ' occurrences -> ' + replacement);
            totalReplacements += count;
            content = content.split(searchStr).join(replacement);
        }
    } catch (e) {
        // Skip invalid hex patterns
    }
}

// Also try direct string matching for common patterns
const directReplacements = [
    ['Ã¢Ëœâ€¦', '\u2605'],
    ['â˜…', '\u2605'],
    ['Ã¢Å"â€œ', '\u2713'],
    ['Ã¢Å"â€¹', '\u2717'],
    ['Ã¢â€ â€™', '\u2192'],
    ['Ã¢â€ Â', '\u2190'],
    ['Ã¢â€"â€ ', '\u25c6'],
    ['â—†', '\u25c6'],
    ['Ã¢Â¬Â¡', '\u2b21'],
    ['Ã¢Å¡Â ', '\u26a0'],
    ['Ã¢â‚¬Â¢', '\u2022'],
    ['Ã°Å¸â€™Â¬', '\ud83d\udcac'],
    ['Ã°Å¸â€™Â¡', '\ud83d\udca1'],
    ['Ã°Å¸Å¡â‚¬', '\ud83d\ude80'],
    ['Ã°Å¸Å½â€°', '\ud83c\udf89'],
    ['Ã°Å¸â€â€™', '\ud83d\udd12'],
    ['Ã‚Â£', '\u00a3'],
    ['Ã¢â€šÂ¬', '\u20ac'],
    ['Ã¢ÂÂ³', '\u23f3'],
    ['Ã¢â€¡â€ž', '\u21c4'],
];

for (const [search, replacement] of directReplacements) {
    if (content.includes(search)) {
        const count = content.split(search).length - 1;
        console.log('  Replacing "' + search.substring(0, 10) + '..." -> ' + replacement + ' (' + count + ' times)');
        totalReplacements += count;
        content = content.split(search).join(replacement);
    }
}

// Write the fixed content
fs.writeFileSync(filePath, content, 'utf8');

console.log('\nDone! Fixed ' + totalReplacements + ' corrupted characters.');
console.log('Backup saved to: ' + backupPath);

// Check for remaining issues
const remaining = content.match(/Ã[A-Za-z0-9âÂ]{2,10}|ð[A-Za-z0-9Ÿ]{2,10}/g);
if (remaining && remaining.length > 0) {
    const unique = [...new Set(remaining)];
    console.log('\nPotential remaining issues (' + unique.length + ' patterns):');
    unique.slice(0, 10).forEach(p => console.log('  "' + p + '"'));
}