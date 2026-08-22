const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./app/api', function(filePath) {
  if (filePath.endsWith('route.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('import { getAuth as auth } from "@/lib/auth"')) {
      content = content.replace(
        'import { getAuth as auth } from "@/lib/auth"',
        'import { auth } from "@/lib/auth"'
      );
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    } else if (content.includes('import { auth } from "@clerk/nextjs/server"')) {
      content = content.replace(
        'import { auth } from "@clerk/nextjs/server"',
        'import { auth } from "@/lib/auth"'
      );
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});
