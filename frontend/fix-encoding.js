const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname);
const htmlFiles = fs.readdirSync(frontendDir).filter(f => f.endsWith('.html'));

let totalFixed = 0;

for (const file of htmlFiles) {
    const filePath = path.join(frontendDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Build replacements from actual mojibake strings found in the files
    const replacements = [
        // Warning: âš ï¸  (note the space between š and ï)
        { search: '\u00E2\u0161 \u00EF\u00B8', replace: '&#9888;&#65039;', name: 'Warning' },
        // Cross mark: âŒ
        { search: '\u00E2\u0152', replace: '&#10060;', name: 'CrossMark' },
        // Em dash: â€"
        { search: '\u00E2\u20AC\u201C', replace: '&mdash;', name: 'EmDash' },
        // Copyright: Â©
        { search: '\u00C2\u00A9', replace: '&copy;', name: 'Copyright' },
    ];

    for (const r of replacements) {
        if (content.includes(r.search)) {
            const count = content.split(r.search).length - 1;
            content = content.split(r.search).join(r.replace);
            console.log(`  ${file}: Replaced ${count}x ${r.name}`);
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed: ${file}`);
        totalFixed++;
    } else {
        console.log(`Skipped: ${file}`);
    }
}

console.log(`\nDone! Fixed ${totalFixed} files.`);
