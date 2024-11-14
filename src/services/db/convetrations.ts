import { DBDataType } from '@/services/db/types'

export const convertToBoolean = (data: boolean | undefined | null) =>
  typeof data === 'boolean' ? +data : data
export const convertFromBoolean = (data: DBDataType) =>
  typeof data === 'number' ? !!data : undefined
export const convertToArray = (data: number[] | string[] | undefined | null) =>
  data?.join('|')
export const convertFromArray = (data: DBDataType) =>
  typeof data === 'string' ? data.split('|') : undefined
export const convertFromNumberArray = (data: DBDataType) =>
  typeof data === 'string' ? data.split('|').map(element => +element) : undefined
export function convertToDate(
  d: Date | string | undefined | null,
): string | null | undefined {
  if (typeof d === 'string') return convertToDate(new Date(d))
  if (d instanceof Date)
    return `${d.getUTCFullYear()}-${`${d.getUTCMonth() + 1}`.padStart(2, '0')}-${d
      .getUTCDate()
      .toString()
      .padStart(2, '0')} ${d.getUTCHours().toString().padStart(2, '0')}:${d
      .getUTCMinutes()
      .toString()
      .padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}`
  return d
}
export const convertFromDate = (data: DBDataType) =>
  typeof data === 'string' ? new Date(data + 'Z') : undefined
