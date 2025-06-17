import { Readable as NodeReadable } from 'node:stream'

export function webToNodeStream(stream: ReadableStream) {
  const reader = stream.getReader()

  return new NodeReadable({
    async read() {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { value, done } = await reader.read()
      this.push(done ? null : value)
    },
  })
}
