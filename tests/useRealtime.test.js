import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/stompClient.js', () => {
  const subscribeMock = vi.fn()
  const publishMock = vi.fn()
  const unsubscribeMock = vi.fn()

  return {
    connectStomp: vi.fn((onConnect) => {
      const fakeClient = {
        active: true,
        subscribe: subscribeMock.mockImplementation((topic, callback) => {
          fakeClient._lastCallback = callback
          return { unsubscribe: unsubscribeMock }
        }),
        publish: publishMock,
      }
      onConnect(fakeClient)
      return fakeClient
    }),
    getStompClient: vi.fn(() => ({
      active: true,
      publish: publishMock,
    })),
    __mocks: { subscribeMock, publishMock, unsubscribeMock },
  }
})

import { useRealtime } from '../src/hooks/useRealtime.js'
import * as stompClient from '../src/services/stompClient.js'

describe('useRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no se conecta si enabled es false', () => {
    renderHook(() =>
      useRealtime({ author: 'john', name: 'house', enabled: false, onPoint: vi.fn() }),
    )
    expect(stompClient.connectStomp).not.toHaveBeenCalled()
  })

  it('se suscribe al tópico correcto cuando está habilitado', () => {
    renderHook(() =>
      useRealtime({ author: 'john', name: 'house', enabled: true, onPoint: vi.fn() }),
    )
    expect(stompClient.connectStomp).toHaveBeenCalled()
  })

  it('sendPoint publica en /app/draw con el payload correcto', () => {
    const { result } = renderHook(() =>
      useRealtime({ author: 'john', name: 'house', enabled: true, onPoint: vi.fn() }),
    )

    act(() => {
      result.current.sendPoint({ x: 10, y: 20 })
    })

    const client = stompClient.getStompClient()
    expect(client.publish).toHaveBeenCalledWith({
      destination: '/app/draw',
      body: JSON.stringify({ author: 'john', name: 'house', point: { x: 10, y: 20 } }),
    })
  })

  it('sendPoint no hace nada si enabled es false', () => {
    const { result } = renderHook(() =>
      useRealtime({ author: 'john', name: 'house', enabled: false, onPoint: vi.fn() }),
    )

    act(() => {
      result.current.sendPoint({ x: 1, y: 1 })
    })

    const client = stompClient.getStompClient()
    expect(client.publish).not.toHaveBeenCalled()
  })
})