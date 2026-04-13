export interface RetouchTask {
  photo_id: number;
  task_id: string;
  status: 'queued' | 'started' | 'processing' | 'finished' | 'failed';
  result_url?: string;
  error_message?: string;
  file_name?: string;
  progress?: number;
  created_at?: string;
}

export interface RetouchTaskListProps {
  tasks: RetouchTask[];
  onRetryTask: (task: RetouchTask) => void;
  onRetryAllFailed: () => void;
}