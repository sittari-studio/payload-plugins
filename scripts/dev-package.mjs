import { copyFileSync, existsSync, mkdirSync, watch } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const cwd = process.cwd();
const tailwindConfig = path.resolve(cwd, 'tailwind.config.mjs');
const cssFiles = [
  {
    from: path.resolve(cwd, 'src/admin.css'),
    to: path.resolve(cwd, 'dist/admin.css'),
  },
];

const copyCssFile = ({ from, to }) => {
  if (!existsSync(from)) {
    return;
  }

  mkdirSync(path.dirname(to), {
    recursive: true,
  });
  copyFileSync(from, to);
  console.log(
    `copied ${path.relative(cwd, from)} -> ${path.relative(cwd, to)}`,
  );
};

let tailwind;

if (existsSync(tailwindConfig)) {
  tailwind = spawn(
    'tailwindcss',
    [
      '-c',
      'tailwind.config.mjs',
      '-i',
      'src/admin.css',
      '-o',
      'dist/admin.css',
      '--watch',
    ],
    {
      shell: true,
      stdio: 'inherit',
    },
  );
} else {
  for (const cssFile of cssFiles) {
    copyCssFile(cssFile);

    if (existsSync(cssFile.from)) {
      watch(
        cssFile.from,
        {
          persistent: true,
        },
        () => {
          copyCssFile(cssFile);
        },
      );
    }
  }
}

const tsc = spawn(
  'tsc',
  ['-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
  {
    shell: true,
    stdio: 'inherit',
  },
);

const stop = () => {
  tailwind?.kill('SIGTERM');
  tsc.kill('SIGTERM');
  process.exit();
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

tsc.on('exit', (code) => {
  tailwind?.kill('SIGTERM');
  process.exit(code ?? 0);
});

tailwind?.on('exit', (code) => {
  tsc.kill('SIGTERM');
  process.exit(code ?? 0);
});
