import { Client } from '@stomp/stompjs'

const STOMP_BASE = import.meta.env.VITE_STOMP_BASE || 'ws://localhost:8080/ws-blueprints'

let client = null

export function getStompClient() {
  if (client) return client

  client = new Client({
    brokerURL: STOMP_BASE,
    reconnectDelay: 4000,
    debug: () => {},
  })

  return client
}

export function connectStomp(onConnectCallback) {
  const c = getStompClient()
  if (c.active) {
      if (onConnectCallback) onConnectCallback(c)
    return c
  }
  c.onConnect = () => {
    if (onConnectCallback) onConnectCallback(c)
  }
  c.activate()
  return c
}

export function disconnectStomp() {
  if (client && client.active) {
    client.deactivate()
  }
}