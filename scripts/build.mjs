import { mkdir, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
// Allowlist browser assets only: never copy .env, server code, tests or SQL.
await mkdir('public/js',{recursive:true});
for(const file of ['index.html','styles.css']) await copyFile(file,path.join('public',file));
for(const file of await readdir('js')) if(file.endsWith('.js')) await copyFile(path.join('js',file),path.join('public/js',file));
console.log('Browser assets prepared in public/.');
