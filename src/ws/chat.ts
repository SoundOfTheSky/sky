import { usersTable } from '@/services/session/user';
import { WS, subscribeWSEvent } from '@/services/ws';
import { server } from 'index';

type ChatMessage = {
  username: string;
  time: number;
  text: string;
  avatar?: string;
};
type MessageListener = (messages: ChatMessage[]) => unknown;
export type Subscriber = {
  username: string;
  listener: MessageListener;
  avatar?: string;
};
export class Chat {
  public history: ChatMessage[] = [];
  public historyLength = 20;
  public subscribers = 0;
  private lastAnonymousId = 1;

  constructor(public name: string) {
    subscribeWSEvent(name, this.onMessage.bind(this));
    subscribeWSEvent(name + 'Subscribe', this.onSubscribe.bind(this));
    subscribeWSEvent(name + 'Unsubscribe', this.onUnsubscribe.bind(this));
    subscribeWSEvent('close', this.onUnsubscribe.bind(this));
  }

  private onMessage(ws: WS, payload?: string) {
    if (!ws.data.chat) return ws.send('error [PublicChat] Not subscribed');
    if (!payload) return ws.send('error [PublicChat] Max message length is 256 characters');
    const text = payload.trim().replaceAll('\n', '');
    if (text.length > 256 || text.length === 0)
      return ws.send('error [PublicChat] Max message length is 256 characters');
    if (this.history.length === this.historyLength) this.history.shift();
    const message = { ...ws.data.chat, text, time: Date.now() } as ChatMessage;
    this.history.push(message);
    server.publish(this.name, `${this.name} ${JSON.stringify([message])}`);
  }

  private onSubscribe(ws: WS) {
    const user = ws.data.jwt.user && usersTable.get(ws.data.jwt.user.id);
    ws.data.chat = {
      username: user?.username ?? `Anonymous#${this.lastAnonymousId++}`,
      avatar: user?.avatar,
    };
    ws.subscribe(this.name);
    ws.send(`${this.name}Subscribe ${JSON.stringify(ws.data.chat)}`);
    ws.send(`${this.name} ${JSON.stringify(this.history)}`);
    this.subscribers++;
  }

  private onUnsubscribe(ws: WS) {
    ws.unsubscribe(this.name);
    delete ws.data.chat;
    this.subscribers--;
  }
}
export const publicChat = new Chat('publicChat');
publicChat.history.push({
  text: 'Welcome to the chat! Please be nice and have fun.',
  time: Date.now(),
  avatar:
    'https://sun2-4.userapi.com/s/v1/ig2/-g71IWaRAmuRgSuR-X2NBVTHZIBte5kRhY4AzldwwZeg9qywOmMVGwhuPJPkrd6sB2n_JmwtqpTPEzU_ZJ4ne1cp.jpg?size=244x244&quality=95&crop=12,9,244,244&ava=1',
  username: 'SoundOfTheSky',
});
