/* eslint-disable no-var */
import type { Server } from 'bun'

export declare global {
  var server: Server | undefined
  var someProperty: number
}
export {}
