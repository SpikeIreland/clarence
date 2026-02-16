#!/usr/bin/env python3
"""
CLARENCE UTF-8 Sanitiser
========================
Run this AFTER downloading any .tsx/.ts file from Claude, BEFORE pushing to production.

Usage:
    python3 fix-claude-encoding.py path/to/file.tsx
    python3 fix-claude-encoding.py app/auth/contract-studio/page.tsx

What it does:
    - Detects garbled UTF-8 sequences (double-encoded emoji/symbols)
    - Replaces them with the correct Unicode characters
    - Reports what it fixed so you can verify

The garbled characters happen because project knowledge files go through
an encoding transformation when Claude ingests them. This script reverses
that transformation.

Add new patterns to BYTE_FIXES or TEXT_FIXES as you encounter them.
"""

import sys
import os

# =========================================================================
# SECTION 1: BYTE-LEVEL FIXES
# For severely garbled emoji where the bytes are triple/double encoded.
# Format: (garbled_hex_string, correct_unicode_codepoint_hex, description)
# =========================================================================

BYTE_FIXES = [
    # 4-byte emoji (most severely garbled)
    ("c383c2b0c385c2b8c3a2e282acc29dc3a2e282ace284a2", "f09f9492", "locked padlock"),
    ("c383c2b0c385c2b8c3a2e282acc29dc3a2e282acc593",   "f09f9493", "unlocked padlock"),
    ("c383c2b0c385c2b8c385c2bdc3a2e282acc2b0",         "f09f8e89", "party popper"),
    ("c383c2b0c385c2b8c385c2bdc3a2e282acc29c",         "f09f8e93", "graduation cap"),
    ("c3b0c5b8c5bde2809cc382c2a1",                     "f09f92a1", "light bulb"),
    ("c383c2b0c385c2b8c3a2e282acc29cc382c2a9",         "f09f93a9", "envelope with arrow"),
    ("c383c2b0c385c2b8c3a2e282acc29cc3a2e282acc2bb",   "f09f93bb", "clipboard"),
    ("c383c2b0c385c2b8c3a2e282acc29cc3a2e282acc29e",   "f09f93a4", "page facing up"),
    ("c3b0c5b8c3a2e282acc29cc3a2e282acc2bb",           "f09f93bb", "clipboard alt"),
    ("c3b0c5b8c3a2e282acc29cc3a2e282acc29e",           "f09f93a4", "page facing up alt"),

    # 3-byte symbols
    ("c383c2a2c382c28fc382c2b3",                       "e28fb3",   "hourglass"),
    ("c383c2a2c3a2e282acc2a0c3a2e282acc29d",           "e28694",   "left-right arrow"),
    ("c3a2c5a1c2a0c383c692c382c2afc383e2809ac382c2b8", "e29aa0efb88f", "warning sign with VS"),
    ("c3a2c5a1c2a0",                                   "e29aa0",   "warning sign"),
]

# =========================================================================
# SECTION 2: TEXT-LEVEL FIXES
# For simpler garbled patterns that survived as displayable but wrong chars.
# Format: (garbled_string_as_hex_bytes, correct_string_as_hex_bytes, description)
# Using hex to keep this file purely ASCII.
# =========================================================================

TEXT_FIXES = [
    # Currency
    ("c382c2a3", "c2a3",     "pound sign"),
    ("c3a2e2809ac2ac", "e282ac", "euro sign"),

    # Bullets and dashes
    ("c3a2e2809ac2a2", "e280a2", "bullet"),
    ("c3a2e2809ac2a6", "e28094", "em dash"),
    ("c3a2e2809ac2c4", "e28093", "en dash"),

    # Check marks
    ("c3a2c593c2a8", "e29c93",   "check mark"),
    ("c3a2c593c2a0", "e29c85",   "white heavy check"),

    # Arrows
    ("c3a2e28690", "e28690", "left arrow"),
    ("c3a2e28691", "e28691", "up arrow"),
    ("c3a2e28692", "e28692", "right arrow"),
    ("c3a2e28693", "e28693", "down arrow"),
    ("c3a2e28786", "e28784", "right arrow over left"),

    # Diamonds
    ("c3a2e29786", "e29786", "black diamond"),
    ("c3a2e29787", "e29787", "white diamond"),
]


def fix_file(filepath):
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        return False

    with open(filepath, 'rb') as f:
        data = f.read()

    original_size = len(data)
    total_fixes = 0

    # --- Apply byte-level fixes ---
    for garbled_hex, correct_hex, description in BYTE_FIXES:
        garbled = bytes.fromhex(garbled_hex)
        correct = bytes.fromhex(correct_hex)
        count = data.count(garbled)
        if count > 0:
            data = data.replace(garbled, correct)
            total_fixes += count
            emoji = correct.decode('utf-8')
            print(f"  Fixed: {emoji}  {description} ({count}x)")

    # --- Apply text-level fixes ---
    for garbled_hex, correct_hex, description in TEXT_FIXES:
        garbled = bytes.fromhex(garbled_hex)
        correct = bytes.fromhex(correct_hex)
        count = data.count(garbled)
        if count > 0:
            data = data.replace(garbled, correct)
            total_fixes += count
            char = correct.decode('utf-8')
            print(f"  Fixed: {char}  {description} ({count}x)")

    # --- Write result ---
    if total_fixes > 0:
        with open(filepath, 'wb') as f:
            f.write(data)
        size_diff = original_size - len(data)
        print(f"\n  Total: {total_fixes} garbled sequences fixed")
        print(f"  File size: {original_size:,} -> {len(data):,} bytes ({size_diff:+,})")
    else:
        print(f"\n  No garbled characters found in {filepath}")

    # --- Verification scan ---
    text = data.decode('utf-8')
    suspicious = []
    for i, line in enumerate(text.split('\n'), 1):
        latin_sup = [c for c in line if 0xC0 <= ord(c) <= 0xFF]
        if len(latin_sup) >= 3:
            suspicious.append((i, line.strip()[:100]))

    if suspicious:
        print(f"\n  WARNING: {len(suspicious)} lines may still have issues:")
        for ln, txt in suspicious[:5]:
            print(f"    Line {ln}: {txt}")
        if len(suspicious) > 5:
            print(f"    ... and {len(suspicious) - 5} more")
    else:
        print("  Verification: No remaining suspicious patterns.")

    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("CLARENCE UTF-8 Sanitiser")
        print("Usage: python3 fix-claude-encoding.py <file.tsx> [file2.tsx ...]")
        print("\nRun after downloading any file from Claude, before git-push.sh")
        sys.exit(1)

    print("CLARENCE UTF-8 Sanitiser")
    print("=" * 40)

    for fpath in sys.argv[1:]:
        print(f"\nProcessing: {fpath}")
        fix_file(fpath)

    print("\n" + "=" * 40)
    print("Done. Review changes, then push:")
    print('  ./git-push.sh "your commit message"')