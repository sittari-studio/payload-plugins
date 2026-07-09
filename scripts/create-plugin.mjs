#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const rawName = process.argv[2]

if (!rawName) {
  console.error('Usage: pnpm create:plugin <name>')
  process.exit(1)
}

const name = rawName
  .replace(/^@krameri\//, '')
  .replace(/^payload-plugin-/, '')
  .replace(/^plugin-/, '')
  .toLowerCase()
  .replace(/[^a-z0-9-]/g, '-')
  .replace(/^-+|-+$/g, '')

if (!name) {
  console.error('Plugin name must contain at least one letter or number.')
  process.exit(1)
}

const pascalName = name
  .split('-')
  .filter(Boolean)
  .map((part) => part[0].toUpperCase() + part.slice(1))
  .join('')

const camelName = pascalName[0].toLowerCase() + pascalName.slice(1)
const exportName = `${camelName}Plugin`
const pluginConfigName = `${pascalName}PluginConfig`

const packageName = `@krameri/payload-${name}`
const packageDir = path.join(process.cwd(), 'packages', name)

if (existsSync(packageDir)) {
  console.error(`Package already exists: packages/${name}`)
  process.exit(1)
}

await mkdir(path.join(packageDir, 'src'), { recursive: true })
await mkdir(path.join(packageDir, 'src', 'exports'), { recursive: true })
await mkdir(path.join(packageDir, 'test'), { recursive: true })

await writeFile(
  path.join(packageDir, 'package.json'),
  `${JSON.stringify(
    {
      name: packageName,
      version: '0.1.0',
      description: `PayloadCMS ${name} plugin.`,
      type: 'module',
      license: 'MIT',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.js',
          default: './dist/index.js',
        },
        './types': {
          types: './dist/exports/types.d.ts',
          import: './dist/exports/types.js',
        },
      },
      files: ['dist', 'README.md'],
      sideEffects: false,
      scripts: {
        build: 'pnpm run clean && pnpm run build:types && pnpm run build:js',
        'build:js': 'tsc -p tsconfig.build.json --declaration false --declarationMap false',
        'build:types': 'tsc -p tsconfig.build.json --emitDeclarationOnly',
        typecheck: 'tsc --noEmit',
        test: 'pnpm run test:int',
        'test:int': 'vitest run',
        dev: 'node ../../scripts/dev-package.mjs',
        clean: 'rm -rf dist *.tsbuildinfo',
        prepublishOnly: 'pnpm run clean && pnpm run build',
      },
      peerDependencies: {
        payload: '^3.0.0',
      },
      devDependencies: {
        payload: '^3.0.0',
        typescript: 'latest',
        vitest: '4.1.9',
      },
      publishConfig: {
        access: 'public',
      },
      keywords: ['payload', 'payloadcms', 'payload-plugin', 'cms', name],
    },
    null,
    2,
  )}\n`,
)

await writeFile(
  path.join(packageDir, 'tsconfig.json'),
  `{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
`,
)

await writeFile(
  path.join(packageDir, 'tsconfig.build.json'),
  `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": false,
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
`,
)

await writeFile(
  path.join(packageDir, 'src/types.ts'),
  `export type ${pluginConfigName} = {
  enabled?: boolean
}
`,
)

await writeFile(
  path.join(packageDir, 'src/plugin.ts'),
  `import type { Config, Plugin } from 'payload'

import type { ${pluginConfigName} } from './types.js'

export const ${exportName} =
  (pluginConfig: ${pluginConfigName} = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const { enabled = true } = pluginConfig

    if (!enabled) {
      return incomingConfig
    }

    return {
      ...incomingConfig,
    }
  }

export default ${exportName}
`,
)

await writeFile(
  path.join(packageDir, 'src/index.ts'),
  `export { ${exportName} } from './plugin.js'
export type { ${pluginConfigName} } from './types.js'

export { ${exportName} as default } from './plugin.js'
`,
)

await writeFile(
  path.join(packageDir, 'src/exports/types.ts'),
  `export type { ${pluginConfigName} } from '../types.js'
`,
)

await writeFile(
  path.join(packageDir, `test/${name}.test.ts`),
  `import type { Config } from 'payload'
import { describe, expect, it } from 'vitest'

import { ${exportName} } from '../src/index.js'

describe('${exportName}', () => {
  it('returns the incoming config when enabled', () => {
    const inputConfig = {
      collections: [],
    } as unknown as Config

    const outputConfig = ${exportName}()(inputConfig)

    expect(outputConfig).toEqual(inputConfig)
  })

  it('returns the incoming config when disabled', () => {
    const inputConfig = {
      collections: [],
    } as unknown as Config

    const outputConfig = ${exportName}({ enabled: false })(inputConfig)

    expect(outputConfig).toEqual(inputConfig)
  })
})
`,
)

await writeFile(
  path.join(packageDir, 'README.md'),
  `# ${packageName}

PayloadCMS ${name} plugin.

## Install

\`\`\`bash
pnpm add ${packageName}
\`\`\`

## Usage

\`\`\`ts
import { buildConfig } from 'payload'
import { ${exportName} } from '${packageName}'

export default buildConfig({
  plugins: [${exportName}()],
  collections: []
})
\`\`\`
`,
)

console.log(`Created packages/${name}`)
