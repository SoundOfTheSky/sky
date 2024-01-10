import { spawnSync } from 'bun';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const STATIC = 'static';
const FE = '../sky-fe';
const FE_DIST = '../sky-fe/dist';
const STATICZIP = 'static.zip';

console.log('Deleting...');
for (const name of readdirSync(STATIC)) {
  if (name === 'static') continue;
  rmSync(join(STATIC, name), {
    recursive: true,
  });
}

rmSync(join(FE_DIST), {
  recursive: true,
});

console.log('Building...');
spawnSync(['npm', 'run', 'build'], {
  cwd: FE,
  stdout: 'inherit',
});

console.log('Copying...');
function copy(from: string, to: string) {
  for (const name of readdirSync(from, {
    encoding: null,
  })) {
    const f = join(from, name);
    const t = join(to, name);
    if (statSync(f).isDirectory()) {
      mkdirSync(t);
      copy(f, t);
    } else writeFileSync(t, readFileSync(f));
  }
}
copy(FE_DIST, STATIC);
console.log('Compressing...');
spawnSync(['zip', '-r', STATICZIP, '.'], {
  cwd: STATIC,
});
console.log('Uploading...');
const staticzip = join(STATIC, STATICZIP);
writeFileSync(join(process.env['DEPLOY_YD']!, STATICZIP), readFileSync(staticzip));
rmSync(staticzip);
