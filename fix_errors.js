const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function replaceInFile(filePath) {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Replace { error: true, message: ... } with { success: false, error: ... }
  // single line
  content = content.replace(/\{\s*error:\s*true,\s*message:/g, '{ success: false, error:');
  // multi line
  content = content.replace(/\{\s*error:\s*true,\s*\n\s*message:/g, '{ \n      success: false, \n      error:');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', filePath);
  }
}

walkDir('./src/app/api', replaceInFile);
