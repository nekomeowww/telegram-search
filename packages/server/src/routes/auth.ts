import type { App, H3Event } from 'h3'

import { ErrorCode, getConfig, updateConfig, useLogger } from '@tg-search/common'
import { createRouter, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'

import { useTelegramClient } from '../services/telegram'
import { createResponse } from '../utils/response'

// Create logger instance
const logger = useLogger()

// Validation schemas
const sendCodeSchema = z.object({
  phoneNumber: z.string(),
  apiId: z.number().optional(),
  apiHash: z.string().optional(),
})

/**
 * Setup authentication routes
 */
export function setupAuthRoutes(app: App) {
  const router = createRouter()

  // Send verification code
  router.post('/send-code', defineEventHandler(async (event: H3Event) => {
    try {
      const body = await readBody(event)
      const validatedBody = sendCodeSchema.parse(body)

      logger.debug('Send code request received')

      const client = await useTelegramClient()

      if (await client.isConnected()) {
        logger.debug('Client already connected')
        return createResponse({ success: true })
      }

      // Update config if API credentials provided
      const config = getConfig()
      if (validatedBody.apiId && validatedBody.apiHash) {
        config.api.telegram = {
          apiId: validatedBody.apiId.toString(),
          apiHash: validatedBody.apiHash,
          phoneNumber: validatedBody.phoneNumber,
        }
        updateConfig(config)
      }

      await client.sendCode()
      logger.debug('Verification code sent')
      return createResponse({ success: true })
    }
    catch (error) {
      logger.withError(error).error('Failed to send verification code')
      return createResponse(undefined, error instanceof Error ? error : new Error('Failed to send code'))
    }
  }))

  // Login with code/password
  router.post('/login', defineEventHandler(async (event) => {
    const logger = useLogger()
    logger.debug('Login request received')

    try {
      const body = await readBody(event)
      const { code, password } = body

      const client = await useTelegramClient()

      if (code) {
        try {
          await client.connect({
            code: async () => code,
            password: async () => {
              if (!password) {
                throw new Error('2FA password required')
              }
              return password
            },
          })
        }
        catch (error) {
          if (error instanceof Error
            && (error.message.includes('password required')
              || error.message.includes('密码不能为空'))) {
            return createResponse(undefined, ErrorCode.NEED_TWO_FACTOR_CODE)
          }
          throw error
        }
      }
      else if (password) {
        await client.connect({
          password: async () => password,
        })
      }
      else {
        return createResponse(undefined, ErrorCode.INVALID_INPUT)
      }

      return createResponse({ success: true })
    }
    catch (error) {
      logger.withError(error).error('Login failed')
      return createResponse(undefined, error instanceof Error ? error : new Error('Login failed'))
    }
  }))

  // Check connection status
  router.get('/status', defineEventHandler(async () => {
    try {
      const client = await useTelegramClient()
      const connected = await client.isConnected()
      logger.debug(`Status check: connected=${connected}`)
      return createResponse({ connected })
    }
    catch (error) {
      logger.withError(error).error('Status check failed')
      return createResponse({ connected: false })
    }
  }))

  // Logout and clear session
  router.post('/logout', defineEventHandler(async () => {
    try {
      const client = await useTelegramClient()
      if (await client.isConnected()) {
        await client.logout()
        logger.debug('Logged out and cleared session')
      }
      return createResponse({ success: true })
    }
    catch (error) {
      logger.withError(error).error('Logout failed')
      return createResponse(undefined, error instanceof Error ? error : new Error('Logout failed'))
    }
  }))

  app.use('/auth', router.handler)
}
