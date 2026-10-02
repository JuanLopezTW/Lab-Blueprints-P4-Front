import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => {
  const put = vi.fn()
  const del = vi.fn()
  const get = vi.fn()
  const post = vi.fn()
  const mockAxiosInstance = {
    get,
    post,
    put,
    delete: del,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  }
})

import axios from 'axios'
import { apiclient } from '../src/services/apiClient.js'

describe('apiclient - addPoint y remove', () => {
  let axiosInstance

  beforeEach(() => {
    vi.clearAllMocks()
    axiosInstance = axios.create()
  })

  it('addPoint llama PUT a la ruta correcta con el punto como body', async () => {
    axiosInstance.put.mockResolvedValue({ data: { data: { x: 5, y: 5 } } })

    const result = await apiclient.addPoint('john', 'house', { x: 5, y: 5 })

    expect(axiosInstance.put).toHaveBeenCalledWith('/blueprints/john/house/points', { x: 5, y: 5 })
    expect(result).toEqual({ x: 5, y: 5 })
  })

  it('remove llama DELETE a la ruta correcta', async () => {
    axiosInstance.delete.mockResolvedValue({ data: { data: null } })

    await apiclient.remove('john', 'house')

    expect(axiosInstance.delete).toHaveBeenCalledWith('/blueprints/john/house')
  })
})