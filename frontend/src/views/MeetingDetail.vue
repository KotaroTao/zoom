<template>
  <div v-if="meeting">
    <div class="mb-6">
      <router-link to="/meetings" class="text-indigo-600 hover:text-indigo-500">
        ← ミーティング一覧
      </router-link>
    </div>

    <!-- Meeting Header -->
    <div class="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
      <div class="px-4 py-5 sm:px-6 flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ meeting.topic }}</h1>
          <p class="mt-1 text-sm text-gray-500">
            {{ formatDateTime(meeting.start_time) }} • {{ meeting.duration_minutes }}分
          </p>
        </div>
        <div class="flex items-center space-x-3">
          <span
            v-if="meeting.client_name"
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
          >
            {{ meeting.client_name }}
          </span>
          <span
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            :class="getStatusClass(meeting.status)"
          >
            {{ getStatusLabel(meeting.status) }}
          </span>
        </div>
      </div>
      <div class="border-t border-gray-200 px-4 py-4 sm:px-6">
        <div class="flex items-center space-x-4">
          <a
            v-if="meeting.youtube_url"
            :href="meeting.youtube_url"
            target="_blank"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
          >
            ▶ YouTubeで見る
          </a>
          <button
            v-if="meeting.status === 'failed'"
            @click="retryProcessing"
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            再処理
          </button>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="meeting.error_message" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <h3 class="text-sm font-medium text-red-800">エラー</h3>
      <p class="mt-1 text-sm text-red-700 whitespace-pre-wrap">{{ meeting.error_message }}</p>
    </div>

    <!-- Tabs -->
    <div class="mb-6">
      <nav class="flex space-x-4" aria-label="Tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-3 py-2 font-medium text-sm rounded-md"
          :class="activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700'"
        >
          {{ tab.name }}
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    <div class="bg-white shadow sm:rounded-lg">
      <!-- Summary Tab -->
      <div v-if="activeTab === 'summary'" class="px-4 py-5 sm:px-6">
        <div v-if="meeting.summary" class="prose max-w-none text-sm text-gray-700 whitespace-pre-wrap">
          {{ meeting.summary }}
        </div>
        <p v-else class="text-gray-500">要約がありません</p>
      </div>

      <!-- Decisions Tab -->
      <div v-if="activeTab === 'decisions'" class="px-4 py-5 sm:px-6">
        <div v-if="meeting.decisions" class="prose max-w-none text-sm text-gray-700 whitespace-pre-wrap">
          {{ meeting.decisions }}
        </div>
        <p v-else class="text-gray-500">決定事項がありません</p>
      </div>

      <!-- Actions Tab -->
      <div v-if="activeTab === 'actions'" class="px-4 py-5 sm:px-6">
        <div v-if="meeting.action_items" class="prose max-w-none text-sm text-gray-700 whitespace-pre-wrap">
          {{ meeting.action_items }}
        </div>
        <p v-else class="text-gray-500">アクションアイテムがありません</p>
      </div>

      <!-- Transcript Tab -->
      <div v-if="activeTab === 'transcript'" class="px-4 py-5 sm:px-6">
        <div v-if="meeting.transcript" class="prose max-w-none text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
          {{ meeting.transcript }}
        </div>
        <p v-else class="text-gray-500">文字起こしがありません</p>
      </div>
    </div>

    <!-- Assign Client Modal -->
    <div v-if="!meeting.client_id" class="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h3 class="text-sm font-medium text-yellow-800">クライアント未設定</h3>
      <p class="mt-1 text-sm text-yellow-700">このミーティングはクライアントに紐づいていません。</p>
      <div class="mt-3 flex items-center space-x-3">
        <select
          v-model="selectedClientId"
          class="border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm"
        >
          <option value="">クライアントを選択</option>
          <option v-for="client in clients" :key="client.id" :value="client.id">
            {{ client.name }}
          </option>
        </select>
        <button
          @click="assignClient"
          :disabled="!selectedClientId"
          class="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          設定
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import api from '../api'

export default {
  name: 'MeetingDetail',
  data() {
    return {
      meeting: null,
      clients: [],
      selectedClientId: '',
      activeTab: 'summary',
      tabs: [
        { id: 'summary', name: '要約' },
        { id: 'decisions', name: '決定事項' },
        { id: 'actions', name: 'アクション' },
        { id: 'transcript', name: '文字起こし' },
      ],
    }
  },
  async mounted() {
    await Promise.all([this.loadMeeting(), this.loadClients()])
  },
  methods: {
    async loadMeeting() {
      try {
        const res = await api.get(`/api/meetings/${this.$route.params.id}`)
        this.meeting = res.data
      } catch (error) {
        console.error('Failed to load meeting:', error)
      }
    },
    async loadClients() {
      try {
        const res = await api.get('/api/clients')
        this.clients = res.data
      } catch (error) {
        console.error('Failed to load clients:', error)
      }
    },
    async retryProcessing() {
      try {
        await api.post(`/api/meetings/${this.meeting.id}/retry`)
        alert('再処理を開始しました')
        await this.loadMeeting()
      } catch (error) {
        console.error('Failed to retry:', error)
        alert('再処理の開始に失敗しました')
      }
    },
    async assignClient() {
      try {
        await api.post(`/api/clients/${this.selectedClientId}/assign-meeting/${this.meeting.id}`)
        await this.loadMeeting()
        this.selectedClientId = ''
      } catch (error) {
        console.error('Failed to assign client:', error)
        alert('クライアントの設定に失敗しました')
      }
    },
    formatDateTime(dateStr) {
      const date = new Date(dateStr)
      return date.toLocaleString('ja-JP')
    },
    getStatusClass(status) {
      const classes = {
        completed: 'bg-green-100 text-green-800',
        failed: 'bg-red-100 text-red-800',
        pending: 'bg-yellow-100 text-yellow-800',
      }
      return classes[status] || 'bg-gray-100 text-gray-800'
    },
    getStatusLabel(status) {
      const labels = {
        completed: '完了',
        failed: 'エラー',
        pending: '処理中',
      }
      return labels[status] || status
    },
  },
}
</script>
