import { render, screen } from '@testing-library/react'
import type React from 'react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useRouteActions } from './useRouteActions'

interface TestComponentProps {
  initialRoutes?: string[]
  routeOptions: string[]
  autoIncludeRoutes: boolean
}

function TestComponent({
  initialRoutes = [],
  routeOptions,
  autoIncludeRoutes,
}: TestComponentProps): React.JSX.Element {
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(initialRoutes)
  useRouteActions({ setSelectedRoutes, routeOptions, autoIncludeRoutes })
  return (
    <div>
      <span data-testid="selected">{JSON.stringify(selectedRoutes)}</span>
    </div>
  )
}

function getSelectedRoutes(): string[] {
  return JSON.parse(screen.getByTestId('selected').textContent ?? '[]')
}

describe('useRouteActions', () => {
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

    rerender(
      <TestComponent initialRoutes={['/a', '/b']} routeOptions={['/a']} autoIncludeRoutes={false} />
    )

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
