#!/usr/bin/env node

/**
 * Fix UTF-8 Encoding Issues in Contract Studio
 * Run with: node fix-encoding.js ./app/auth/contract-studio/page.tsx
 */

const fs = require('fs');
const path = require('path');

// Get file path from command line argument
const filePath = process.argv[2];

if (!filePath) {
    console.error('Usage: node fix-encoding.js <path-to-file>');
    console.error('Example: node fix-encoding.js ./app/auth/contract-studio/page.tsx');
    process.exit(1);
}

// Check if file exists
if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

// All the corrupted character mappings
const replacements = [
    // Stars and checkmarks
    ['Ã¢Ëœâ€¦', '★'],
    ['â˜…', '★'],
    ['Ã¢Å"â€œ', '✓'],
    ['âœ"', '✓'],
    ['Ã¢Å"â€¹', '✗'],
    ['âœ—', '✗'],

    // Arrows
    ['Ã¢â€ â€™', '→'],
    ['â†'', '→'],
    ['Ã¢â€ Â', '←'],
        ['â†', '←'],
        ['Ã¢â€¡â€ž', '⇄'],
        ['â†"ï¸', '↔️'],
        ['Ã¢â€ â€Ã¯Â¸Â', '↔️'],

        // Shapes
        ['Ã¢â€"â€ ', '◆'],
        ['â—†', '◆'],
        ['Ã¢Â¬Â¡', '⬡'],
        ['Ã¢Å¡Â ', '⚠'],
        ['â š', '⚠'],
        ['Ã¢â‚¬Â¢', '•'],

        // Emojis
        ['Ã°Å¸â€™Â¬', '💬'],
        ['ðŸ'¬', '💬'],
        ['Ã°Å¸â€™Â¡', '💡'],
            ['ðŸ'¡', '💡'],
            ['Ã°Å¸Å¡â‚¬', '🚀'],
                ['ðŸš€', '🚀'],
                ['Ã°Å¸Å½â€°', '🎉'],
                ['ðŸŽ‰', '🎉'],
                ['Ã°Å¸â€â€™', '🔒'],
                ['ðŸ"'', '🔒'],

                // Currency
                ['Ã‚Â£', '£'],
                    ['Â£', '£'],
                    ['Ã¢â€šÂ¬', '€'],
                    ['â‚¬', '€'],

                    // Hourglass
                    ['Ã¢ÂÂ³', '⏳'],
                    ['â³', '⏳'],

                    // Additional common corruptions
                    ['Ã¢â‚¬â„¢', "'"],
                    ['Ã¢â‚¬Å"', '"'],
                    ['Ã¢â‚¬', '"'],
                    ['Ã¢â‚¬"', '–'],
                    ['Ã¢â‚¬¦', '…'],
                ];

// Read the file
console.log(`Reading file: ${filePath}`);
let content = fs.readFileSync(filePath, 'utf8');

// Create backup
const backupPath = filePath + '.backup-' + Date.now();
fs.writeFileSync(backupPath, content);
console.log(`Backup created: ${backupPath}`);

// Apply all replacements
let totalReplacements = 0;
for (const [corrupted, correct] of replacements) {
    const regex = new RegExp(corrupted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
        console.log(`  Replacing "${corrupted}" with "${correct}" (${matches.length} occurrences)`);
        totalReplacements += matches.length;
        content = content.replace(regex, correct);
    }
}

// Write the fixed content
fs.writeFileSync(filePath, content, 'utf8');

console.log(`\n✅ Done! Fixed ${totalReplacements} corrupted characters.`);
console.log(`Backup saved to: ${backupPath}`);

// Verify - check for any remaining corrupted patterns
const remainingIssues = content.match(/Ã[^\s]{1,15}|ð[^\s]{1,10}|â[^\s]{1,10}/g);
if (remainingIssues) {
    const unique = [...new Set(remainingIssues)];
    console.log(`\n⚠️  Potential remaining issues found (${unique.length} unique patterns):`);
    unique.slice(0, 20).forEach(issue => console.log(`  - "${issue}"`));
    if (unique.length > 20) {
        console.log(`  ... and ${unique.length - 20} more`);
    }
} else {
    console.log('\n✅ No obvious encoding issues remaining.');
}