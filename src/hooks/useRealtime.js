import { useEffect, useRef, useState, useCallback } from 'react'
import { connectStomp, getStompClient } from '../services/stompClient.js'

export function useRealtime({ author, name, enabled = true, onPoint }) {
  const [connected, setConnected] = useState(false)
  const subscriptionRef = useRef(null)
  const onPointRef = useRef(onPoint)

  onPointRef.current = onPoint

  useEffect(() => {
    if (!enabled || !author || !name) return

    let active = true

    connectStomp((client) => {
      if (!active) return
      setConnected(true)

      const topic = `/topic/blueprints.${author}.${name}`
      subscriptionRef.current = client.subscribe(topic, (message) => {
        try {
          const body = JSON.parse(message.body)
          onPointRef.current?.(body)
        } catch (e) {
          console.error('Mensaje STOMP inválido', e)
        }
      })
    })

    return () => {
      active = false
      subscriptionRef.current?.unsubscribe()
      subscriptionRef.current = null
      setConnected(false)
    }
  }, [author, name, enabled])

  const sendPoint = useCallback(
    (point) => {
      if (!enabled || !author || !name) return
      const client = getStompClient()
      if (!client.active) return
      client.publish({
        destination: '/app/draw',
        body: JSON.stringify({ author, name, point }),
      })
    },
    [author, name, enabled],
  )

  return { connected, sendPoint }
}