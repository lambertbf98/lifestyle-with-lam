import { useState, useEffect, useRef } from 'react';
import { coach as coachApi } from '../api';
import { Send, Sparkles, Dumbbell, UtensilsCrossed, Loader2, Trash2 } from 'lucide-react';

const quickPrompts = [
  { icon: Dumbbell, label: 'Nuevo entreno', prompt: 'Genera un nuevo plan de entrenamiento para esta semana' },
  { icon: UtensilsCrossed, label: 'Plan dieta', prompt: 'Crea un plan de comidas para hoy basado en mis preferencias' },
  { icon: Sparkles, label: 'Motivación', prompt: 'Necesito motivación para seguir con mi transformación' }
];

export default function Coach() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadConversation();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = async () => {
    try {
      const response = await coachApi.getConversations('general');
      if (response.data.length > 0 && response.data[0].messages) {
        setMessages(response.data[0].messages);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (message) => {
    if (!message.trim() || loading) return;

    const userMessage = { role: 'user', content: message, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await coachApi.chat(message, 'general');
      const aiMessage = {
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = async () => {
    try {
      const response = await coachApi.getConversations('general');
      if (response.data.length > 0) {
        await coachApi.deleteConversation(response.data[0].id);
      }
      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  if (loadingHistory) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-accent-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="p-4 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-primary to-neon-purple rounded-xl flex items-center justify-center">
              <Sparkles size={24} className="text-dark-900" />
            </div>
            <div>
              <h1 className="font-bold">Coach Lam</h1>
              <p className="text-xs text-gray-400">Tu entrenador personal con IA</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="w-10 h-10 bg-dark-700 rounded-xl flex items-center justify-center hover:bg-dark-600 transition-colors"
            >
              <Trash2 size={18} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-accent-primary/20 to-neon-purple/20 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles size={40} className="text-accent-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">¡Hola! Soy Coach Lam</h2>
            <p className="text-gray-400 mb-6">
              Tu entrenador personal con IA. Puedo ayudarte con planes de entrenamiento,
              nutrición, motivación y resolver tus dudas sobre fitness.
            </p>

            {/* Quick Prompts */}
            <div className="w-full space-y-3">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => sendMessage(prompt.prompt)}
                  className="w-full flex items-center gap-3 p-4 bg-dark-700 rounded-xl border border-dark-600 hover:border-accent-primary/30 transition-all text-left"
                >
                  <div className="w-10 h-10 bg-accent-primary/20 rounded-lg flex items-center justify-center">
                    <prompt.icon size={20} className="text-accent-primary" />
                  </div>
                  <span className="font-medium">{prompt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div
                key={index}
                className={message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}

            {loading && (
              <div className="chat-bubble-ai">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-accent-primary" />
                  <span className="text-gray-400">Coach Lam está escribiendo...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-dark-700 bg-dark-800/50 backdrop-blur-lg">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="input flex-1"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="w-12 h-12 bg-accent-primary rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-neon-cyan"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin text-dark-900" />
            ) : (
              <Send size={20} className="text-dark-900" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
