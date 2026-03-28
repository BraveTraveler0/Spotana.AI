import { useState, useEffect, useRef } from 'react';
import { Loader2, Send } from 'lucide-react';
import { motion } from 'motion/react';
import './App.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface PastThread {
  id: string;
  firstMessage: string;
  timestamp: number;
}

const SYSTEM_PROMPT = 'You are a helpful travel assistant. Provide informative, friendly, and practical travel advice.';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [threadInput, setThreadInput] = useState('');
  const [currentThread, setCurrentThread] = useState<Message[]>([]);
  const [pastThreads, setPastThreads] = useState<PastThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string;
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedThread = localStorage.getItem('spotnana-current-thread');
    const savedPast = localStorage.getItem('spotnana-past-threads');
    if (savedThread) {
      try { setCurrentThread(JSON.parse(savedThread)); } catch {}
    }
    if (savedPast) {
      try { setPastThreads(JSON.parse(savedPast)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('spotnana-current-thread', JSON.stringify(currentThread));
  }, [currentThread]);

  useEffect(() => {
    localStorage.setItem('spotnana-past-threads', JSON.stringify(pastThreads));
  }, [pastThreads]);

  // Auto-scroll to latest message
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentThread, isLoading]);

  const callOpenAI = async (messages: { role: string; content: string }[]) => {
    const response = await fetch('/api/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to get response from AI');
    }

    const data = await response.json();
    return data.choices[0].message.content as string;
  };

  // Start a new conversation from the left-side input
  const handleSubmit = async () => {
    if (!prompt.trim()) { setError('Please enter a prompt'); return; }
    if (!apiKey) { setError('OpenAI API key not found. Add VITE_OPENAI_API_KEY to your .env file.'); return; }

    // Archive current thread if it has content
    if (currentThread.length > 0) {
      const firstUser = currentThread.find(m => m.role === 'user');
      if (firstUser) {
        setPastThreads(prev => [{
          id: Date.now().toString(),
          firstMessage: firstUser.content,
          timestamp: firstUser.timestamp,
        }, ...prev]);
      }
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: prompt, timestamp: Date.now() };
    setCurrentThread([userMsg]);
    setPrompt('');
    setIsLoading(true);
    setError('');

    try {
      const aiContent = await callOpenAI([{ role: 'user', content: userMsg.content }]);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: aiContent, timestamp: Date.now() };
      setCurrentThread([userMsg, aiMsg]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      setCurrentThread([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Continue the conversation from the right-side input
  const handleThreadSubmit = async () => {
    if (!threadInput.trim() || isLoading) return;
    if (!apiKey) { setError('OpenAI API key not found.'); return; }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: threadInput, timestamp: Date.now() };
    const updatedThread = [...currentThread, userMsg];
    setCurrentThread(updatedThread);
    setThreadInput('');
    setIsLoading(true);
    setError('');

    try {
      const aiContent = await callOpenAI(updatedThread.map(m => ({ role: m.role, content: m.content })));
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: aiContent, timestamp: Date.now() };
      setCurrentThread([...updatedThread, aiMsg]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => { setPrompt(''); setError(''); };

  const handleClearHistory = () => {
    setPastThreads([]);
    setCurrentThread([]);
    localStorage.removeItem('spotnana-past-threads');
    localStorage.removeItem('spotnana-current-thread');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleThreadKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleThreadSubmit(); }
  };

  return (
    <div className="app-container">
      <div className="main-content">

        {/* Left Section */}
        <div className="left-section">
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="app-title"
          >
            SPOTNANA.AI
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
            className="app-subtitle"
          >
            <p>Ask me anything about travel and I'll answer.</p>
            <p>Where would you like to go next?</p>
          </motion.div>

          <motion.textarea
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Start Planning your next trip"
            className="prompt-input"
          />

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="error-message"
            >
              <p>{error}</p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }}
            className="button-group"
          >
            <button onClick={handleClear} disabled={isLoading || !prompt.trim()} className="button button-clear">
              Clear
            </button>
            <button onClick={handleSubmit} disabled={isLoading || !prompt.trim()} className="button button-submit">
              {isLoading && currentThread.length === 0 ? (
                <><Loader2 className="spinner" /><span>Loading...</span></>
              ) : 'Submit'}
            </button>
          </motion.div>

          {/* Past threads */}
          {pastThreads.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="left-history">
              <div className="left-history-header">
                <span className="left-history-title">Past</span>
                <button className="left-history-clear" onClick={handleClearHistory}>Clear</button>
              </div>
              {pastThreads.map((thread) => (
                <div key={thread.id} className="left-history-item">
                  <p className="left-history-prompt">{thread.firstMessage}</p>
                  <p className="left-history-time">
                    {new Date(thread.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </motion.div>
          )}

          <footer className="footer">
            <p>© 2026 Spotnana.AI · <span className="footer-link">Privacy Policy</span> · <span className="footer-link">Terms of Use</span></p>
            <p className="footer-sub">Built by Darrien Carter</p>
          </footer>
        </div>

        {/* Divider */}
        <div className="divider" />

        {/* Right Section — conversation thread */}
        <div className="right-section">
          <div className="thread-messages">
            {currentThread.length === 0 && !isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1 }}
                className="empty-state"
              >
                <p>Your conversation will appear here</p>
              </motion.div>
            ) : (
              <>
                {currentThread.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className={`thread-message thread-message-${msg.role}`}
                  >
                    <p className="thread-role">{msg.role === 'user' ? 'You' : 'Spotnana AI'}</p>
                    <p className="thread-content">{msg.content}</p>
                    <p className="thread-timestamp">
                      {new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </motion.div>
                ))}

                {isLoading && (
                  <div className="thread-message thread-message-assistant">
                    <p className="thread-role">Spotnana AI</p>
                    <div className="loading-state">
                      <Loader2 className="spinner-large" />
                      <p>Thinking...</p>
                    </div>
                  </div>
                )}

                <div ref={threadEndRef} />
              </>
            )}
          </div>

          {/* Reply input — only shown when a thread is active */}
          {(currentThread.length > 0 || isLoading) && (
            <div className="thread-input-area">
              <textarea
                value={threadInput}
                onChange={(e) => setThreadInput(e.target.value)}
                onKeyDown={handleThreadKeyDown}
                placeholder="Continue the conversation..."
                className="thread-input"
                disabled={isLoading}
              />
              <button
                onClick={handleThreadSubmit}
                disabled={isLoading || !threadInput.trim()}
                className="thread-send"
              >
                <Send size={18} />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
