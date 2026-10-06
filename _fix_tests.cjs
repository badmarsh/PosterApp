const fs = require('fs');
let c = fs.readFileSync('tests/error-lens.spec.ts', 'utf8');
c = c.replace(/Select the Introduction card from the demo workspace/g, 'Select the Search Overview card from the demo workspace');
c = c.replace(/getByText\('Introduction', \{ exact: true \}\)/g, "getByText('Search Overview', { exact: true })");
c = c.replace(/Inspector for Introduction/g, 'Inspector for Search Overview');
fs.writeFileSync('tests/error-lens.spec.ts', c);
console.log('error-lens fixed');
