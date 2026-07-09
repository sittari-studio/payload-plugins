import { copyFileSync, existsSync, mkdirSync, watch } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const cwd = process.cwd()
const cssFiles = [
  {
    from: path.resolve(cwd, 'src/admin.css'),
    to: path.resolve(cwd, 'dist/admin.css'),
  },
]

const copyCssFile = ({ from, to }) => {
  if (!existsSync(from)) {
    return
  }

  mkdirSync(path.dirname(to), {
    recursive: true,
  })
  copyFileSync(from, to)
  console.log(`copied ${path.relative(cwd, from)} -> ${path.relative(cwd, to)}`)
}

for (const cssFile of cssFiles) {
  copyCssFile(cssFile)

  if (existsSync(cssFile.from)) {
    watch(cssFile.from, {
      persistent: true,
    }, () => {
      copyCssFile(cssFile)
    })
  }
}

const tsc = spawn(
  'tsc',
  ['-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
  {
    shell: true,
    stdio: 'inherit',
  },
)

const stop = () => {
  tsc.kill('SIGTERM')
  process.exit()
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)

tsc.on('exit', (code) => {
  process.exit(code ?? 0)
})
