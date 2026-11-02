/* Сборка переносимого архива: node engine/build/make-kit.js
   Результат: engine/kit/ (файлы) и engine/kap-kit.zip. В архиве всё нужное для нового чата без репозитория. */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), KIT = path.join(ROOT, 'kit');
const ORDER = require('./order.js');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const srcFiles = [...new Set([...ORDER.core, ...ORDER.student, ...ORDER.teacher, 'styles/shared.css', 'styles/student.css', 'styles/teacher.css'])];
const SRC = {}; srcFiles.forEach(f => SRC[f] = rd('src/' + f));
const MODS = { 'order.js': rd('build/order.js'), 'assemble.js': rd('build/assemble.js'), 'packcheck.js': rd('build/packcheck.js') };
const version = rd('VERSION').trim();

const cli = rd('build/cli.js');
const marker = "'use strict';\nconst fs = require('fs')";
if (cli.indexOf(marker) < 0) throw new Error('в cli.js не найдено место вставки');
const embedded = cli.replace(marker, `const __SRC = ${JSON.stringify(SRC)};\nconst __MODS = ${JSON.stringify(MODS)};\nconst __VERSION = ${JSON.stringify(version)};\n` + marker);

fs.rmSync(KIT, { recursive: true, force: true }); fs.mkdirSync(KIT, { recursive: true });
fs.writeFileSync(path.join(KIT, 'kap-engine.js'), embedded);
fs.copyFileSync(path.join(ROOT, 'docs', 'PACK_FORMAT.md'), path.join(KIT, 'PACK_FORMAT.md'));
fs.copyFileSync(path.join(ROOT, 'docs', 'START_PROMPT.md'), path.join(KIT, 'START_PROMPT.md'));
fs.copyFileSync(path.join(ROOT, 'content', 'demo', 'pack.js'), path.join(KIT, 'example-pack.js'));
fs.copyFileSync(path.join(ROOT, '..', 'MASTER_PROMPT_COM_KSP_1-11_UNIFIED.md'), path.join(KIT, 'MASTER_PROMPT.md'));
fs.writeFileSync(path.join(KIT, 'README.txt'),
`Набор для создания ЦОМ по КСП (ядро ${version}).

1. Распакуй архив. Нужен Node.js 18+ (для браузерной проверки ещё Playwright с Chromium).
2. Открой новый чат, вставь содержимое START_PROMPT.md, приложи этот архив, файлы КСП и базу целей.
3. Модель напишет pack.js и соберёт два файла: student_material.html (ученику) и teacher_console.html (учителю).

Файлы:
  kap-engine.js     всё ядро и сборщик в одном файле (команды: check, build, smoke, all)
  PACK_FORMAT.md    как писать pack.js (уроки и генераторы)
  example-pack.js   образец (демонстрационное содержание, не КСП)
  MASTER_PROMPT.md  правила создания ЦОМ
  START_PROMPT.md   что вставить в новый чат

Проверка работы набора: node kap-engine.js all example-pack.js out
`);

const zip = path.join(ROOT, 'kap-kit.zip'); fs.rmSync(zip, { force: true });
cp.execFileSync('python3', ['-I', '-c', `
import zipfile, os, sys
kit, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(kit)):
        z.write(os.path.join(kit, f), 'kap-kit/' + f)
`, KIT, zip]);
console.log('Набор: ' + path.relative(path.join(ROOT, '..'), KIT) + '/ (' + fs.readdirSync(KIT).length + ' файлов), архив ' + path.relative(path.join(ROOT, '..'), zip) + ' · ' + Math.round(fs.statSync(zip).size / 1024) + ' КБ');
fs.readdirSync(KIT).forEach(f => console.log('  ' + f + ' · ' + Math.round(fs.statSync(path.join(KIT, f)).size / 1024) + ' КБ'));
