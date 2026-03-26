import { useState, useRef, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { getAIResponse, analyzePhoto, BuildInstruction } from '../services/apiClient';
import { MessageCircle, Send, X, Sparkles, Loader2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface Message {
  role: 'user' | 'ai';
  text: string;
  buildInstructions?: BuildInstruction[];
}

export const AIChat = ({ activeNPC, onCloseNPC }: { activeNPC: string | null, onCloseNPC: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'thoughts'>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Hi! I'm Voxel Buddy. I can help you build anything! Try asking me to 'build a small house' or 'give me a building idea'." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const cubesCount = useStore(state => state.cubes.length);
  const npcs = useStore(state => state.npcs);
  const bulkAddCubes = useStore(state => state.bulkAddCubes);
  const updateNPC = useStore(state => state.updateNPC);

  const currentNPC = activeNPC ? npcs.find(n => n.id === activeNPC) : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (activeNPC) {
      setIsOpen(true);
      setMessages([
        { role: 'ai', text: `Hi! I'm ${currentNPC?.name}. I'm so happy to see you! What should we build together today?` }
      ]);
    } else {
      setMessages([
        { role: 'ai', text: "Hi! I'm Voxel Buddy. I can help you build anything! Try asking me to 'build a small house' or 'give me a building idea'." }
      ]);
    }
  }, [activeNPC, currentNPC]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await getAIResponse(userMessage, cubesCount, currentNPC?.name);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: response.text, 
        buildInstructions: response.buildInstructions 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "Oops, my brain is a bit fuzzy. Let's try again!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicBuild = (instructions: BuildInstruction[]) => {
    bulkAddCubes(instructions as any);
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.7 },
      colors: ['#FFD700', '#FFA500', '#FF4500']
    });
  };

  const handleNPCPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNPC) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        const result = await analyzePhoto(base64Data, file.type);
        updateNPC(activeNPC, result);
        setIsAnalyzing(false);
        setMessages(prev => [...prev, { role: 'ai', text: "Wow! I love my new look! Thanks for the inspiration!" }]);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error analyzing NPC photo:", error);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="absolute bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-80 h-[450px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100"
          >
            {/* Header */}
            <div className="p-4 bg-gray-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentNPC ? '' : 'bg-gradient-to-br from-yellow-400 to-orange-500'
                }`} style={{ backgroundColor: currentNPC?.color }}>
                  <Sparkles size={16} className="text-white" />
                </div>
                <span className="font-bold">{currentNPC ? currentNPC.name : 'Voxel Buddy'}</span>
              </div>
              <div className="flex items-center gap-2">
                {currentNPC && (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
                    title="Restyle NPC with Photo"
                  >
                    {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                  </button>
                )}
                <button onClick={() => {
                  setIsOpen(false);
                  if (activeNPC) onCloseNPC();
                }} className="hover:opacity-70">
                  <X size={20} />
                </button>
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleNPCPhotoUpload}
            />

            {/* Tabs */}
            {currentNPC && (
              <div className="flex border-b border-gray-100 bg-white">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'chat' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('thoughts')}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'thoughts' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Thoughts
                </button>
              </div>
            )}

            {/* Content */}
            {activeTab === 'chat' || !currentNPC ? (
              <>
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                        msg.role === 'user' 
                          ? 'bg-gray-900 text-white rounded-br-none' 
                          : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-none'
                      }`}>
                        {msg.text}
                        {msg.buildInstructions && (
                          <button
                            onClick={() => handleMagicBuild(msg.buildInstructions!)}
                            className="mt-3 w-full py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                          >
                            <Sparkles size={14} />
                            Magic Build!
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
                        <Loader2 size={16} className="animate-spin text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask Voxel Buddy..."
                    className="flex-1 bg-gray-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <button
                    onClick={handleSend}
                    disabled={isLoading}
                    className="p-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {currentNPC.thoughtHistory && currentNPC.thoughtHistory.length > 0 ? (
                  currentNPC.thoughtHistory.map((thought, i) => (
                    <div key={i} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-gray-500 uppercase tracking-wider">{thought.decision}</span>
                        <span className="text-xs text-gray-400">{new Date(thought.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-gray-700">{thought.thought}</p>
                    </div>
                  )).reverse()
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                    No thoughts yet...
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 ${
          isOpen ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
};
