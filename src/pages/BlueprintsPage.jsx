import { useEffect, useMemo, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchAuthors,
  fetchByAuthor,
  fetchBlueprint,
} from '../features/blueprints/blueprintsSlice.js'
import BlueprintCanvas from '../components/BlueprintCanvas.jsx'
import BlueprintForm from '../components/BlueprintForm.jsx'
import { useRealtime } from '../hooks/useRealtime.js'
import blueprintsService from '../services/blueprintsService.js'

export default function BlueprintsPage() {
  const dispatch = useDispatch()
  const { byAuthor, current, searchStatus, searchError } = useSelector((s) => s.blueprints)
  const [authorInput, setAuthorInput] = useState('')
  const [selectedAuthor, setSelectedAuthor] = useState('')
  const [rtMode, setRtMode] = useState('none') // 'none' | 'stomp'
  const [currentPoints, setCurrentPoints] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const items = byAuthor[selectedAuthor] || []

  useEffect(() => {
    dispatch(fetchAuthors())
  }, [dispatch])

  useEffect(() => {
    setCurrentPoints(current?.points || [])
  }, [current])

  const handleIncomingPoint = useCallback((msg) => {
    setCurrentPoints((prev) => [...prev, msg.point])
  }, [])

  const { connected, sendPoint } = useRealtime({
    author: current?.author,
    name: current?.name,
    enabled: rtMode === 'stomp' && !!current,
    onPoint: handleIncomingPoint,
  })

  const totalPoints = useMemo(
    () => items.reduce((acc, bp) => acc + (bp.points?.length || 0), 0),
    [items],
  )

  const getBlueprints = () => {
    if (!authorInput) return
    setSelectedAuthor(authorInput)
    dispatch(fetchByAuthor(authorInput))
  }

  const openBlueprint = (bp) => {
    dispatch(fetchBlueprint({ author: bp.author, name: bp.name }))
  }

  const handleCanvasClick = async (point) => {
    if (!current) return
    if (rtMode === 'stomp') {
      if (!connected) {
        alert('Conectando a tiempo real, espera un momento e intenta de nuevo')
        return
      }
      sendPoint(point)
    } else {
      try {
        await blueprintsService.addPoint(current.author, current.name, point)
        setCurrentPoints((prev) => [...prev, point])
      } catch (err) {
        alert('No se pudo guardar el punto: ' + err.message)
      }
    }
  }

  const handleDelete = async () => {
    if (!current) return
    if (!window.confirm(`¿Eliminar el plano "${current.name}"?`)) return
    try {
      await blueprintsService.remove(current.author, current.name)
      setCurrentPoints([])
      if (selectedAuthor) dispatch(fetchByAuthor(selectedAuthor))
    } catch (err) {
      alert('No se pudo eliminar: ' + err.message)
    }
  }

  const handleCreate = async ({ author, name, points }) => {
    try {
      await blueprintsService.create({ author, name, points: points || [] })
      setShowCreateForm(false)
      setAuthorInput(author)
      setSelectedAuthor(author)
      dispatch(fetchByAuthor(author))
    } catch (err) {
      alert('No se pudo crear el plano: ' + err.message)
    }
  }

  return (
    <div className="grid page-layout">
      <section className="grid" style={{ gap: 16 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Blueprints</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              className="input"
              placeholder="Autor"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
            />
            <button className="btn primary" onClick={getBlueprints}>
              Buscar planos
            </button>
          </div>
        </div>

        <div className="card">
          <button className="btn primary" onClick={() => setShowCreateForm((v) => !v)}>
            {showCreateForm ? 'Cancelar' : '+ Crear nuevo plano'}
          </button>
          {showCreateForm && <BlueprintForm onSubmit={handleCreate} />}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            {selectedAuthor ? `Planos de ${selectedAuthor}:` : 'Resultados'}
          </h3>
          {searchStatus === 'loading' && <p>Cargando...</p>}
          {searchStatus === 'failed' && (
            <p role="alert" className="alert-error">
              {searchError}
            </p>
          )}
          {searchStatus === 'succeeded' && !items.length && <p>Sin resultados.</p>}
          {!!items.length && (
            <div style={{ overflowX: 'auto' }}>
              <table className="list-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #334155' }}>
                      Nombre del plano
                    </th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #334155' }}>
                      Número de puntos
                    </th>
                    <th style={{ padding: '8px', borderBottom: '1px solid #334155' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((bp) => (
                    <tr key={bp.name}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #1f2937' }}>{bp.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #1f2937' }}>
                        <span className="badge">{bp.points?.length || 0}</span>
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #1f2937' }}>
                        <button className="btn" onClick={() => openBlueprint(bp)}>
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ marginTop: 12, fontWeight: 700 }}>Total de puntos: {totalPoints}</p>
        </div>
      </section>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0 }}>Plano actual: {current?.name || '—'}</h3>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 14 }}>
              Tiempo real:{' '}
              <select value={rtMode} onChange={(e) => setRtMode(e.target.value)} className="input">
                <option value="none">None</option>
                <option value="stomp">STOMP</option>
              </select>
            </label>
            {rtMode === 'stomp' && (
              <span style={{ fontSize: 12, color: connected ? '#4ade80' : '#f87171' }}>
                {connected ? '● conectado' : '○ conectando...'}
              </span>
            )}
            <button className="btn" onClick={handleDelete} disabled={!current}>
              Eliminar plano
            </button>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
          {current ? 'Haz clic en el canvas para agregar un punto.' : 'Abre un plano para empezar a dibujar.'}
        </p>

        <BlueprintCanvas points={currentPoints} onPointClick={current ? handleCanvasClick : undefined} />
      </section>
    </div>
  )
}