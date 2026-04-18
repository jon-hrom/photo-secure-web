export type HumanizerStage = 'upload' | 'analyze' | 'editor' | 'done';

export type HumanizerStyle = 'neutral' | 'casual' | 'expert' | 'blogger' | 'business';
export type HumanizerAggression = 'light' | 'medium' | 'strong' | 'extreme';

export interface SentenceInfo {
  index: number;
  text: string;
  start: number;
  end: number;
  paragraph: number;
  ai_score: number;
  heuristic_score?: number;
  llm_score?: number | null;
  markers?: string[];
}

export interface DetectResult {
  sentences: SentenceInfo[];
  overall_score: number;
  burstiness_penalty?: number;
  tense_penalty?: number;
  structure_penalty?: number;
  markers?: Record<string, number>;
}

export interface HumanizeFullResult {
  original_text: string;
  humanized_text: string;
  score_before: number;
  score_after: number;
  passes: number;
  history: { pass: number; score: number }[];
  sentences_before: SentenceInfo[];
  sentences_after: SentenceInfo[];
  markers_before?: Record<string, number>;
  markers_after?: Record<string, number>;
}

export interface HumanizerSettings {
  style: HumanizerStyle;
  aggression: HumanizerAggression;
  preserveTerms: boolean;
  academicMode: boolean;
  targetScore: number;
}

export const MARKER_LABELS: Record<string, string> = {
  em_dash: 'Длинное тире (—)',
  letter_yo: 'Буква «ё»',
  english_term: 'Англ. вставка',
  too_long: 'Слишком длинное предложение',
  ai_cliche: 'AI-штамп',
  template_connector: 'Шаблонная связка',
  methodological_error: 'Некорр. формулировка (работа/закон)',
  template_logic: 'Шаблонный логический оборот',
};