// Voice recording using Web Speech API

export function startVoiceRecording(): Promise<string> {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      reject(new Error('Speech recognition not supported in this browser'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let transcript = '';

    recognition.onresult = (event: any) => {
      transcript = event.results[0][0].transcript;
    };

    recognition.onend = () => {
      if (transcript) {
        resolve(transcript);
      } else {
        reject(new Error('No speech detected. Please try again.'));
      }
    };

    recognition.onerror = (event: any) => {
      reject(new Error(`Speech recognition error: ${event.error}`));
    };

    recognition.start();

    // Auto-stop after 10 seconds
    setTimeout(() => {
      recognition.stop();
    }, 10000);
  });
}
