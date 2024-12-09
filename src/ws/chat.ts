import { usersTable } from '@/services/session/users'
import { WS, subscribeWSEvent } from '@/services/ws'

type ChatMessage = {
  username: string
  time: number
  text: string
  avatar?: string
}
type MessageListener = (messages: ChatMessage[]) => unknown
export type Subscriber = {
  username: string
  listener: MessageListener
  avatar?: string
}
export class Chat {
  public history: ChatMessage[] = []
  public historyLength = 20
  public subscribers = 0
  protected lastAnonymousId = 1

  public constructor(public name: string) {
    subscribeWSEvent(name, this.onMessage.bind(this))
    subscribeWSEvent(name + 'Subscribe', this.onSubscribe.bind(this))
    subscribeWSEvent(name + 'Unsubscribe', this.onUnsubscribe.bind(this))
    subscribeWSEvent('close', this.onUnsubscribe.bind(this))
  }

  protected onMessage(ws: WS, payload?: string) {
    if (!ws.data.chat) return ws.send('error [PublicChat] Not subscribed')
    if (!payload)
      return ws.send('error [PublicChat] Max message length is 255 characters')
    const text = payload.trim().replaceAll('\n', '')
    if (text.length > 255 || text.length === 0)
      return ws.send('error [PublicChat] Max message length is 255 characters')
    if (this.history.length === this.historyLength) this.history.shift()
    const message = { ...ws.data.chat, text, time: Date.now() } as ChatMessage
    this.history.push(message)
    server!.publish(this.name, `${this.name} ${JSON.stringify([message])}`)
  }

  protected onSubscribe(ws: WS) {
    const user = ws.data.jwt.user && usersTable.getById(ws.data.jwt.user.id)
    ws.data.chat = {
      username: user?.username ?? `Anonymous#${this.lastAnonymousId++}`,
      avatar: user?.avatar,
    }
    ws.subscribe(this.name)
    ws.send(`${this.name}Subscribe ${JSON.stringify(ws.data.chat)}`)
    ws.send(`${this.name} ${JSON.stringify(this.history)}`)
    this.subscribers++
  }

  protected onUnsubscribe(ws: WS) {
    ws.unsubscribe(this.name)
    delete ws.data.chat
    this.subscribers--
  }
}
export const publicChat = new Chat('publicChat')
publicChat.history.push({
  text: 'Welcome to the chat! Please be nice and have fun.',
  time: Date.now(),
  avatar:
    'https://sun2-4.userapi.com/s/v1/ig2/-g71IWaRAmuRgSuR-X2NBVTHZIBte5kRhY4AzldwwZeg9qywOmMVGwhuPJPkrd6sB2n_JmwtqpTPEzU_ZJ4ne1cp.jpg?size=244x244&quality=95&crop=12,9,244,244&ava=1',
  username: 'SoundOfTheSky',
})
