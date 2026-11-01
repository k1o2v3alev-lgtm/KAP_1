/* Порядок подключения исходников ядра (пути относительно engine/src). */
module.exports = {
  core: [
    'core/util.js', 'core/normalize.js', 'core/expr.js', 'core/check.js',
    'core/scoring.js', 'core/generators.js', 'core/schema.js', 'core/legacy.js'
  ],
  student: ['student/i18n.js', 'student/app.js'],
  teacher: ['teacher/paper.js', 'teacher/app.js']
};
