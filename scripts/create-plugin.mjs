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
const optionsName = `${pascalName}PluginOptions`

const packageName = `@krameri/payload-plugin-${name}`
const packageDir = path.join(process.cwd(), 'packages', name)

if (existsSync(packageDir)) {
  console.error(`Package already exists: packages/${name}`)
  process.exit(1)
}

await mkdir(path.join(packageDir, 'src'), { recursive: true })
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
      main: './dist/index.mjs',
      types: './dist/index.d.mts',
      exports: {
        '.': {
          types: './dist/index.d.mts',
          import: './dist/index.mjs',
        },
      },
      files: ['dist', 'README.md'],
      sideEffects: false,
      scripts: {
        build: 'tsdown --entry src/index.ts --format esm --dts --out-dir dist --clean --deps.never-bundle payload',
        typecheck: 'tsc --noEmit',
        test: 'vitest run',
        dev: 'tsdown --entry src/index.ts --format esm --dts --out-dir dist --clean --deps.never-bundle payload --watch',
        clean: 'rm -rf dist',
      },
      peerDependencies: {
        payload: '^3.0.0',
      },
      devDependencies: {
        payload: '^3.0.0',
        tsdown: '0.22.2',
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
  path.join(packageDir, 'src/index.ts'),
  `import type { Config, Plugin } from 'payload'

export type ${optionsName} = {
  enabled?: boolean
}

export const ${exportName} = (
  options: ${optionsName} = {},
): Plugin => {
  const { enabled = true } = options

  return (incomingConfig: Config): Config => {
    if (!enabled) {
      return incomingConfig
    }

    return {
      ...incomingConfig,
    }
  }
}

export default ${exportName}
`,
)

await writeFile(
  path.join(packageDir, 'test/${name}-plugin.test.ts'),
  `import type { Config } from 'payload'
import { describe, expect, it } from 'vitest'

import { ${exportName} } from '../src/index.js'

describe('${exportName}', () => {
  it('returns the incoming config when enabled', async () => {
    const inputConfig = {
      collections: [],
    } as unknown as Config

    const outputConfig = await Promise.resolve(${exportName}()(inputConfig))

    expect(outputConfig).toEqual(inputConfig)
  })

  it('returns the incoming config when disabled', async () => {
    const inputConfig = {
      collections: [],
    } as unknown as Config

    const outputConfig = await Promise.resolve(
      ${exportName}({ enabled: false })(inputConfig),
    )

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
