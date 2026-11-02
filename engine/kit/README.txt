Набор для создания ЦОМ по КСП (ядро 1.0.0).

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
