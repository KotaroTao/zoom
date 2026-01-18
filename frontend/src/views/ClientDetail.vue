<template>
  <div v-if="client">
    <div class="mb-6">
      <router-link to="/clients" class="text-indigo-600 hover:text-indigo-500">
        ← クライアント一覧
      </router-link>
    </div>

    <!-- Client Header -->
    <div class="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
      <div class="px-4 py-5 sm:px-6 flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ client.name }}</h1>
          <p class="mt-1 max-w-2xl text-sm text-gray-500">{{ client.description }}</p>
        </div>
        <span
          class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
          :class="getStatusClass(client.status)"
        >
          {{ getStatusLabel(client.status) }}
        </span>
      </div>
      <div class="border-t border-gray-200 px-4 py-5 sm:px-6">
        <dl class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
          <div>
            <dt class="text-sm font-medium text-gray-500">ミーティング数</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ client.meeting_count }} 回</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">最終ミーティング</dt>
            <dd class="mt-1 text-sm text-gray-900">
              {{ client.last_meeting_at ? formatDate(client.last_meeting_at) : '-' }}
            </dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">登録日</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ formatDate(client.created_at) }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Cumulative Summary -->
    <div v-if="client.cumulative_summary" class="bg-white shadow sm:rounded-lg mb-6">
      <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h2 class="text-lg leading-6 font-medium text-gray-900">累積サマリー</h2>
        <button
          @click="refreshSummary"
          class="text-sm text-indigo-600 hover:text-indigo-500"
          :disabled="refreshing"
        >
          {{ refreshing ? '更新中...' : '更新' }}
        </button>
      </div>
      <div class="border-t border-gray-200 px-4 py-5 sm:px-6">
        <div class="prose max-w-none text-sm text-gray-700 whitespace-pre-wrap">
          {{ client.cumulative_summary }}
        </div>
      </div>
    </div>

    <!-- Meeting History -->
    <div class="bg-white shadow sm:rounded-lg">
      <div class="px-4 py-5 sm:px-6">
        <h2 class="text-lg leading-6 font-medium text-gray-900">ミーティング履歴</h2>
      </div>
      <ul class="divide-y divide-gray-200">
        <li v-for="meeting in client.meetings" :key="meeting.id" class="px-4 py-4 hover:bg-gray-50">
          <router-link :to="`/meetings/${meeting.id}`" class="block">
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900">{{ meeting.topic }}</p>
                <p class="text-sm text-gray-500">{{ formatDateTime(meeting.start_time) }}</p>
              </div>
              <div class="ml-4 flex-shrink-0 flex items-center space-x-3">
                <a
                  v-if="meeting.youtube_url"
                  :href="meeting.youtube_url"
                  target="_blank"
                  class="text-red-600 hover:text-red-500 text-sm"
                  @click.stop
                >
                  ▶ YouTube
                </a>
              </div>
            </div>
            <div v-if="meeting.summary" class="mt-2 text-sm text-gray-600 line-clamp-2">
              {{ meeting.summary }}
            </div>
          </router-link>
        </li>
        <li v-if="client.meetings.length === 0" class="px-4 py-8 text-center text-gray-500">
          ミーティング履歴がありません
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import api from '../api'

export default {
  name: 'ClientDetail',
  data() {
    return {
      client: null,
      refreshing: false,
    }
  },
  async mounted() {
    await this.loadClient()
  },
  methods: {
    async loadClient() {
      try {
        const res = await api.get(`/api/clients/${this.$route.params.id}`)
        this.client = res.data
      } catch (error) {
        console.error('Failed to load client:', error)
      }
    },
    async refreshSummary() {
      this.refreshing = true
      try {
        await api.post(`/api/clients/${this.client.id}/refresh-summary`)
        // Wait a bit for processing
        await new Promise((resolve) => setTimeout(resolve, 3000))
        await this.loadClient()
      } catch (error) {
        console.error('Failed to refresh summary:', error)
      }
      this.refreshing = false
    },
    formatDate(dateStr) {
      const date = new Date(dateStr)
      return date.toLocaleDateString('ja-JP')
    },
    formatDateTime(dateStr) {
      const date = new Date(dateStr)
      return date.toLocaleString('ja-JP')
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
