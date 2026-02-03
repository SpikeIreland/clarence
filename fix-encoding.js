#!/usr/bin/env node

/**
 * Fix UTF-8 Encoding Issues in CLARENCE Pages
 * 
 * Usage:
 *   node fix-encoding.js ./app/auth/invite-providers/page.tsx
 *   node fix-encoding.js ./app/auth/contract-prep/page.tsx
 * 
 * Or fix all at once:
 *   node fix-encoding.js ./app/auth/invite-providers/page.tsx ./app/auth/contract-prep/page.tsx ./app/auth/create-contract/page.tsx
 */

const fs = require('fs');

const filePaths = process.argv.slice(2);

if (filePaths.length === 0) {
    console.error('Usage: node fix-encoding.js <path-to-file> [<path-to-file2> ...]');
    process.exit(1);
}

function fromHex(hexStr) {
    return Buffer.from(hexStr, 'hex').toString('utf8');
}

// ALL patterns use hex encoding to avoid the script itself having encoding issues
// Format: [hex-encoded-search-pattern, replacement-string]
const patterns = [

    // ================================================================
    // SYMBOLS
    // ================================================================

    // Star variants -> ★
    ['c383c2a2c38bc593c3a2e2809a', '\u2605'],
    ['c3a2cb9ce280a6', '\u2605'],
    ['e29885', '\u2605'],
    ['c3a2cb9ce2809a', '\u2605'],

    // Checkmark -> ✓
    ['c3a2c5939ce2809c', '\u2713'],
    ['e29c93', '\u2713'],

    // X marks -> ✕
    ['c3a2c5939ce2809b', '\u2717'],
    ['e29c97', '\u2717'],
    ['c3a2c593e28094', '\u2715'],
    // "âœ•" (c3a2c593e280a2) -> ✕
    ['c3a2c59ce280a2', '\u2715'],

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
    ['e29aa0', '\u26a0'],

    // Bullet -> •
    ['c3a2e282acc2a2', '\u2022'],

    // Em dash -> —
    ['c3a2e282ace284a0', '\u2014'],
    ['e28094', '\u2014'],

    // En dash -> –
    ['c3a2e282ace2809c', '\u2013'],

    // Ellipsis -> …
    ['c3a2e282acc2a6', '\u2026'],

    // Left single quote -> '
    ['c3a2e282acc2b2', '\u2018'],

    // Right single quote -> '
    ['c3a2e282ace284a2', '\u2019'],

    // Hourglass -> ⏳
    ['c3a2c282c2b3', '\u23f3'],
    ['e28fb3', '\u23f3'],

    // Lightning -> ⚡
    ['e29aa1', '\u26a1'],

    // Gear -> ⚙
    ['e29a99', '\u2699'],

    // ================================================================
    // CURRENCY
    // ================================================================

    // Pound -> £  (try longer patterns first)
    ['c383c2a3', '\u00a3'],
    ['c382c2a3', '\u00a3'],

    // Euro -> €
    ['c3a2e282acc2ac', '\u20ac'],

    // ================================================================
    // EMOJIS (4-byte UTF-8 that get double-encoded)
    // ================================================================

    // 🔧 Wrench
    ['c3b0c5b8e2809ae280a1', '\uD83D\uDD27'],
    // 🔧 garbled display form: c3b0 c5b8 e2809a c2a7
    ['c3b0c5b8e2809ac2a7', '\uD83D\uDD27'],

    // 📋 Clipboard
    ['c3b0c5b8e2809cc2bb', '\uD83D\uDCCB'],

    // 📄 Document
    ['c3b0c5b8e2809cc2a4', '\uD83D\uDCC4'],

    // 💬 Speech bubble
    ['c3b0c5b8e28099c2ac', '\uD83D\uDCAC'],
    ['c3b0c5b8e28098c2ac', '\uD83D\uDCAC'],

    // 💡 Lightbulb
    ['c3b0c5b8e28099c2a1', '\uD83D\uDCA1'],
    ['c3b0c5b8e28098c2a1', '\uD83D\uDCA1'],

    // 🚀 Rocket
    ['c3b0c5b8c5a1e282ac', '\uD83D\uDE80'],

    // 🎉 Party
    ['c3b0c5b8c5bde28099', '\uD83C\uDF89'],

    // 🔒 Lock
    ['c3b0c5b8e2809ae28099', '\uD83D\uDD12'],

    // 🎓 Graduation cap
    ['c3b0c5b8c5bde28093', '\uD83C\uDF93'],

    // 🎯 Target
    ['c3b0c5b8c5bdc2af', '\uD83C\uDFAF'],

    // 🤖 Robot
    ['c3b0c5b8c2a4e2809e', '\uD83E\uDD16'],

    // 📤 Outbox
    ['c3b0c5b8e2809cc2a4', '\uD83D\uDCE4'],

    // 👥 People
    ['c3b0c5b8c2a5c2a5', '\uD83D\uDC65'],

    // 🎭 Theatre masks
    ['c3b0c5b8c5bdc2ad', '\uD83C\uDFAD'],

    // 📈 Chart up
    ['c3b0c5b8e2809cc2a8', '\uD83D\uDCC8'],

    // 📊 Bar chart
    ['c3b0c5b8e2809cc2aa', '\uD83D\uDCCA'],

    // 📅 Calendar
    ['c3b0c5b8e2809cc2a5', '\uD83D\uDCC5'],

    // 📝 Memo
    ['c3b0c5b8e2809cc2b3', '\uD83D\uDCDD'],

    // 🛡 Shield
    ['c3b0c5b8c5bee280a1', '\uD83D\uDEE1'],

    // 🔍 Search
    ['c3b0c5b8e2809ac2b1', '\uD83D\uDD0D'],

    // 🏆 Trophy
    ['c3b0c5b8c48fc2a6', '\uD83C\uDFC6'],

    // 📦 Package
    ['c3b0c5b8e2809cc2a6', '\uD83D\uDCE6'],

    // 📬 Mailbox
    ['c3b0c5b8e2809cc2ac', '\uD83D\uDCEC'],

    // 👋 Wave
    ['c3b0c5b8c2a5c28b', '\uD83D\uDC4B'],

    // 📑 Bookmark tabs
    ['c3b0c5b8e2809cc2b1', '\uD83D\uDCD1'],

    // 📹 Video camera
    ['c3b0c5b8e2809cc2b9', '\uD83D\uDCF9'],

    // 👀 Eyes
    ['c3b0c5b8c2a5c280', '\uD83D\uDC40'],

    // ================================================================
    // MOJIBAKE DIRECT PATTERNS (as hex to avoid parser issues)
    // ================================================================

    // "Ã¢â‚¬â€œ" -> – (en dash)
    ['c383c2a2c3a2e282acc5bee2809c', '\u2013'],

    // "Ã¢â‚¬â€"" -> — (em dash)
    ['c383c2a2c3a2e282acc5bee28094', '\u2014'],

    // "Ã¢â‚¬Ëœ" -> ' (left single quote)
    ['c383c2a2c3a2e282acc38bc593', '\u2018'],

    // "Ã¢â‚¬â„¢" -> ' (right single quote)
    ['c383c2a2c3a2e282acc3a2e284a2', '\u2019'],

    // "Ã¢â‚¬Å"" -> " (left double quote)
    ['c383c2a2c3a2e282acc385c593', '\u201c'],

    // "Ã¢â‚¬Â¦" -> … (ellipsis)
    ['c383c2a2c3a2e282acc382c2a6', '\u2026'],
];

// ================================================================
// PROCESS FILES
// ================================================================

for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) {
        console.error('File not found: ' + filePath);
        continue;
    }

    console.log('\n========================================');
    console.log('Processing: ' + filePath);
    console.log('========================================');

    let content = fs.readFileSync(filePath, 'utf8');
    const originalLength = content.length;

    // Create backup
    const backupPath = filePath + '.backup';
    fs.writeFileSync(backupPath, content);
    console.log('Backup created: ' + backupPath);

    let totalReplacements = 0;

    for (const [hexPattern, replacement] of patterns) {
        try {
            const searchStr = fromHex(hexPattern);
            if (content.includes(searchStr)) {
                const count = content.split(searchStr).length - 1;
                const displayChar = replacement.length <= 2 ? replacement : replacement;
                console.log('  Found ' + count + 'x -> ' + displayChar + ' (hex: ' + hexPattern.substring(0, 16) + '...)');
                totalReplacements += count;
                content = content.split(searchStr).join(replacement);
            }
        } catch (e) {
            // Skip invalid hex patterns silently
        }
    }

    // Write fixed content
    fs.writeFileSync(filePath, content, 'utf8');

    console.log('\nFixed ' + totalReplacements + ' corrupted characters');
    console.log('File size: ' + originalLength + ' -> ' + content.length + ' chars');

    // Scan for remaining mojibake indicators
    const buf = Buffer.from(content, 'utf8');
    let suspiciousCount = 0;
    for (let i = 0; i < buf.length - 3; i++) {
        // Look for double-encoded UTF-8: C3 83 or C3 82 followed by C2/C3
        if (buf[i] === 0xC3 && (buf[i + 1] === 0x83 || buf[i + 1] === 0x82)) {
            suspiciousCount++;
        }
    }

    if (suspiciousCount > 0) {
        console.log('WARNING: Found ' + suspiciousCount + ' potentially double-encoded sequences remaining');
        console.log('These may need manual inspection or additional patterns');
    } else {
        console.log('No remaining double-encoded sequences detected');
    }
}

console.log('\nAll done!');