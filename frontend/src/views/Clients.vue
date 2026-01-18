<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">クライアント</h1>
      <button
        @click="showCreateModal = true"
        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
      >
        + 新規クライアント
      </button>
    </div>

    <!-- Client List -->
    <div class="bg-white shadow overflow-hidden sm:rounded-md">
      <ul class="divide-y divide-gray-200">
        <li v-for="client in clients" :key="client.id">
          <router-link :to="`/clients/${client.id}`" class="block hover:bg-gray-50">
            <div class="px-4 py-4 sm:px-6">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <p class="text-sm font-medium text-indigo-600 truncate">{{ client.name }}</p>
                  <span
                    class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="getStatusClass(client.status)"
                  >
                    {{ getStatusLabel(client.status) }}
                  </span>
                </div>
                <div class="ml-2 flex-shrink-0 flex">
                  <p class="text-sm text-gray-500">
                    {{ client.meeting_count }} MTG
                  </p>
                </div>
              </div>
              <div class="mt-2 sm:flex sm:justify-between">
                <div class="sm:flex">
                  <p class="flex items-center text-sm text-gray-500">
                    {{ client.description || '説明なし' }}
                  </p>
                </div>
                <div class="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                  <p v-if="client.last_meeting_at">
                    最終: {{ formatDate(client.last_meeting_at) }}
                  </p>
                </div>
              </div>
            </div>
          </router-link>
        </li>
      </ul>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="fixed z-10 inset-0 overflow-y-auto">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity" @click="showCreateModal = false">
          <div class="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">新規クライアント</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">名前</label>
              <input
                v-model="newClient.name"
                type="text"
                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">説明</label>
              <textarea
                v-model="newClient.description"
                rows="3"
                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              ></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">タイトルパターン（改行区切り）</label>
              <textarea
                v-model="newClient.titlePatterns"
                rows="2"
                placeholder="例: ABC社&#10;エービーシー"
                class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              ></textarea>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
            <button
              @click="createClient"
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:col-start-2 sm:text-sm"
            >
              作成
            </button>
            <button
              @click="showCreateModal = false"
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:col-start-1 sm:text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from '../api'

export default {
  name: 'Clients',
  data() {
    return {
      clients: [],
      showCreateModal: false,
      newClient: {
        name: '',
        description: '',
        titlePatterns: '',
      },
    }
  },
  async mounted() {
    await this.loadClients()
  },
  methods: {
    async loadClients() {
      try {
        const res = await api.get('/api/clients')
        this.clients = res.data
      } catch (error) {
        console.error('Failed to load clients:', error)
      }
    },
    async createClient() {
      try {
        const patterns = this.newClient.titlePatterns
          .split('\n')
          .map((p) => p.trim())
          .filter((p) => p)

        await api.post('/api/clients', {
          name: this.newClient.name,
          description: this.newClient.description,
          title_patterns: patterns,
        })

        this.showCreateModal = false
        this.newClient = { name: '', description: '', titlePatterns: '' }
        await this.loadClients()
      } catch (error) {
        console.error('Failed to create client:', error)
        alert('クライアントの作成に失敗しました')
      }
    },
    formatDate(dateStr) {
      const date = new Date(dateStr)
      return date.toLocaleDateString('ja-JP')
    },
    getStatusClass(status) {
      const classes = {
        active: 'bg-green-100 text-green-800',
        completed: 'bg-gray-100 text-gray-800',
        on_hold: 'bg-yellow-100 text-yellow-800',
      }
      return classes[status] || 'bg-gray-100 text-gray-800'
    },
    getStatusLabel(status) {
      const labels = {
        active: 'アクティブ',
        completed: '完了',
        on_hold: '保留',
      }
      return labels[status] || status
    },
  },
}
</script>
