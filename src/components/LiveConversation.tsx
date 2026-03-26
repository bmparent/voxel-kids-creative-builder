import { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { useStore } from '../hooks/useStore';
import { getGeminiApiKey } from '../services/apiClient';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';

interface LiveConversationProps {
  activeNPCId: string | null;
}

export const LiveConversation = ({ activeNPCId }: LiveConversationProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState("");
  
  const npcs = useStore(state => state.npcs);
  const setNPCMessage = useStore(state => state.setNPCMessage);
  const currentNPC = activeNPCId ? npcs.find(n => n.id === activeNPCId) : null;
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlaying = useRef(false);

  const stopConversation = async () => {
    if (sessionRef.current) {
      await sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
    setTranscription("");
    if (activeNPCId) setNPCMessage(activeNPCId, null);
  };

  const startConversation = async () => {
    if (!activeNPCId || !currentNPC) return;
    
    setIsConnecting(true);
    try {
      const apiKey = await getGeminiApiKey();
      if (!apiKey) {
        console.error('No API key available for Live Conversation');
        setIsConnecting(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      
      sessionRef.current = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: `You are ${currentNPC.name}, an NPC in a voxel building game. 
          The player is talking to you. Be friendly, helpful, and stay in character.
          You can suggest building ideas or just chat about the world.
          Keep your responses concise and fun!`,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            setIsConnecting(false);
            
            // Start mic
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioContextRef.current!.createMediaStreamSource(streamRef.current);
            
            // We need a worklet to convert Float32 to Int16 PCM
            await audioContextRef.current!.audioWorklet.addModule(URL.createObjectURL(new Blob([`
              class AudioProcessor extends AudioWorkletProcessor {
                process(inputs) {
                  const input = inputs[0][0];
                  if (input) {
                    const pcm = new Int16Array(input.length);
                    for (let i = 0; i < input.length; i++) {
                      pcm[i] = Math.max(-1, Math.min(1, input[i])) * 0x7FFF;
                    }
                    this.port.postMessage(pcm);
                  }
                  return true;
                }
              }
              registerProcessor('audio-processor', AudioProcessor);
            `], { type: 'application/javascript' })));
            
            workletNodeRef.current = new AudioWorkletNode(audioContextRef.current!, 'audio-processor');
            workletNodeRef.current.port.onmessage = (e) => {
              if (sessionRef.current && !isMuted) {
                const base64 = btoa(String.fromCharCode(...new Uint8Array(e.data.buffer)));
                sessionRef.current.sendRealtimeInput({
                  audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                });
              }
            };
            
            source.connect(workletNodeRef.current);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle audio output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const binary = atob(base64Audio);
              const bytes = new Int16Array(binary.length / 2);
              for (let i = 0; i < bytes.length; i++) {
                bytes[i] = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
              }
              audioQueue.current.push(bytes);
              playNextInQueue();
            }
            
            // Handle transcriptions for visual captions
            const modelTranscription = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (modelTranscription) {
              setTranscription(prev => prev + " " + modelTranscription);
              setNPCMessage(activeNPCId, modelTranscription);
              // Clear message after 5 seconds
              setTimeout(() => setNPCMessage(activeNPCId, null), 5000);
            }

            if (message.serverContent?.interrupted) {
              audioQueue.current = [];
              isPlaying.current = false;
            }
          },
          onclose: () => stopConversation(),
          onerror: (e) => {
            console.error("Live API Error:", e);
            stopConversation();
          }
        }
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
      setIsConnecting(false);
    }
  };

  const playNextInQueue = () => {
    if (isPlaying.current || audioQueue.current.length === 0 || !audioContextRef.current) return;
    
    isPlaying.current = true;
    const pcm = audioQueue.current.shift()!;
    const float32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) {
      float32[i] = pcm[i] / 0x7FFF;
    }
    
    const buffer = audioContextRef.current.createBuffer(1, float32.length, 16000);
    buffer.getChannelData(0).set(float32);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlaying.current = false;
      playNextInQueue();
    };
    source.start();
  };

  useEffect(() => {
    if (!activeNPCId) {
      stopConversation();
    }
  }, [activeNPCId]);

  if (!activeNPCId) return null;

  return (
    <div className="fixed bottom-24 right-6 flex flex-col items-end gap-3 pointer-events-none">
      {/* Visual Captions */}
      {isConnected && transcription && (
        <div className="bg-black/80 text-white px-4 py-2 rounded-2xl text-sm max-w-[250px] backdrop-blur-md border border-white/20 animate-in fade-in slide-in-from-bottom-2">
          <p className="opacity-60 text-[10px] uppercase font-bold mb-1">Live Transcription</p>
          {transcription}
        </div>
      )}

      <div className="flex gap-2 pointer-events-auto">
        {!isConnected ? (
          <button
            onClick={startConversation}
            disabled={isConnecting}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
            Start Voice Chat
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-xl shadow-xl transition-all active:scale-95 ${
                isMuted ? 'bg-red-500 text-white' : 'bg-gray-900 text-white'
              }`}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button
              onClick={stopConversation}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold shadow-xl transition-all active:scale-95"
            >
              End Chat
            </button>
          </>
        )}
      </div>
    </div>
  );
};
