const gulp = require('gulp');
const nodemon = require('gulp-nodemon');
const ts = require('gulp-typescript');
const JSON_FILES = ['src/*.json', 'src/**/*.json'];

// pull in the project TypeScript config
const tsProject = ts.createProject('tsconfig.json');

gulp.task('tsc', () => {
  const tsResult = tsProject.src().pipe(tsProject());
  return tsResult.js.pipe(gulp.dest('dist'));
});

gulp.task('watch', ['tsc'], () => {
  gulp.watch('src/**/*.ts', ['tsc']);
});

gulp.task('assets', function() {
  return gulp.src(JSON_FILES).pipe(gulp.dest('dist'));
});

gulp.task('start', ['watch'], function() {
  nodemon({
    script: 'dist/adapters/app.js',  // Change this to the compiled app.js/index.js/server.js etc.
    ext: 'js html',
    watch: ['./dist']
  });
});

gulp.task('default', ['watch', 'assets']);