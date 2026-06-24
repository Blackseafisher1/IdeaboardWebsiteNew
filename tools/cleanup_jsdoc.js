const fs = require('fs');
const path = require('path');

function walk(dir) {
    const res = [];
    if (!fs.existsSync(dir)) return res;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    list.forEach(item => {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) res.push(...walk(full));
        else if (item.isFile() && full.endsWith('.js')) res.push(full);
    });
    return res;
}

function cleanupDuplicates(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Pattern to catch the specific generic blocks I added:
    // /**
    //  * description...
    //  * @name ... or @returns ...
    //  */
    // followed immediately (or with whitespace) by another one, OR preceded by another one.
    
    // Actually, a simpler way is to find the cases where two blocks exist for the same target.
    // The generic ones I added have "Beschreibung: Endpunkt für" or "Beschreibung: [name]."
    
    let modified = false;

    // Regex to find two JSDoc blocks separated only by whitespace/newlines
    // Group 1: The first block
    // Group 2: The whitespace
    // Group 3: The second block
    const doubleJSDocRegex = /(\/\*\*[\s\S]*?\*\/)(\s*)(\/\*\*[\s\S]*?\*\/)/g;

    let newContent = content.replace(doubleJSDocRegex, (match, first, space, second) => {
        const isFirstGeneric = first.includes('Beschreibung: Endpunkt für') || first.includes('Beschreibung: ') && first.includes('* @returns {void}');
        const isSecondGeneric = second.includes('Beschreibung: Endpunkt für') || second.includes('Beschreibung: ') && second.includes('* @returns {void}');

        if (isFirstGeneric && !isSecondGeneric) {
            modified = true;
            return second; // Keep the more descriptive one (second)
        }
        if (isSecondGeneric && !isFirstGeneric) {
            modified = true;
            return first; // Keep the more descriptive one (first)
        }
        if (isFirstGeneric && isSecondGeneric) {
            modified = true;
            // Both are generic? Keep the one with more info if possible, otherwise just the first.
            return first;
        }
        
        // If neither is "generic", they might be duplicates still or different. 
        // For safety, if they are right next to each other, we might want to check if they describe the same thing.
        // But the user specifically complained about the "everything twice" issue which I caused with my scripts.
        return match;
    });

    if (modified) {
        fs.writeFileSync(file, newContent, 'utf8');
        return true;
    }
    return false;
}

const folders = ['routes', 'public/js'];
let totalModified = 0;

folders.forEach(dir => {
    const fullDir = path.join(__dirname, '..', dir);
    const files = walk(fullDir);
    files.forEach(f => {
        if (cleanupDuplicates(f)) {
            console.log('Cleaned up duplicates in:', f);
            totalModified++;
        }
    });
});

console.log('Total files cleaned:', totalModified);
