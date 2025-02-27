<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuth } from '../apis/useAuth'
import { useConfig } from '../apis/useConfig'
import { ErrorCode } from '../types/error'

// State management
interface LoginState {
  isLoading: boolean
  isConnected: boolean
  error: string | null
  phoneNumber: string
  verificationCode: string
  twoFactorPassword: string
  needPhoneNumber: boolean
  needCode: boolean
  needPassword: boolean
  showAdvancedSettings: boolean
  apiId: string
  apiHash: string
}

const state = ref<LoginState>({
  isLoading: false,
  isConnected: false,
  error: null,
  phoneNumber: '',
  verificationCode: '',
  twoFactorPassword: '',
  needPhoneNumber: true,
  needCode: false,
  needPassword: false,
  showAdvancedSettings: false,
  apiId: '',
  apiHash: ''
})

const router = useRouter()
const { checkStatus, login, sendCode } = useAuth()
const { config, getConfig } = useConfig()

// Return path for redirect after login
const returnPath = ref('/')

// Computed properties
const canSubmit = computed(() => {
  const { needPhoneNumber, needCode, needPassword, phoneNumber, verificationCode, twoFactorPassword } = state.value
  
  if (needPhoneNumber && !phoneNumber) return false
  if (needCode && !verificationCode) return false
  if (needPassword && !twoFactorPassword) return false
  
  return true
})

// Initialization
onMounted(async () => {
  await initializeLoginPage()
})

async function initializeLoginPage() {
  // Get redirect path if exists
  const { redirect } = router.currentRoute.value.query
  if (redirect && typeof redirect === 'string') {
    returnPath.value = redirect
  }

  await getConfig()
  initializeFromConfig()
  await checkLoginStatus()
}

function initializeFromConfig() {
  if (config.value?.api?.telegram) {
    const { apiId, apiHash, phoneNumber } = config.value.api.telegram
    state.value.apiId = apiId || ''
    state.value.apiHash = apiHash || ''
    
    if (phoneNumber && !state.value.phoneNumber) {
      state.value.phoneNumber = phoneNumber
    }
  }
}

// Login flow handlers
async function checkLoginStatus() {
  state.value.isLoading = true
  state.value.error = null

  try {
    state.value.isConnected = await checkStatus()

    if (state.value.isConnected) {
      handleSuccessfulConnection()
    }
  }
  catch (err) {
    console.error('Failed to check login status', err)
  }
  finally {
    state.value.isLoading = false
  }
}

async function requestVerificationCode() {
  const { phoneNumber, isLoading } = state.value
  if (!phoneNumber || isLoading) return

  state.value.isLoading = true
  state.value.error = null

  try {
    const options = getApiOptions()
    await sendCode(phoneNumber, options)
    
    updateLoginStep('code')
    toast.success('验证码已发送到您的设备')
  }
  catch (err) {
    handleError(err, '请求验证码失败，请重试')
  }
  finally {
    state.value.isLoading = false
  }
}

async function submitVerificationCode() {
  const { verificationCode, isLoading } = state.value
  if (!verificationCode || isLoading) return

  state.value.isLoading = true
  state.value.error = null

  try {
    const options = {
      code: verificationCode,
      phoneNumber: state.value.phoneNumber,
      ...getApiOptions()
    }

    const success = await login(options)

    if (success) {
      handleSuccessfulConnection()
      state.value.needCode = false
    }
  }
  catch (err) {
    handleLoginError(err)
  }
  finally {
    state.value.isLoading = false
  }
}

async function submitTwoFactorPassword() {
  const { twoFactorPassword, verificationCode, isLoading } = state.value
  if (!twoFactorPassword || isLoading) return

  state.value.isLoading = true
  state.value.error = null

  try {
    const options = {
      password: twoFactorPassword,
      code: verificationCode,
      ...getApiOptions()
    }

    const success = await login(options)

    if (success) {
      handleSuccessfulConnection()
      updateLoginStep('complete')
    }
  }
  catch (err) {
    handleError(err, '密码验证失败，请重试', '密码验证失败: ')
  }
  finally {
    state.value.isLoading = false
  }
}

// Helper functions
function getApiOptions() {
  if (!state.value.showAdvancedSettings) return {}

  return {
    apiId: Number(state.value.apiId) || (config.value?.api?.telegram?.apiId ? Number(config.value.api.telegram.apiId) : undefined),
    apiHash: state.value.apiHash || config.value?.api?.telegram?.apiHash
  }
}

function handleSuccessfulConnection() {
  toast.success('连接成功！')
  state.value.isConnected = true
  
  setTimeout(() => {
    router.push(returnPath.value)
  }, 1500)
}

function handleLoginError(err: unknown) {
  if (err instanceof Error) {
    state.value.error = err.message

    if (err.message === ErrorCode.NEED_TWO_FACTOR_CODE) {
      updateLoginStep('password')
      state.value.error = '需要输入两步验证密码'
      toast.info('需要输入两步验证密码以完成登录')
    }
    else {
      toast.error(`登录失败: ${err.message}`)
    }
  }
  else {
    handleError(err, '验证失败，请重试')
  }
}

function handleError(err: unknown, defaultMessage: string, prefix = '') {
  if (err instanceof Error) {
    state.value.error = err.message
    toast.error(`${prefix}${err.message}`)
  }
  else {
    state.value.error = defaultMessage
    toast.error(defaultMessage)
  }
}

function updateLoginStep(step: 'phone' | 'code' | 'password' | 'complete') {
  state.value.needPhoneNumber = step === 'phone'
  state.value.needCode = step === 'code'
  state.value.needPassword = step === 'password'
}

// UI handlers
function retryLogin() {
  Object.assign(state.value, {
    error: null,
    phoneNumber: '',
    verificationCode: '',
    twoFactorPassword: '',
    needPhoneNumber: true,
    needCode: false,
    needPassword: false
  })
}

function handleLogin() {
  const { needPassword, needCode, needPhoneNumber } = state.value
  
  if (needPassword) {
    submitTwoFactorPassword()
  }
  else if (needCode) {
    submitVerificationCode()
  }
  else if (needPhoneNumber) {
    requestVerificationCode()
  }
}

function toggleAdvancedSettings() {
  state.value.showAdvancedSettings = !state.value.showAdvancedSettings
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900 lg:px-8 sm:px-6">
    <div class="max-w-md w-full space-y-8">
      <!-- 标题 -->
      <div class="text-center">
        <h2 class="text-3xl text-gray-900 font-extrabold tracking-tight dark:text-white">
          连接 Telegram
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          连接您的 Telegram 账户以同步和导出消息
        </p>
      </div>

      <div class="rounded-md bg-white px-6 py-8 shadow-md dark:bg-gray-800">
        <!-- 已连接状态 -->
        <div v-if="state.isConnected" class="rounded-md bg-green-50 p-4 dark:bg-green-900/30">
          <div class="flex">
            <div class="flex-shrink-0">
              <div class="i-carbon-checkmark-filled h-5 w-5 text-green-400" aria-hidden="true" />
            </div>
            <div class="ml-3">
              <p class="text-sm text-green-800 font-medium dark:text-green-200">
                已成功连接到 Telegram
              </p>
              <p class="mt-2 text-sm text-green-700 dark:text-green-300">
                正在返回...
              </p>
            </div>
          </div>
        </div>

        <!-- 登录表单 -->
        <div v-else>
          <form class="space-y-6" @submit.prevent="handleLogin">
            <!-- 错误信息显示 -->
            <div v-if="state.error" class="rounded-md bg-red-50 p-4 dark:bg-red-900/30">
              <div class="flex">
                <div class="flex-shrink-0">
                  <div class="i-carbon-warning-alt h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div class="ml-3">
                  <h3 class="text-sm text-red-800 font-medium dark:text-red-200">
                    连接出错
                  </h3>
                  <div class="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>{{ state.error }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 手机号输入框 (步骤0) -->
            <div v-if="state.needPhoneNumber">
              <label for="phone" class="block text-sm text-gray-700 font-medium dark:text-gray-300">
                Telegram 手机号
              </label>
              <div class="mt-1">
                <input
                  id="phone"
                  v-model="state.phoneNumber"
                  name="phone"
                  type="tel"
                  required
                  class="block w-full appearance-none border border-gray-300 rounded-md px-3 py-2 shadow-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 sm:text-sm dark:text-white focus:outline-none focus:ring-blue-500 placeholder-gray-400"
                  placeholder="+86 123456789"
                >
              </div>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                请输入您的 Telegram 账户关联的手机号，包含国家/地区代码
              </p>
            </div>

            <!-- 验证码输入框 (步骤1) -->
            <div v-if="state.needCode">
              <label for="code" class="block text-sm text-gray-700 font-medium dark:text-gray-300">
                验证码
              </label>
              <div class="mt-1">
                <input
                  id="code"
                  v-model="state.verificationCode"
                  name="code"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  required
                  class="block w-full appearance-none border border-gray-300 rounded-md px-3 py-2 shadow-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 sm:text-sm dark:text-white focus:outline-none focus:ring-blue-500 placeholder-gray-400"
                  placeholder="请输入您收到的验证码"
                >
              </div>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Telegram 已向您的设备发送了验证码，请输入以继续
              </p>
            </div>

            <!-- 两步验证密码输入框 (步骤2) -->
            <div v-if="state.needPassword">
              <label for="password" class="block text-sm text-gray-700 font-medium dark:text-gray-300">
                两步验证密码
              </label>
              <div class="mt-1">
                <input
                  id="password"
                  v-model="state.twoFactorPassword"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  class="block w-full appearance-none border border-gray-300 rounded-md px-3 py-2 shadow-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 sm:text-sm dark:text-white focus:outline-none focus:ring-blue-500 placeholder-gray-400"
                  placeholder="请输入您的两步验证密码"
                >
              </div>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                需要您的两步验证密码以完成登录
              </p>
            </div>

            <!-- 高级设置折叠面板 -->
            <div class="mt-4">
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  class="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                  @click="toggleAdvancedSettings"
                >
                  <span class="mr-2">
                    <div
                      class="h-4 w-4 transition-transform" :class="[
                        state.showAdvancedSettings ? 'i-carbon-chevron-down' : 'i-carbon-chevron-right',
                      ]"
                    />
                  </span>
                  高级设置
                </button>
              </div>

              <div v-if="state.showAdvancedSettings" class="animate-fadeIn mt-3 rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
                <div class="space-y-4">
                  <!-- API ID 输入 -->
                  <div>
                    <label for="apiId" class="block text-sm text-gray-700 font-medium dark:text-gray-300">
                      API ID
                    </label>
                    <div class="mt-1">
                      <input
                        id="apiId"
                        v-model="state.apiId"
                        name="apiId"
                        type="text"
                        class="block w-full appearance-none border border-gray-300 rounded-md px-3 py-2 shadow-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 sm:text-sm dark:text-white focus:outline-none focus:ring-blue-500 placeholder-gray-400"
                        :placeholder="config?.api?.telegram?.apiId || '请输入 API ID'"
                      >
                    </div>
                  </div>

                  <!-- API Hash 输入 -->
                  <div>
                    <label for="apiHash" class="block text-sm text-gray-700 font-medium dark:text-gray-300">
                      API Hash
                    </label>
                    <div class="mt-1">
                      <input
                        id="apiHash"
                        v-model="state.apiHash"
                        name="apiHash"
                        type="password"
                        class="block w-full appearance-none border border-gray-300 rounded-md px-3 py-2 shadow-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 sm:text-sm dark:text-white focus:outline-none focus:ring-blue-500 placeholder-gray-400"
                        :placeholder="config?.api?.telegram?.apiHash ? '******' : '请输入 API Hash'"
                      >
                    </div>
                  </div>

                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    如果您有自己的 Telegram API 密钥，请在此处输入。如果不确定，请保留为空以使用默认值（配置文件中的值）。
                  </p>
                </div>
              </div>
            </div>

            <!-- 提交按钮 -->
            <div>
              <button
                type="submit"
                class="w-full flex justify-center border border-transparent rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                :disabled="!canSubmit || state.isLoading"
              >
                <span v-if="state.isLoading" class="mr-2">
                  <div class="i-carbon-circle-dash inline-block h-4 w-4 animate-spin" />
                </span>
                {{ state.needPhoneNumber ? '发送验证码' : state.needPassword ? '提交密码' : '提交验证码' }}
              </button>
            </div>

            <!-- 重试按钮 -->
            <div class="text-center">
              <button
                v-if="!state.needPhoneNumber"
                type="button"
                class="mt-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                @click="retryLogin"
              >
                重新开始
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
