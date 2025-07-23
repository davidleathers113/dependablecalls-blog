import React from 'react'
import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { AllTheProviders } from './providers'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
}

const customRender = (ui: React.ReactElement, options: CustomRenderOptions = {}) => {
  const { queryClient, ...renderOptions } = options

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient}>{children}</AllTheProviders>
    ),
    ...renderOptions,
  })
}

// Re-export specific exports instead of using export *
export {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
  configure,
  prettyDOM,
  queries,
  queryHelpers,
  getDefaultNormalizer,
  getRoles,
  getQueriesForElement,
  getNodeText,
  findAllByDisplayValue,
  findByDisplayValue,
  getAllByDisplayValue,
  getByDisplayValue,
  queryAllByDisplayValue,
  queryByDisplayValue,
  findAllByRole,
  findByRole,
  getAllByRole,
  getByRole,
  queryAllByRole,
  queryByRole,
  findAllByTestId,
  findByTestId,
  getAllByTestId,
  getByTestId,
  queryAllByTestId,
  queryByTestId,
  findAllByText,
  findByText,
  getAllByText,
  getByText,
  queryAllByText,
  queryByText,
  findAllByTitle,
  findByTitle,
  getAllByTitle,
  getByTitle,
  queryAllByTitle,
  queryByTitle,
  findAllByLabelText,
  findByLabelText,
  getAllByLabelText,
  getByLabelText,
  queryAllByLabelText,
  queryByLabelText,
  findAllByPlaceholderText,
  findByPlaceholderText,
  getAllByPlaceholderText,
  getByPlaceholderText,
  queryAllByPlaceholderText,
  queryByPlaceholderText,
  findAllByAltText,
  findByAltText,
  getAllByAltText,
  getByAltText,
  queryAllByAltText,
  queryByAltText,
  buildQueries,
  createEvent,
  isInaccessible,
} from '@testing-library/react'

export { customRender as render }
