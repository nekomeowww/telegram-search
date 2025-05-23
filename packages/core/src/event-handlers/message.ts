import type { Api } from 'telegram'
import type { CoreContext } from '../context'
import type { MessageService } from '../services'

import { useLogger } from '@tg-search/common'
import { useConfig } from '@tg-search/common/composable'

export function registerMessageEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:message:event')

  return (messageService: MessageService) => {
    emitter.on('message:process', ({ messages }) => {
      messageService.processMessages(messages)
    })

    emitter.on('message:fetch', async ({ chatId, pagination }) => {
      logger.withFields({ chatId }).verbose('Fetching messages')
      const batchSize = useConfig().message.batch.size

      let messages: Api.Message[] = []
      for await (const message of messageService.fetchMessages(chatId, { pagination })) {
        messages.push(message)

        if (messages.length >= batchSize) {
          emitter.emit('message:process', { messages })
          messages = []
        }
      }

      if (messages.length > 0) {
        emitter.emit('message:process', { messages })
      }
    })

    emitter.on('message:send', async ({ chatId, content }) => {
      logger.withFields({ chatId, content }).verbose('Sending message')
      const message = await messageService.sendMessage(chatId, content)
      logger.withFields({ message }).verbose('Message sent')
    })
  }
}
