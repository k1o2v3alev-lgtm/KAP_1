/* Сборка: node engine/build/build.js [имя_набора]  →  engine/dist/<имя>/student_material.html и teacher_console.html
   Одно и то же содержание (pack.js) встраивается в оба файла из одного источника; contentHash совпадает. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ORDER = require('./order.js');
const name = process.argv[2] || 'demo';
const read = rel => fs.readFileSync(path.join(ROOT, 'src', rel), 'utf8');
const A = require('./assemble.js')(read, ORDER);
const engineVersion = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const packSrc = fs.readFileSync(path.join(ROOT, 'content', name, 'pack.js'), 'utf8');
const m = A.meta(packSrc, engineVersion, name), label = `content/${name}/pack.js`;
const outDir = path.join(ROOT, 'dist', name); fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'student_material.html'), A.bundle('student', packSrc, m, label));
fs.writeFileSync(path.join(outDir, 'teacher_console.html'), A.bundle('teacher', packSrc, m, label));
console.log(`Сборка «${name}»: engine ${m.engineVersion}, content ${m.contentVersion}, contentHash ${m.contentHash}`);
['student_material.html', 'teacher_console.html'].forEach(f => console.log('  ' + path.join('dist', name, f) + ' · ' + Math.round(fs.statSync(path.join(outDir, f)).size / 1024) + ' КБ'));
