#!/usr/bin/env python3
"""
Fix UTF-8 Encoding Issues in CLARENCE Pages
Zero external dependencies - uses Python built-in codec reversal.

The problem: UTF-8 bytes were misread as Latin-1/Windows-1252, then
re-encoded as UTF-8. Fix: reverse the process.

Usage:
  python3 fix-encoding.py ./app/auth/contract-prep/page.tsx
  python3 fix-encoding.py ./app/auth/invite-providers/page.tsx ./app/auth/create-contract/page.tsx
  python3 fix-encoding.py --check ./app/auth/contract-prep/page.tsx   (dry run)
"""

import sys
import os
import shutil


def fix_mojibake_segment(text):
    """
    Fix a segment of mojibake text.
    Encodes as cp1252 (reversing the wrong decode) then decodes as utf-8.
    Windows-1252 is needed (not latin-1) because the garbled chars include
    smart quotes, dashes etc. in the 0x80-0x9F range.
    """
    # Try cp1252 first (handles smart quotes etc.), then latin-1 as fallback
    for codec in ['cp1252', 'latin-1']:
        try:
            fixed = text.encode(codec).decode('utf-8')
            # Check if result needs another round (triple encoding)
            try:
                fixed2 = fixed.encode(codec).decode('utf-8')
                if fixed2 != fixed and len(fixed2) < len(fixed):
                    return fixed2
            except (UnicodeDecodeError, UnicodeEncodeError):
                pass
            return fixed
        except (UnicodeDecodeError, UnicodeEncodeError):
            continue
    return text


def fix_line_segments(line):
    """Fix encoding in a line that has mixed valid/garbled content."""
    result = []
    i = 0

    while i < len(line):
        if ord(line[i]) >= 0xC0:
            # Grab the full mojibake segment (consecutive high-byte characters)
            j = i
            while j < len(line) and ord(line[j]) >= 0x80:
                j += 1
            segment = line[i:j]
            fixed = fix_mojibake_segment(segment)
            result.append(fixed)
            i = j
        else:
            result.append(line[i])
            i += 1

    return ''.join(result)


def fix_encoding(content):
    """
    Fix mojibake in content.
    Strategy 1: Try fixing entire file at once.
    Strategy 2: Try line by line.
    Strategy 3: Try segment by segment within lines.
    """

    # ================================================================
    # STRATEGY 1: Full file fix (works if consistently double-encoded)
    # ================================================================
    for codec in ['cp1252', 'latin-1']:
        try:
            full_fix = content.encode(codec).decode('utf-8')
            full_fix.encode('utf-8')  # Verify valid UTF-8
            if len(full_fix) < len(content):
                print(f"  Method: Full-file codec reversal ({codec})")
                return full_fix
        except (UnicodeDecodeError, UnicodeEncodeError):
            pass

    # ================================================================
    # STRATEGY 2: Line-by-line fix
    # ================================================================
    lines = content.split('\n')
    fixed_lines = []
    changes = 0

    for line in lines:
        fixed_line = None
        for codec in ['cp1252', 'latin-1']:
            try:
                candidate = line.encode(codec).decode('utf-8')
                if candidate != line:
                    fixed_line = candidate
                    changes += 1
                    break
                else:
                    fixed_line = line
                    break
            except (UnicodeDecodeError, UnicodeEncodeError):
                continue
        
        if fixed_line is None:
            # ========================================================
            # STRATEGY 3: Segment-by-segment within this line
            # ========================================================
            fixed_line = fix_line_segments(line)
            if fixed_line != line:
                changes += 1
        fixed_lines.append(fixed_line)

    if changes > 0:
        print(f"  Method: Line-by-line ({changes} lines fixed)")

    return '\n'.join(fixed_lines)


def apply_known_replacements(content):
    """
    Fallback: direct string replacements for known mojibake patterns.
    Used when codec reversal doesn't catch everything.
    """
    # Each tuple: (garbled_string, correct_character, description)
    replacements = [
        # Checkmarks and symbols
        ('\u00e2\u0153\u201c', '\u2713', 'checkmark'),
        ('\u00e2\u0153\u2022', '\u2715', 'X mark'),
        ('\u00e2\u0153\u201d', '\u2713', 'checkmark variant'),

        # Arrows
        ('\u00e2\u2013\u00b6', '\u25b6', 'triangle right'),
        ('\u00e2\u2020\u2019', '\u2192', 'right arrow'),
        ('\u00e2\u2020\u0090', '\u2190', 'left arrow'),

        # Dashes
        ('\u00e2\u20ac\u201c', '\u2013', 'en dash'),
        ('\u00e2\u20ac\u201d', '\u2014', 'em dash'),

        # Quotes
        ('\u00e2\u20ac\u2122', '\u2019', 'right single quote'),
        ('\u00e2\u20ac\u02dc', '\u2018', 'left single quote'),
        ('\u00e2\u20ac\u0153', '\u201c', 'left double quote'),
        ('\u00e2\u20ac\u009d', '\u201d', 'right double quote'),

        # Bullets and ellipsis
        ('\u00e2\u20ac\u00a2', '\u2022', 'bullet'),
        ('\u00e2\u20ac\u00a6', '\u2026', 'ellipsis'),

        # Currency
        ('\u00c2\u00a3', '\u00a3', 'pound sign'),

        # Common emoji mojibake patterns (4-byte UTF-8 double encoded)
        # These show up as 4+ garbled latin chars
    ]

    result = content
    total = 0
    for garbled, correct, desc in replacements:
        if garbled in result:
            count = result.count(garbled)
            total += count
            result = result.replace(garbled, correct)
            print(f"    Replaced {desc}: x{count}")

    if total > 0:
        print(f"  Fallback replacements: {total} total")

    return result


def show_sample_changes(original, fixed):
    """Show sample changes for verification."""
    orig_lines = original.split('\n')
    fixed_lines = fixed.split('\n')

    shown = 0
    max_show = 10

    for i in range(min(len(orig_lines), len(fixed_lines))):
        if orig_lines[i] != fixed_lines[i]:
            shown += 1
            if shown <= max_show:
                orig_stripped = orig_lines[i].strip()[:80]
                fixed_stripped = fixed_lines[i].strip()[:80]
                if orig_stripped and fixed_stripped:
                    print(f"  Line {i+1}:")
                    print(f"    WAS: {orig_stripped}")
                    print(f"    NOW: {fixed_stripped}")

    if shown > max_show:
        print(f"  ... and {shown - max_show} more lines changed")
    elif shown > 0:
        print(f"  {shown} lines changed total")


def scan_remaining_issues(content):
    """Check for any remaining garbled patterns."""
    known_garbled = [
        '\u00e2\u0153', '\u00e2\u20ac', '\u00e2\u2013',
        '\u00e2\u2020', '\u00c2\u00a3', '\u00c3\u00a2',
        '\u00c3\u00a9', '\u00c3\u00a8',
        '\u00c3\u0192', '\u00c3\u201a',
    ]
    found = []
    for pattern in known_garbled:
        if pattern in content:
            count = content.count(pattern)
            found.append((pattern, count))

    return found


def fix_file(filepath, dry_run=False):
    """Fix encoding issues in a single file."""
    if not os.path.exists(filepath):
        print(f"  ERROR: File not found: {filepath}")
        return False

    print(f"\n{'='*60}")
    print(f"Processing: {filepath}")
    print(f"{'='*60}")

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    original_len = len(content)

    # ================================================================
    # PASS 1: Codec reversal
    # ================================================================
    fixed = fix_encoding(content)

    # ================================================================
    # PASS 2: Fix patterns with control chars (U+0080-U+009F)
    # These fail line-level cp1252 encoding but are valid mojibake
    # ================================================================
    control_char_fixes = {
        # ← (left arrow): â (E2) + † (86) + \x90 (90) = E2 86 90
        '\u00e2\u2020\u0090': '\u2190',
        # ✏️ (pencil + variation selector): â (E2) + œ (9C) + \x8f (8F) + ï (EF) + ¸ (B8) + \x8f (8F)
        '\u00e2\u0153\u008f\u00ef\u00b8\u008f': '\u270f\ufe0f',
        # ✏ without variation selector
        '\u00e2\u0153\u008f': '\u270f',
        # ⚠ (warning): â (E2) + š (9A) + \xa0 (A0) 
        '\u00e2\u0161\u00a0': '\u26a0',
        # ⚡ (lightning)
        '\u00e2\u0161\u00a1': '\u26a1',
        # ⟳ (reload): â (E2) + Ÿ (9F) + ³ (B3)
        '\u00e2\u0178\u00b3': '\u27f3',
    }
    for garbled, correct in control_char_fixes.items():
        if garbled in fixed:
            count = fixed.count(garbled)
            fixed = fixed.replace(garbled, correct)
            print(f"  Control char fix: {repr(correct)} x{count}")

    # ================================================================
    # PASS 3: Check for remaining issues, apply fallback if needed
    # ================================================================
    remaining = scan_remaining_issues(fixed)
    if remaining:
        print(f"  Pass 2 left {sum(c for _, c in remaining)} garbled sequences")
        fixed = apply_known_replacements(fixed)

    # ================================================================
    # RESULTS
    # ================================================================
    if content == fixed:
        print("  No encoding issues found.")
        return True

    len_diff = original_len - len(fixed)
    print(f"  Characters collapsed: {len_diff}")
    print(f"  File size: {original_len} -> {len(fixed)} chars")

    show_sample_changes(content, fixed)

    # Final scan
    final_remaining = scan_remaining_issues(fixed)
    if final_remaining:
        print(f"  WARNING: {sum(c for _, c in final_remaining)} garbled sequences remain")
        for pattern, count in final_remaining:
            print(f"    '{repr(pattern)}' x{count}")

    if dry_run:
        print("  DRY RUN - no changes written")
        return True

    # Create backup
    backup_path = filepath + '.backup'
    shutil.copy2(filepath, backup_path)
    print(f"  Backup: {backup_path}")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(fixed)

    print("  FIXED successfully")
    return True


def main():
    args = sys.argv[1:]

    if not args:
        print("Usage: python3 fix-encoding.py [--check] <file1> [file2] ...")
        print("  --check   Dry run (show changes without writing)")
        sys.exit(1)

    dry_run = False
    if '--check' in args:
        dry_run = True
        args.remove('--check')
        print("DRY RUN MODE - no files will be modified\n")

    success = True
    for filepath in args:
        if not fix_file(filepath, dry_run):
            success = False

    print(f"\n{'='*60}")
    if success:
        print("All done!")
    else:
        print("Some files had errors.")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()