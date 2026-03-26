const fs = require('fs');

const code = fs.readFileSync('server.js', 'utf8');

// Strip out template literals and comments first, or just count them simply
let openBraces = 0;
let openParens = 0;
let openBrackets = 0;

let inString = false;
let inTemplate = false;
let inComment = false;
let inMultiComment = false;
let escape = false;

for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i+1];

    if (inString) {
        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        if (char === inString) { inString = false; }
        continue;
    }

    if (inTemplate) {
        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        // We aren't handling ${} but that's fine for simple brace counting if we assume ${ counts as {
        if (char === '\`') { inTemplate = false; }
        continue;
    }

    if (inComment) {
        if (char === '\n') { inComment = false; }
        continue;
    }

    if (inMultiComment) {
        if (char === '*' && nextChar === '/') { inMultiComment = false; i++; }
        continue;
    }

    if (char === '/' && nextChar === '/') { inComment = true; i++; continue; }
    if (char === '/' && nextChar === '*') { inMultiComment = true; i++; continue; }

    if (char === "'" || char === '"') { inString = char; continue; }
    if (char === '\`') { inTemplate = true; continue; }

    if (char === '{') { openBraces++; console.log('Line ' + code.substring(0, i).split('\\n').length + ': { opened. Count=' + openBraces); }
    if (char === '}') { openBraces--; console.log('Line ' + code.substring(0, i).split('\\n').length + ': } closed. Count=' + openBraces); }
}

console.log({ openBraces });
