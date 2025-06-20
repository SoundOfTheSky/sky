import { log } from '@softsky/utils'

import { visitEmitter, visitsStats } from '@/services/session/session'
import { subscribeWSEvent } from '@/services/routing/web-socket'

let online = 0
subscribeWSEvent('subscribeServerStats', (ws) => {
  ws.subscribe('serverStats')
  ws.send(
    `serverStats ${visitsStats.uniqueVisits}|${visitsStats.visits}|${online}`,
  )
})
subscribeWSEvent('unsubscribeServerStats', (ws) => {
  ws.unsubscribe('serverStats')
})
subscribeWSEvent('close', (ws) => {
  online--
  ws.unsubscribe('serverStats')
  broadcastServerStats()
})
subscribeWSEvent('open', () => {
  online++
  broadcastServerStats()
})

function broadcastServerStats() {
  log(`[STATS] ${visitsStats.uniqueVisits}|${visitsStats.visits}|${online}`)
  server?.publish(
    'serverStats',
    `serverStats ${visitsStats.uniqueVisits}|${visitsStats.visits}|${online}`,
  )
}
visitEmitter.on('update', broadcastServerStats)
