<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-semibold text-gray-900">ミーティング</h1>
      <div class="flex items-center space-x-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="検索..."
          class="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          @keyup.enter="search"
        />
        <select
          v-model="statusFilter"
          class="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          @change="loadMeetings"
        >
          <option value="">すべてのステータス</option>
          <option value="completed">完了</option>
          <option value="pending">処理中</option>
          <option value="failed">エラー</option>
        </select>
      </div>
    </div>

    <!-- Meeting List -->
    <div class="bg-white shadow overflow-hidden sm:rounded-md">
      <ul class="divide-y divide-gray-200">
        <li v-for="meeting in meetings" :key="meeting.id">
          <router-link :to="`/meetings/${meeting.id}`" class="block hover:bg-gray-50">
            <div class="px-4 py-4 sm:px-6">
              <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-indigo-600 truncate">{{ meeting.topic }}</p>
                  <p class="mt-1 text-sm text-gray-500">
                    {{ formatDateTime(meeting.start_time) }}
                    <span class="mx-2">•</span>
                    {{ meeting.duration_minutes }}分
                  </p>
                </div>
                <div class="ml-4 flex-shrink-0 flex items-center space-x-3">
                  <span
                    v-if="meeting.client_name"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {{ meeting.client_name }}
                  </span>
                  <a
                    v-if="meeting.youtube_url"
                    :href="meeting.youtube_url"
                    target="_blank"
                    class="text-red-600 hover:text-red-500 text-sm"
                    @click.stop
                  >
                    ▶ YouTube
                  </a>
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="getStatusClass(meeting.status)"
                  >
                    {{ getStatusLabel(meeting.status) }}
                  </span>
                </div>
              </div>
            </div>
          </router-link>
        </li>
        <li v-if="meetings.length === 0" class="px-4 py-8 text-center text-gray-500">
          ミーティングがありません
        </li>
      </ul>
    </div>

    <!-- Pagination -->
    <div class="mt-4 flex justify-between items-center">
      <button
        @click="prevPage"
        :disabled="offset === 0"
        class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        前へ
      </button>
      <span class="text-sm text-gray-500">{{ offset + 1 }} - {{ offset + meetings.length }}</span>
      <button
        @click="nextPage"
        :disabled="meetings.length < limit"
        class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        次へ
      </button>
    </div>
  </div>
</template>

<script>
import api from '../api'

export default {
  name: 'Meetings',
  data() {
    return {
      meetings: [],
      searchQuery: '',
      statusFilter: '',
      offset: 0,
      limit: 20,
    }
  },
  async mounted() {
    await this.loadMeetings()
  },
  methods: {
    async loadMeetings() {
      try {
        const params = {
          limit: this.limit,
          offset: this.offset,
        }
        if (this.statusFilter) {
          params.status = this.statusFilter
        }
        const res = await api.get('/api/meetings', { params })
        this.meetings = res.data
      } catch (error) {
        console.error('Failed to load meetings:', error)
      }
    },
    async search() {
      if (!this.searchQuery) {
        await this.loadMeetings()
        return
      }
      try {
        const res = await api.get('/api/meetings/search', {
          params: { q: this.searchQuery },
        })
        this.meetings = res.data
      } catch (error) {
        console.error('Search failed:', error)
      }
    },
    prevPage() {
      if (this.offset > 0) {
        this.offset = Math.max(0, this.offset - this.limit)
        this.loadMeetings()
      }
    },
    nextPage() {
      if (this.meetings.length === this.limit) {
        this.offset += this.limit
        this.loadMeetings()
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
        downloading: 'bg-blue-100 text-blue-800',
        uploading_youtube: 'bg-blue-100 text-blue-800',
        transcribing: 'bg-purple-100 text-purple-800',
        summarizing: 'bg-purple-100 text-purple-800',
        saving: 'bg-indigo-100 text-indigo-800',
      }
      return classes[status] || 'bg-gray-100 text-gray-800'
    },
    getStatusLabel(status) {
      const labels = {
        completed: '完了',
        failed: 'エラー',
        pending: '待機中',
        downloading: 'ダウンロード中',
        uploading_youtube: 'アップロード中',
        transcribing: '文字起こし中',
        summarizing: '要約中',
        saving: '保存中',
      }
      return labels[status] || status
    },
  },
}
</script>
