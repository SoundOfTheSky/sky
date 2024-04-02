import server from '@/index';
import { subscribeWSEvent } from '@/services/ws';

let clicks = 0;
subscribeWSEvent('subscribeClicker', (ws) => {
  ws.subscribe('clicker');
  ws.send(`clicker ${clicks}`);
});
subscribeWSEvent('unsubscribeClicker', (ws) => {
  ws.unsubscribe('clicker');
});
subscribeWSEvent('clickerClick', () => clicks++);
setInterval(() => {
  clicks = Math.floor(clicks * 0.9);
  server.publish('clicker', `clicker ${clicks}`);
}, 10000);
