import { subscribeWSEvent } from '@/services/routing/web-socket'

let clicks = 0
subscribeWSEvent('subscribeClicker', (ws) => {
  ws.subscribe('clicker')
  ws.send(`clicker ${clicks}`)
})
subscribeWSEvent('unsubscribeClicker', (ws) => {
  ws.unsubscribe('clicker')
})
subscribeWSEvent('clickerClick', () => clicks++)
setInterval(() => {
  clicks = Math.floor(clicks * 0.9)
  globalThis.server?.publish('clicker', `clicker ${clicks}`)
}, 10_000)
