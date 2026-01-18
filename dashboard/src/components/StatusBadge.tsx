interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: { label: '待機中', className: 'badge-gray' },
  DOWNLOADING: { label: 'ダウンロード中', className: 'badge-info' },
  UPLOADING: { label: 'アップロード中', className: 'badge-info' },
  TRANSCRIBING: { label: '文字起こし中', className: 'badge-warning' },
  SUMMARIZING: { label: '要約生成中', className: 'badge-warning' },
  SYNCING: { label: '同期中', className: 'badge-info' },
  COMPLETED: { label: '完了', className: 'badge-success' },
  FAILED: { label: '失敗', className: 'badge-error' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'badge-gray',
  };

  return <span className={`badge ${config.className}`}>{config.label}</span>;
}
