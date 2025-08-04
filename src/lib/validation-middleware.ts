import { z } from 'zod'

// Type definitions to avoid dependency on @netlify/functions
interface HandlerEvent {
  body: string | null
  headers: Record<string, string>
  httpMethod: string
  path: string
  queryStringParameters: Record<string, string> | null
}

interface HandlerResponse {
  statusCode: number
  body: string
  headers?: Record<string, string>
}

export class ValidationError extends Error {
  field?: string
  
  constructor(message: string, field?: string) {
    super(message)
    this.name = 'ValidationError'
    this.field = field
  }
}

/**
 * Validation middleware for Netlify functions
 * Wraps handler to validate request body against schema
 */
export function withValidation<T>(
  schema: z.ZodSchema<T>,
  handler: (event: HandlerEvent, data: T) => Promise<HandlerResponse>
) {
  return async (event: HandlerEvent): Promise<HandlerResponse> => {
    try {
      const body = JSON.parse(event.body || '{}')
      const result = schema.safeParse(body)
      
      if (!result.success) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Validation failed',
            details: result.error.errors,
          }),
        }
      }
      
      return handler(event, result.data)
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request body',
        }),
      }
    }
  }
}