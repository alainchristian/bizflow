import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Theme } from '@radix-ui/themes'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App.tsx'

describe('App', () => {
  it('renders the home page by default', () => {
    render(
      <Theme>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </Theme>,
    )

    expect(screen.getByText('Welcome to BizFlow')).toBeInTheDocument()
  })
})
