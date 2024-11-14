import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import Path from 'node:path'

import { spawnSync } from 'bun'

const STATIC = 'static'
const FE = '../sky-fe'
const FE_DIST = '../sky-fe/dist'
const STATICZIP = 'static.zip'

console.log('Deleting...')
for (const name of readdirSync(STATIC)) {
  if (name === 'static') continue
  rmSync(Path.join(STATIC, name), {
    recursive: true,
  })
}

rmSync(Path.join(FE_DIST), {
  recursive: true,
})

console.log('Building...')
spawnSync(['npm', 'run', 'build'], {
  cwd: FE,
  stdout: 'inherit',
})

console.log('Copying...')
function copy(from: string, to: string) {
  for (const name of readdirSync(from, {
    encoding: null,
  })) {
    const f = Path.join(from, name)
    const t = Path.join(to, name)
    if (statSync(f).isDirectory()) {
      mkdirSync(t)
      copy(f, t)
    }
    else writeFileSync(t, readFileSync(f) as unknown as Uint8Array)
  }
}
copy(FE_DIST, STATIC)
console.log('Compressing...')
spawnSync(['zip', '-r', STATICZIP, '.'], {
  cwd: STATIC,
})
console.log('Uploading...')
const staticzip = Path.join(STATIC, STATICZIP)
writeFileSync(
  Path.join(process.env.DEPLOY_YD!, STATICZIP),
  readFileSync(staticzip) as unknown as Uint8Array,
)
rmSync(staticzip)
