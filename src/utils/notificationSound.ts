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

export const playNotificationSound = () => {
  try {
    initAudio();
    
    if (!audioContext) return;

    const currentTime = audioContext.currentTime;
    
    // Приятная мелодия из 4 нот (C5 → E5 → G5 → C6)
    const melody = [
      { freq: 523.25, time: 0, duration: 0.15 },      // C5
      { freq: 659.25, time: 0.12, duration: 0.15 },   // E5
      { freq: 783.99, time: 0.24, duration: 0.15 },   // G5
      { freq: 1046.50, time: 0.36, duration: 0.25 },  // C6 (длиннее)
    ];

    melody.forEach(note => {
      playNote(note.freq, currentTime + note.time, note.duration);
    });
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
};

// Функция для инициализации звука после взаимодействия пользователя
export const enableNotificationSound = () => {
  initAudio();
  
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
};
