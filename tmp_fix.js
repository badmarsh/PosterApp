
const fs = require('fs');
const path = 'components/workspace-selector.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldStr = `            <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-mono">
              6 Protocols
            </span>`;

const newStr = `            <span className="ml-1 rounded-full bg-muted-foreground/15 text-muted-foreground px-1.5 py-0.2 text-[10px]">
              6
            </span>`;

if (content.includes(oldStr)) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(path, content, 'utf8');
  console.log('SUCCESS');
} else {
  // Try to find it with different line endings
  const idx = content.indexOf('6 Protocols');
  if (idx >= 0) {
    console.log('Found "6 Protocols" at index', idx);
    console.log('Context:', JSON.stringify(content.substring(idx-100, idx+50)));
  } else {
    console.log('Not found at all');
  }
}

