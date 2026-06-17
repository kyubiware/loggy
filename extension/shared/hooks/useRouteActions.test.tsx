import { fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useRouteActions } from './useRouteActions'

interface TestComponentProps {
  initialRoutes?: string[]
  initialFilterEnabled?: boolean
  routeOptions: string[]
  autoIncludeRoutes: boolean
}

function TestComponent({
  initialRoutes = [],
  initialFilterEnabled = false,
  routeOptions,
  autoIncludeRoutes,
}: TestComponentProps): React.JSX.Element {
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(initialRoutes)
  const [routesFilterEnabled, setRoutesFilterEnabled] = useState(initialFilterEnabled)
  const actions = useRouteActions({
    setSelectedRoutes,
    setRoutesFilterEnabled,
    routeOptions,
    autoIncludeRoutes,
  })

  return (
    <div>
      <span data-testid="selected">{JSON.stringify(selectedRoutes)}</span>
      <span data-testid="flag">{String(routesFilterEnabled)}</span>
      <button data-testid="toggle-a" onClick={() => actions.toggleRoute('/a')}>
        toggle-a
      </button>
      <button data-testid="select-all" onClick={actions.selectAllRoutes}>
        select-all
      </button>
      <button data-testid="deselect-all" onClick={actions.deselectAllRoutes}>
        deselect-all
      </button>
      <button
        data-testid="toggle-routes"
        onClick={() => actions.toggleRoutes(['/a', '/b'], true)}
      >
        toggle-routes
      </button>
    </div>
  )
}

function getSelectedRoutes(): string[] {
  return JSON.parse(screen.getByTestId('selected').textContent ?? '[]')
}

function getFilterEnabled(): boolean {
  return screen.getByTestId('flag').textContent === 'true'
}

describe('useRouteActions', () => {
  describe('route selection', () => {
    it('auto-adds new routes when autoIncludeRoutes is true', () => {
      const { rerender } = render(
        <TestComponent routeOptions={['/a', '/b']} autoIncludeRoutes={true} />
      )

      expect(getSelectedRoutes()).toEqual(['/a', '/b'])

      rerender(<TestComponent routeOptions={['/a', '/b', '/c']} autoIncludeRoutes={true} />)

      expect(getSelectedRoutes()).toEqual(['/a', '/b', '/c'])
    })

    it('does not auto-add new routes when autoIncludeRoutes is false', () => {
      const { rerender } = render(
        <TestComponent
          initialRoutes={['/a', '/b']}
          routeOptions={['/a', '/b']}
          autoIncludeRoutes={false}
        />
      )

      expect(getSelectedRoutes()).toEqual(['/a', '/b'])

      rerender(
        <TestComponent
          initialRoutes={['/a', '/b']}
          routeOptions={['/a', '/b', '/c']}
          autoIncludeRoutes={false}
        />
      )

      expect(getSelectedRoutes()).toEqual(['/a', '/b'])
    })

    it('prunes stale routes when autoIncludeRoutes is false', () => {
      const { rerender } = render(
        <TestComponent
          initialRoutes={['/a', '/b']}
          routeOptions={['/a', '/b']}
          autoIncludeRoutes={false}
        />
      )

      expect(getSelectedRoutes()).toEqual(['/a', '/b'])

      rerender(<TestComponent initialRoutes={['/a', '/b']} routeOptions={['/a']} autoIncludeRoutes={false} />)

      expect(getSelectedRoutes()).toEqual(['/a'])
    })

    it('syncs all current routes when toggling autoIncludeRoutes from false to true', () => {
      const { rerender } = render(
        <TestComponent initialRoutes={['/a']} routeOptions={['/a', '/b']} autoIncludeRoutes={false} />
      )

      expect(getSelectedRoutes()).toEqual(['/a'])

      rerender(
        <TestComponent initialRoutes={['/a']} routeOptions={['/a', '/b']} autoIncludeRoutes={true} />
      )

      expect(getSelectedRoutes()).toEqual(['/a', '/b'])
    })
  })

  describe('routesFilterEnabled flag', () => {
    it('starts false and is NOT flipped by the autoInclude effect', () => {
      const { rerender } = render(
        <TestComponent routeOptions={['/a', '/b']} autoIncludeRoutes={true} />
      )

      // autoInclude populated routes, but flag should stay false
      expect(getSelectedRoutes()).toEqual(['/a', '/b'])
      expect(getFilterEnabled()).toBe(false)

      rerender(<TestComponent routeOptions={['/a', '/b', '/c']} autoIncludeRoutes={true} />)

      expect(getSelectedRoutes()).toEqual(['/a', '/b', '/c'])
      expect(getFilterEnabled()).toBe(false)
    })

    it('flips to true on toggleRoute', () => {
      render(<TestComponent routeOptions={['/a', '/b']} autoIncludeRoutes={false} />)

      expect(getFilterEnabled()).toBe(false)

      fireEvent.click(screen.getByTestId('toggle-a'))

      expect(getFilterEnabled()).toBe(true)
    })

    it('flips to true on selectAllRoutes', () => {
      render(<TestComponent routeOptions={['/a', '/b']} autoIncludeRoutes={false} />)

      expect(getFilterEnabled()).toBe(false)

      fireEvent.click(screen.getByTestId('select-all'))

      expect(getFilterEnabled()).toBe(true)
    })

    it('flips to true on deselectAllRoutes', () => {
      render(
        <TestComponent
          initialRoutes={['/a', '/b']}
          routeOptions={['/a', '/b']}
          autoIncludeRoutes={false}
        />
      )

      expect(getFilterEnabled()).toBe(false)

      fireEvent.click(screen.getByTestId('deselect-all'))

      expect(getFilterEnabled()).toBe(true)
      expect(getSelectedRoutes()).toEqual([])
    })

    it('flips to true on toggleRoutes', () => {
      render(<TestComponent routeOptions={['/a', '/b']} autoIncludeRoutes={false} />)

      expect(getFilterEnabled()).toBe(false)

      fireEvent.click(screen.getByTestId('toggle-routes'))

      expect(getFilterEnabled()).toBe(true)
    })
  })
})
