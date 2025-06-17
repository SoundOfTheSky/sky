import Path from 'node:path'

import { FileSystemRouter } from 'bun'

import { RouterHandler } from '@/services/routing/types'

const router = new FileSystemRouter({
  style: 'nextjs',
  dir: Path.join(import.meta.dir, '../../routes'),
  origin: import.meta.dir,
})
const handlers = new Map(
  await Promise.all(
    Object.entries(router.routes).map(
      async ([key, value]) =>
        [
          key,
          (await import(
            Path.relative(import.meta.dir, value)
          )) as RouterHandler,
        ] as const,
    ),
  ),
)
export function getRoute(url: string) {
  const routerResult = router.match(url)!
  const handler = handlers.get(routerResult.name)!
  return { handler, query: routerResult.query, parameters: routerResult.params }
}
