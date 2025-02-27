import type { ApiResponse, ErrorResponse, SuccessResponse } from '../types'

import { ErrorCode } from '@tg-search/common'

/**
 * Create standardized response
 */
export function createResponse<T>(
  data?: T,
  error?: Error | string | ErrorCode,
  pagination?: SuccessResponse<T>['pagination'],
): ApiResponse<T> {
  if (error) {
    let responseError
    let responseCode
    switch (true) {
      case error instanceof Error:
        responseError = error.message
        responseCode = error.name
        break
      case Object.values(ErrorCode).includes(error as ErrorCode):
        responseError = error
        responseCode = error
        break
      case typeof error === 'string':
        responseError = error
        responseCode = ErrorCode.UNKNOWN_ERROR
        break
      default:
        responseError = 'Unknown error'
        responseCode = ErrorCode.UNKNOWN_ERROR
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: responseError,
      code: responseCode,
      timestamp: new Date().toISOString(),
    }

    // Add additional error details if available
    if (error instanceof Error && (error as any).details) {
      errorResponse.details = (error as any).details
    }

    return errorResponse
  }

  return {
    success: true,
    data: data as T,
    timestamp: new Date().toISOString(),
    pagination,
  }
}
