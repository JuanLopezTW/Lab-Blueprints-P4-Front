import axios from 'axios'

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 8000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Mensajes de error legibles (equivalentes a los del apimock)
const friendlyMessage = (err) => {
  if (!err.response) return 'No se pudo conectar con el servidor'
  if (err.response.status === 401) return 'Necesitas iniciar sesión para ver esta información'
  if (err.response.status === 403) return 'No tienes permisos para esta acción'
  return null
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      // Optionally redirect to login or clear token
      localStorage.removeItem('token')
    }
    err.message = friendlyMessage(err) || err.message
    return Promise.reject(err)
  },
)

// Servicio de Blueprints contra el API REST real (misma interfaz que apimock)
export const apiclient = {
  async getAll() {
    const { data } = await api.get('/blueprints')
    return data.data
  },
  async getByAuthor(author) {
    try {
      const { data } = await api.get(`/blueprints/${encodeURIComponent(author)}`)
      return data.data
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error(`No hay blueprints para el autor ${author}`)
      }
      throw err
    }
  },
  async getByAuthorAndName(author, name) {
    try {
      const { data } = await api.get(
        `/blueprints/${encodeURIComponent(author)}/${encodeURIComponent(name)}`,
      )
      return data.data
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error(`Blueprint ${author}/${name} no encontrado`)
      }
      throw err
    }
  },
  async create(blueprint) {
    const { data } = await api.post('/blueprints', blueprint)
    return data.data
  },
}

export default api
