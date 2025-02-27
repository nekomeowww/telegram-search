<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuth } from '../apis/useAuth'
import { isDark } from '../composables/dark'
import { useSession } from '../composables/useSession'

const router = useRouter()
const { logout } = useAuth()
const { checkConnection, isConnected } = useSession()
const showUserMenu = ref(false)

// 检查用户是否已登录
onMounted(async () => {
  await checkConnection(false)
})

// 处理注销
async function handleLogout() {
  const success = await logout()
  if (success) {
    toast.success('已成功登出 Telegram')
    showUserMenu.value = false
    router.push('/login')
  }
  else {
    toast.error('登出失败，请重试')
  }
}

// 关闭菜单
function closeMenu() {
  showUserMenu.value = false
}
</script>

<template>
  <div class="min-h-screen" :class="{ dark: isDark }">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b bg-white transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900">
      <div class="mx-auto h-14 flex items-center justify-between px-4 container">
        <router-link to="/" class="text-lg font-semibold transition-colors duration-300 dark:text-white">
          Telegram Search
        </router-link>

        <div class="flex items-center gap-4">
          <ThemeToggle />

          <button
            class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            @click="router.push('/commands')"
          >
            <div class="i-carbon-mac-command h-5 w-5 dark:text-white" />
          </button>

          <button
            class="rounded-lg p-2 transition-colors duration-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            @click="router.push('/settings')"
          >
            <div class="i-carbon-settings h-5 w-5 transition-colors duration-300 dark:text-white" />
          </button>

          <!-- 用户头像与下拉菜单 -->
          <div class="relative">
            <button
              v-if="isConnected"
              class="h-8 w-8 flex items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-600"
              @click="showUserMenu = !showUserMenu"
            >
              <div class="i-carbon-user h-5 w-5" />
            </button>

            <!-- 用户菜单 -->
            <div
              v-if="showUserMenu && isConnected"
              class="absolute right-0 z-50 mt-2 w-48 border border-gray-200 rounded-md bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              @click.outside="closeMenu"
            >
              <div class="border-b border-gray-200 px-4 py-2 text-sm dark:border-gray-700">
                <div class="text-gray-700 font-medium dark:text-gray-200">
                  已连接到 Telegram
                </div>
              </div>
              <button
                class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                @click="handleLogout"
              >
                <div class="flex items-center">
                  <div class="i-carbon-logout mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="mx-auto bg-white transition-colors duration-300 container dark:bg-gray-900">
      <slot />
    </main>
  </div>
</template>
