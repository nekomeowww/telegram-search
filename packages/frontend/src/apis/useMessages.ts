import type { TelegramChat, TelegramMessage } from '@tg-search/core'
import type { PaginationParams } from '@tg-search/server/types'

import { ref } from 'vue'

import { apiFetch, useApi } from '../composables/api'

/**
 * Vue composable for managing messages state and operations
 */
export function useMessages() {
  const messages = ref<TelegramMessage[]>([])
  const chat = ref<TelegramChat>()
  const total = ref(0)
  const { loading, error, request } = useApi()

  /**
   * Load messages from a specific chat
   */
  async function loadMessages(chatId: number, params?: PaginationParams): Promise<void> {
    try {
      const data = await request<{
        items: TelegramMessage[]
        chat: TelegramChat
        total: number
        limit: number
        offset: number
      }>(() =>
        apiFetch(
          `/messages/${chatId}${params ? `?${new URLSearchParams(params as any)}` : ''}`,
        ),
      )

      messages.value = data.items
      total.value = data.total
      chat.value = data.chat
    }
    catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  return {
    messages,
    loading,
    error,
    total,
    chat,
    loadMessages,
  }
}
