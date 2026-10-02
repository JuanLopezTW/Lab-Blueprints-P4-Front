import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import BlueprintCanvas from '../src/components/BlueprintCanvas.jsx'

describe('BlueprintCanvas', () => {
  it('renderiza un canvas y llama getContext', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    const { container } = render(
      <BlueprintCanvas
        points={[
          { x: 10, y: 10 },
          { x: 50, y: 60 },
        ]}
      />,
    )
    expect(container.querySelector('canvas')).toBeInTheDocument()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('llama a onPointClick con las coordenadas del clic', () => {
    const onPointClick = vi.fn()
    const { container } = render(
      <BlueprintCanvas points={[]} width={520} height={360} onPointClick={onPointClick} />,
    )
    const canvas = container.querySelector('canvas')

    canvas.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 520,
      height: 360,
    })

    fireEvent.click(canvas, { clientX: 100, clientY: 50 })

    expect(onPointClick).toHaveBeenCalledWith({ x: 100, y: 50 })
  })
})