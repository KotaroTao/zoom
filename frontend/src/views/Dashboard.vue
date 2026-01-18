<template>
  <div>
    <h1 class="text-2xl font-semibold text-gray-900 mb-6">ダッシュボード</h1>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <span class="text-2xl">📹</span>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">今月のMTG</dt>
                <dd class="text-lg font-medium text-gray-900">{{ stats.meetings_this_month }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <span class="text-2xl">🏢</span>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">クライアント数</dt>
                <dd class="text-lg font-medium text-gray-900">{{ stats.total_clients }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <span class="text-2xl">⏳</span>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">処理中</dt>
                <dd class="text-lg font-medium text-gray-900">{{ stats.pending_processing }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <span class="text-2xl">❌</span>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">エラー</dt>
                <dd class="text-lg font-medium" :class="stats.failed_processing > 0 ? 'text-red-600' : 'text-gray-900'">
                  {{ stats.failed_processing }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Processing Items -->
    <div v-if="processing.length > 0" class="bg-white shadow rounded-lg mb-8">
      <div class="px-4 py-5 sm:px-6">
        <h3 class="text-lg leading-6 font-medium text-gray-900">処理中</h3>
      </div>
      <ul class="divide-y divide-gray-200">
        <li v-for="item in processing" :key="item.id" class="px-4 py-4">
          <div class="flex items-center justify-between">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">{{ item.topic }}</p>
              <p class="text-sm text-gray-500">{{ item.status }}</p>
            </div>
            <div class="ml-4 flex-shrink-0 w-32">
              <div class="bg-gray-200 rounded-full h-2">
                <div
                  class="bg-indigo-600 rounded-full h-2"
                  :style="{ width: item.progress_percent + '%' }"
                ></div>
              </div>
              <p class="text-xs text-gray-500 text-right mt-1">{{ item.progress_percent }}%</p>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Recent Meetings -->
    <div class="bg-white shadow rounded-lg">
      <div class="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h3 class="text-lg leading-6 font-medium text-gray-900">最近のミーティング</h3>
        <router-link to="/meetings" class="text-sm text-indigo-600 hover:text-indigo-500">
          すべて見る →
        </router-link>
      </div>
      <ul class="divide-y divide-gray-200">
        <li v-for="meeting in recentMeetings" :key="meeting.id" class="px-4 py-4 hover:bg-gray-50">
          <router-link :to="`/meetings/${meeting.id}`" class="block">
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{{ meeting.topic }}</p>
                <p class="text-sm text-gray-500">
                  {{ formatDate(meeting.start_time) }}
                  <span v-if="meeting.client_name" class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {{ meeting.client_name }}
                  </span>
                </p>
              </div>
              <div class="ml-4 flex-shrink-0 flex items-center space-x-2">
                <a
                  v-if="meeting.youtube_url"
                  :href="meeting.youtube_url"
                  target="_blank"
                  class="text-red-600 hover:text-red-500"
                  @click.stop
                >
                  ▶ YouTube
                </a>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="getStatusClass(meeting.status)"
                >
                  {{ meeting.status }}
                </span>
              </div>
            </div>
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import api from '../api'

export default {
  name: 'Dashboard',
  data() {
    return {
      stats: {
        total_meetings: 0,
        meetings_this_month: 0,
        total_clients: 0,
        active_clients: 0,
        pending_processing: 0,
        failed_processing: 0,
      },
      processing: [],
      recentMeetings: [],
    }
  },
  async mounted() {
    await this.loadData()
    // Refresh every 30 seconds
    this.refreshInterval = setInterval(this.loadData, 30000)
  },
  beforeUnmount() {
    clearInterval(this.refreshInterval)
  },
  methods: {
    async loadData() {
      try {
        const [statsRes, processingRes, recentRes] = await Promise.all([
          api.get('/api/dashboard/stats'),
          api.get('/api/dashboard/processing'),
          api.get('/api/dashboard/recent'),
        ])
        this.stats = statsRes.data
        this.processing = processingRes.data
        this.recentMeetings = recentRes.data
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      }
    },
    formatDate(dateStr) {
      const date = new Date(dateStr)
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    },
    getStatusClass(status) {
      const classes = {
        completed: 'bg-green-100 text-green-800',
        failed: 'bg-red-100 text-red-800',
        pending: 'bg-yellow-100 text-yellow-800',
      }
      return classes[status] || 'bg-gray-100 text-gray-800'
    },
  },
}
</script>
