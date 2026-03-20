let audioContext: AudioContext | null = null;
let isInitialized = false;

const initAudio = () => {
  if (!isInitialized && typeof window !== 'undefined') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    isInitialized = true;
  }
};

const playNote = (
  frequency: number,
  startTime: number,
  duration: number,
  volume: number = 0.15
) => {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
};

export const playNotificationSound = async () => {
  try {
    initAudio();
    
    if (!audioContext) {
      console.log('[SOUND] AudioContext not initialized');
      return;
    }

    // Возобновляем контекст если приостановлен (политика браузера)
    if (audioContext.state === 'suspended') {
      console.log('[SOUND] Resuming suspended AudioContext');
      await audioContext.resume();
    }

    console.log('[SOUND] AudioContext state:', audioContext.state);
    const currentTime = audioContext.currentTime;
    
    // Приятная мелодия из 4 нот (C5 → E5 → G5 → C6)
    const melody = [
      { freq: 523.25, time: 0, duration: 0.15 },      // C5
      { freq: 659.25, time: 0.12, duration: 0.15 },   // E5
      { freq: 783.99, time: 0.24, duration: 0.15 },   // G5
      { freq: 1046.50, time: 0.36, duration: 0.25 },  // C6 (длиннее)
    ];

    console.log('[SOUND] Playing melody...');
    melody.forEach(note => {
      playNote(note.freq, currentTime + note.time, note.duration);
    });
  } catch (error) {
    console.error('[SOUND] Failed to play notification sound:', error);
  }
};

export const vibrate = (pattern: number | number[] = 200) => {
  try {
    if (navigator?.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch { /* vibration not supported */ }
};

export const playSuccessSound = async () => {
  try {
    vibrate([100, 50, 100, 50, 200]);

    initAudio();
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const t = audioContext.currentTime;

    const notes = [
      { freq: 523.25, time: 0, dur: 0.18, vol: 0.12 },
      { freq: 659.25, time: 0.14, dur: 0.18, vol: 0.13 },
      { freq: 783.99, time: 0.28, dur: 0.18, vol: 0.14 },
      { freq: 1046.50, time: 0.44, dur: 0.22, vol: 0.13 },
      { freq: 1174.66, time: 0.62, dur: 0.20, vol: 0.11 },
      { freq: 1318.51, time: 0.78, dur: 0.25, vol: 0.10 },
      { freq: 1567.98, time: 0.98, dur: 0.35, vol: 0.09 },
      { freq: 2093.00, time: 1.25, dur: 0.55, vol: 0.07 },
    ];

    notes.forEach(n => {
      playNote(n.freq, t + n.time, n.dur, n.vol);
    });
  } catch (error) {
    console.error('[SOUND] Failed to play success sound:', error);
  }
};

export const enableNotificationSound = () => {
  initAudio();
  
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
};