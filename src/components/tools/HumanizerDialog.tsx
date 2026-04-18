import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import UploadStage from '@/components/tools/humanizer/UploadStage';
import SettingsPanel from '@/components/tools/humanizer/SettingsPanel';
import HighlightedText from '@/components/tools/humanizer/HighlightedText';
import ScorePanel from '@/components/tools/humanizer/ScorePanel';
import VariantsPanel from '@/components/tools/humanizer/VariantsPanel';
import { useHumanizerApi } from '@/components/tools/humanizer/useHumanizerApi';
import type {
  HumanizerSettings,
  SentenceInfo,
  DetectResult,
  HumanizerStage,
} from '@/components/tools/humanizer/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

const DEFAULT_SETTINGS: HumanizerSettings = {
  style: 'neutral',
  aggression: 'extreme',
  preserveTerms: true,
  academicMode: true,
  targetScore: 5,
};

const HumanizerDialog = ({ open, onOpenChange, userId }: Props) => {
  const api = useHumanizerApi(userId);

  const [stage, setStage] = useState<HumanizerStage>('upload');
  const [sourceType, setSourceType] = useState<string>('paste');
  const [sourceFilename, setSourceFilename] = useState<string>('');
  const [originalText, setOriginalText] = useState<string>('');
  const [currentText, setCurrentText] = useState<string>('');
  const [detectBefore, setDetectBefore] = useState<DetectResult | null>(null);
  const [detectAfter, setDetectAfter] = useState<DetectResult | null>(null);
  const [settings, setSettings] = useState<HumanizerSettings>(DEFAULT_SETTINGS);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [variants, setVariants] = useState<string[]>([]);
  const [rightTab, setRightTab] = useState<'settings' | 'variants'>('settings');
  const [totalRuns, setTotalRuns] = useState<number>(0);
  const [firstScoreBefore, setFirstScoreBefore] = useState<number | null>(null);

  const reset = useCallback(() => {
    setStage('upload');
    setSourceType('paste');
    setSourceFilename('');
    setOriginalText('');
    setCurrentText('');
    setDetectBefore(null);
    setDetectAfter(null);
    setSelectedIdx(null);
    setVariants([]);
    setRightTab('settings');
    setTotalRuns(0);
    setFirstScoreBefore(null);
  }, []);

  const handleClose = useCallback((v: boolean) => {
    if (!v && !api.loading) {
      reset();
    }
    onOpenChange(v);
  }, [api.loading, onOpenChange, reset]);

  const handleSubmitText = useCallback(async (text: string, source: string) => {
    if (text.length < 50) {
      toast.error('Слишком короткий текст');
      return;
    }
    setOriginalText(text);
    setCurrentText(text);
    setSourceType(source);
    setStage('analyze');
    try {
      const res = await api.detect(text, true);
      setDetectBefore(res);
      setStage('editor');
      const hot = res.sentences.filter((s) => s.ai_score >= 50).length;
      if (res.overall_score > 5 || hot > 0) {
        toast.warning(
          `Найдены AI-признаки: ${res.overall_score.toFixed(0)}% — ${hot} проблемных предложений`
        );
      } else {
        toast.success('Текст выглядит достаточно человеческим');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка анализа');
      setStage('upload');
    }
  }, [api]);

  const handleSubmitFile = useCallback(async (file: File) => {
    try {
      const res = await api.parseFile(file);
      setSourceFilename(file.name);
      await handleSubmitText(res.text, 'file');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка чтения файла');
    }
  }, [api, handleSubmitText]);

  const handleHumanizeFull = useCallback(async () => {
    if (!currentText) return;
    try {
      const res = await api.humanizeFull(currentText, settings);
      setCurrentText(res.humanized_text);
      setDetectAfter({
        sentences: res.sentences_after,
        overall_score: res.score_after,
        markers: res.markers_after || {},
      });
      setTotalRuns((prev) => {
        if (prev === 0) setFirstScoreBefore(res.score_before);
        return prev + 1;
      });
      const baseScore = firstScoreBefore ?? res.score_before;
      toast.success(
        `Прогон ${totalRuns + 1}: ${baseScore.toFixed(0)}% → ${res.score_after.toFixed(0)}%`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка очеловечивания');
    }
  }, [api, currentText, settings, totalRuns, firstScoreBefore]);

  const handleRerun = useCallback(async () => {
    if (!currentText) return;
    // Повторный прогон — усиливаем до extreme если ещё не extreme
    const rerunSettings: HumanizerSettings = {
      ...settings,
      aggression: 'extreme',
      targetScore: Math.max(3, settings.targetScore - 2),
    };
    try {
      const res = await api.humanizeFull(currentText, rerunSettings);
      setCurrentText(res.humanized_text);
      setDetectAfter({
        sentences: res.sentences_after,
        overall_score: res.score_after,
        markers: res.markers_after || {},
      });
      setTotalRuns((prev) => prev + 1);
      const baseScore = firstScoreBefore ?? res.score_before;
      toast.success(
        `Прогон ${totalRuns + 1}: ${baseScore.toFixed(0)}% → ${res.score_after.toFixed(0)}%`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка повторного прогона');
    }
  }, [api, currentText, settings, totalRuns, firstScoreBefore]);

  const handleSelectSentence = useCallback(async (index: number | null) => {
    setSelectedIdx(index);
    if (index === null) {
      setVariants([]);
      setRightTab('settings');
      return;
    }
    const activeSentences = (detectAfter || detectBefore)?.sentences || [];
    const sentence = activeSentences.find((s) => s.index === index);
    if (!sentence) return;
    setRightTab('variants');
    setVariants([]);
    try {
      const v = await api.rewriteSentence(sentence.text, settings, 3);
      setVariants(v);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }, [api, detectAfter, detectBefore, settings]);

  const handleRegenerate = useCallback(async () => {
    if (selectedIdx === null) return;
    const activeSentences = (detectAfter || detectBefore)?.sentences || [];
    const sentence = activeSentences.find((s) => s.index === selectedIdx);
    if (!sentence) return;
    setVariants([]);
    try {
      const v = await api.rewriteSentence(sentence.text, settings, 3);
      setVariants(v);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }, [api, selectedIdx, detectAfter, detectBefore, settings]);

  const handleApplyVariant = useCallback(async (variant: string) => {
    if (selectedIdx === null) return;
    const activeSentences = (detectAfter || detectBefore)?.sentences || [];
    const sentence = activeSentences.find((s) => s.index === selectedIdx);
    if (!sentence) return;
    const newText = currentText.replace(sentence.text, variant);
    setCurrentText(newText);
    setSelectedIdx(null);
    setVariants([]);
    setRightTab('settings');
    try {
      const res = await api.detect(newText, true);
      setDetectAfter(res);
      toast.success(`Применено. AI-score: ${res.overall_score.toFixed(0)}%`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  }, [currentText, selectedIdx, detectAfter, detectBefore, api]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(currentText);
    toast.success('Скопировано в буфер');
  }, [currentText]);

  const handleDownloadTxt = useCallback(() => {
    const blob = new Blob([currentText], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `humanized_${Date.now()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [currentText]);

  const handleDownloadDocx = useCallback(async () => {
    try {
      await api.exportDocx(currentText, 'Humanized');
      toast.success('Файл .docx скачан');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка экспорта');
    }
  }, [api, currentText]);

  const handleSave = useCallback(async () => {
    if (!userId) {
      toast.error('Нужно войти в аккаунт');
      return;
    }
    if (!detectBefore) return;
    try {
      const id = await api.saveDocument(
        originalText,
        currentText,
        detectBefore.overall_score,
        detectAfter?.overall_score ?? detectBefore.overall_score,
        sourceFilename || `Текст ${new Date().toLocaleDateString('ru')}`,
        sourceFilename,
        sourceType,
        settings,
      );
      toast.success(`Сохранено в историю (#${id})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  }, [api, userId, originalText, currentText, detectBefore, detectAfter, sourceFilename, sourceType, settings]);

  const activeSentences = useMemo<SentenceInfo[]>(
    () => (detectAfter || detectBefore)?.sentences || [],
    [detectAfter, detectBefore],
  );

  const selectedSentence = useMemo(
    () => activeSentences.find((s) => s.index === selectedIdx) || null,
    [activeSentences, selectedIdx],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[98vw] sm:max-w-6xl max-h-[95vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="Wand2" size={22} className="text-primary" />
            Humanizer — сделать текст человеческим
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Обход AI-детекторов с сохранением смысла. Работает для академических, деловых и блог-текстов.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {stage === 'upload' && (
            <UploadStage
              onSubmitText={handleSubmitText}
              onSubmitFile={handleSubmitFile}
              loading={api.loading}
              phase={api.phase}
            />
          )}

          {stage === 'analyze' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Icon name="Loader2" size={32} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{api.phase || 'Анализирую…'}</p>
            </div>
          )}

          {stage === 'editor' && (
            <div className="grid lg:grid-cols-[1fr,360px] gap-4">
              <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handleHumanizeFull}
                    disabled={api.loading}
                    className="gap-2"
                  >
                    <Icon
                      name={api.loading ? 'Loader2' : 'Sparkles'}
                      size={16}
                      className={api.loading ? 'animate-spin' : ''}
                    />
                    {totalRuns === 0 ? 'Очеловечить весь текст' : 'Очеловечить снова'}
                  </Button>
                  {totalRuns > 0 && (
                    <Button
                      onClick={handleRerun}
                      disabled={api.loading}
                      variant="default"
                      className="gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <Icon
                        name={api.loading ? 'Loader2' : 'Zap'}
                        size={16}
                        className={api.loading ? 'animate-spin' : ''}
                      />
                      Прогнать ещё раз (усиленно)
                    </Button>
                  )}
                  {totalRuns > 0 && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      Прогонов: {totalRuns}
                    </span>
                  )}
                  <Button variant="outline" onClick={handleCopy}>
                    <Icon name="Copy" size={14} className="mr-1.5" />
                    Копировать
                  </Button>
                  <Button variant="outline" onClick={handleDownloadTxt}>
                    <Icon name="FileText" size={14} className="mr-1.5" />
                    TXT
                  </Button>
                  <Button variant="outline" onClick={handleDownloadDocx}>
                    <Icon name="FileDown" size={14} className="mr-1.5" />
                    DOCX
                  </Button>
                  {userId && (
                    <Button variant="outline" onClick={handleSave}>
                      <Icon name="Save" size={14} className="mr-1.5" />
                      В историю
                    </Button>
                  )}
                  <Button variant="ghost" onClick={reset} className="ml-auto">
                    <Icon name="RotateCcw" size={14} className="mr-1.5" />
                    Новый текст
                  </Button>
                </div>

                {api.loading && api.phase && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                    <Icon name="Loader2" size={14} className="animate-spin text-primary" />
                    <span className="text-primary">{api.phase}</span>
                  </div>
                )}

                <div className="p-4 rounded-xl border bg-card min-h-[40vh] max-h-[65vh] overflow-y-auto">
                  <HighlightedText
                    sentences={activeSentences}
                    selectedIndex={selectedIdx}
                    onSelect={handleSelectSentence}
                  />
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-lime-100 dark:bg-lime-900/50 border border-lime-400" />
                    0–40% <span className="opacity-70">человек</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-yellow-200 dark:bg-yellow-900/50 border border-yellow-500" />
                    40–60%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-orange-200 dark:bg-orange-900/60 border border-orange-500" />
                    60–80%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-red-200 dark:bg-red-900/60 border border-red-500" />
                    80–100% <span className="opacity-70">AI</span>
                  </span>
                  <span className="ml-auto hidden md:inline">Клик по предложению — варианты</span>
                </div>
              </div>

              <div className="space-y-3">
                <ScorePanel
                  scoreBefore={firstScoreBefore ?? detectBefore?.overall_score ?? null}
                  scoreAfter={detectAfter?.overall_score ?? null}
                  markers={(detectAfter?.markers ?? detectBefore?.markers) || {}}
                />

                <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as 'settings' | 'variants')}>
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="settings">
                      <Icon name="Settings2" size={14} className="mr-1.5" />
                      Настройки
                    </TabsTrigger>
                    <TabsTrigger value="variants" disabled={selectedIdx === null}>
                      <Icon name="ListTree" size={14} className="mr-1.5" />
                      Варианты
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="settings" className="mt-3">
                    <SettingsPanel
                      settings={settings}
                      onChange={setSettings}
                      disabled={api.loading}
                    />
                  </TabsContent>

                  <TabsContent value="variants" className="mt-3">
                    {selectedSentence ? (
                      <VariantsPanel
                        original={selectedSentence.text}
                        variants={variants}
                        loading={api.loading}
                        onApply={handleApplyVariant}
                        onRegenerate={handleRegenerate}
                        onClose={() => handleSelectSentence(null)}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground italic text-center py-8">
                        Выберите предложение для просмотра вариантов
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HumanizerDialog;