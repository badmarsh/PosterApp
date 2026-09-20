
import fs from 'fs';
const file = 'scripts/populate_showcases.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace('($28\\%\\$ relative boost)', '(28% relative boost)');
content = content.replace('($28%$ relative boost)', '(28% relative boost)');
content = content.replace('($28% relative boost)', '(28% relative boost)');
content = content.replace('($28\\% relative boost)', '(28% relative boost)');
content = content.replace('($28\\\\% relative boost)', '(28% relative boost)');
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed COCO card');
