'use client';

import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Send, Sparkles, Bot, User, Map,
  BarChart3, Zap, Loader2, Copy, ThumbsUp, ThumbsDown
} from 'lucide-react';
import {
  mockChatHistory, suggestedPrompts, type ChatMessage
} from '@/lib/mock-data';

const aiResponses: Record<string, string> = {
  'Which Mumbai shipments can be merged tomorrow?': `I found **8 shipments** heading to Mumbai tomorrow that can be consolidated:\n\n📦 **SHP-0012, SHP-0018, SHP-0025, SHP-0031, SHP-0044, SHP-0056, SHP-0078, SHP-0091**\n\n**Consolidation Recommendation:**\n• Combined weight: 12,450 kg (fits Ashok Leyland 1612)\n• Volume utilization: 87%\n• Route: Delhi → Jaipur → Ahmedabad → Mumbai\n• **Estimated savings: ₹24,000** (31% cost reduction)\n• **CO₂ reduction: 180 kg**\n\nWould you like me to run the full consolidation for these shipments?`,
  'Show me routes with less than 60% utilization': `I found **3 routes** with utilization below 60%:\n\n🔴 **Route R-007** — Eicher 10.59\n  • Utilization: 52% | Weight: 3,640 kg of 7,000 kg\n  • Route: Delhi → Lucknow\n  • Recommendation: Merge with Route R-003\n\n🔴 **Route R-011** — Tata 407\n  • Utilization: 48% | Weight: 1,200 kg of 2,500 kg\n  • Route: Pune → Mumbai\n  • Recommendation: Add 3 pending Pune shipments\n\n🟡 **Route R-015** — Eicher 10.59\n  • Utilization: 58% | Weight: 4,060 kg of 7,000 kg\n  • Route: Chennai → Bangalore\n  • Recommendation: Include SHP-0067 and SHP-0089\n\n**Action: Optimizing these could save ₹15,000.**`,
  "What's the best vehicle for the Pune cluster?": `For the **Pune cluster** (5 shipments, 8,200 kg total, 22.4 m³):\n\n📊 **Vehicle Recommendation Analysis:**\n\n| Vehicle | Capacity | Utilization | Cost | Score |\n|---------|----------|------------|------|-------|\n| **Ashok Leyland 1612** ⭐ | 12,000 kg | **68%** | ₹14,400 | Best |\n| BharatBenz 2823 | 18,000 kg | 46% | ₹16,800 | Over-spec |\n| Eicher 10.59 | 7,000 kg | ⚠️ 117% | — | Too small |\n\n✅ **Best pick: Ashok Leyland 1612**\n• Weight utilization: 68% (room for 3,800 kg more)\n• Volume utilization: 53%\n• Estimated cost: ₹14,400\n• Could add 2 more Pune shipments for 85% utilization\n\nShall I recalculate with additional shipments?`,
  "What if I add 5 more shipments to cluster 3?": `📊 **Simulation: Cluster 3 + 5 Additional Shipments**\n\n**Current Cluster 3:**\n• 3 shipments | Eicher 10.59 | 78% utilization\n• Weight: 5,460 kg | Distance: 680 km\n\n**After adding 5 shipments:**\n• Total weight: 9,240 kg → ⚠️ Over capacity for Eicher (7,000 kg max)\n• **Vehicle upgrade required → Ashok Leyland 1612**\n\n📈 **Revised Metrics:**\n• Utilization: 78% → **77%** (larger vehicle)\n• Cost: ₹12,240 → **₹18,720** (+53% but fewer total trips)\n• CO₂: 34.2 kg → **52.8 kg** (+54%)\n• Net savings vs separate trips: **₹8,400**\n\n💡 **Verdict:** Add only 3 of the 5 shipments to keep the Eicher at **94% utilization** — optimal!`,
  'Generate a consolidation report for today': `📄 **Consolidation Report — March 7, 2026**\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n**EXECUTIVE SUMMARY**\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n• Total Shipments Processed: **150**\n• Clusters Created: **31**\n• Trips Before: **47** → After: **31** (▼34%)\n• Avg Utilization: **58%** → **87%** (▲29%)\n• Total Cost: **₹4.5L** → **₹3.1L** (▼31%)\n• CO₂ Savings: **800 kg** (▼33%)\n\n**TOP PERFORMING CLUSTERS:**\n1. CL-001: 91% utilization | ₹34,080 | Delhi-Mumbai corridor\n2. CL-006: 89% utilization | ₹40,320 | Bangalore-Nagpur corridor\n3. CL-002: 87% utilization | ₹59,200 | Mumbai-Chennai corridor\n\n📥 Report is ready for download in PDF, CSV, and Excel formats.`,
  'How much CO₂ can we save this week?': `🌍 **Weekly CO₂ Forecast (March 7-13, 2026)**\n\n**Estimated Shipments:** 1,050 (150/day avg)\n\n📊 **Projection:**\n• Without consolidation: **16,800 kg CO₂**\n• With AI optimization: **11,200 kg CO₂**\n• **Potential savings: 5,600 kg CO₂** (33% reduction)\n\n🌳 **That's equivalent to:**\n• Planting **255 trees**\n• Avoiding **35,000 km** of car travel\n• Saving **2,100 liters** of diesel\n\n📈 **Trend:** Last week we saved 4,800 kg — this week we can improve by **17%** if we consolidate the newly detected Chennai cluster.\n\nWant me to auto-schedule daily consolidation runs?`,
};

export default function CopilotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(mockChatHistory);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (text?: string) => {
    const query = text || input;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const response = aiResponses[query] ||
        `I analyzed your query: "${query}"\n\nBased on the current logistics data, here are my findings:\n\n📊 **Analysis Complete**\n• Processed 150 active shipments across 15 cities\n• Identified 3 optimization opportunities\n• Estimated savings potential: ₹12,000-₹18,000\n\nWould you like me to dive deeper into any specific aspect of this analysis?`;

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { label: 'Show on Map', type: 'map' },
          { label: 'Run Optimization', type: 'optimize' },
        ],
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'var(--gradient-primary)',
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} color="white" />
          </div>
          <div>
            <h1 className="page-title">AI Co-Pilot</h1>
            <p className="page-subtitle">Natural language interface to the optimization engine</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#34d399',
            boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)',
          }} />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Groq Mixtral-8x7B Online</span>
        </div>
      </div>

      <div className="chat-container">
        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className="animate-slide-up" style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}>
              {/* Avatar */}
              <div style={{
                width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
                background: msg.role === 'user' ? 'var(--bg-tertiary)' : 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {msg.role === 'user' ? <User size={14} color="var(--text-secondary)" /> : <Bot size={14} color="white" />}
              </div>

              <div style={{ maxWidth: '70%' }}>
                <div className={`chat-bubble ${msg.role}`}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content.split('\n').map((line, i) => {
                      // Simple markdown-like rendering
                      const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                      return <p key={i} dangerouslySetInnerHTML={{ __html: boldLine }} style={{ margin: '2px 0' }} />;
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {msg.actions.map((action) => (
                      <button key={action.label} className="btn btn-sm btn-secondary">
                        {action.type === 'map' ? <Map size={12} /> : action.type === 'optimize' ? <Zap size={12} /> : <BarChart3 size={12} />}
                        {action.label}
                      </button>
                    ))}
                    <button className="btn btn-sm btn-ghost"><Copy size={12} /></button>
                    <button className="btn btn-sm btn-ghost"><ThumbsUp size={12} /></button>
                    <button className="btn btn-sm btn-ghost"><ThumbsDown size={12} /></button>
                  </div>
                )}

                {/* Timestamp */}
                <div style={{
                  fontSize: '10px',
                  color: 'var(--text-tertiary)',
                  marginTop: '6px',
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                }}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: 'var(--radius-md)',
                background: 'var(--gradient-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Bot size={14} color="white" />
              </div>
              <div className="chat-bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  display: 'flex', gap: '4px',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: 'var(--text-tertiary)',
                      animation: `pulse-glow 1.2s ease infinite ${i * 0.15}s`,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Analyzing...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <input
              className="chat-input"
              placeholder="Ask Lorri anything about your logistics..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button
              className="chat-send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              style={{ opacity: input.trim() ? 1 : 0.5 }}
            >
              <Send size={18} />
            </button>
          </div>

          {/* Suggested Prompts */}
          <div className="chat-chips">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                className="chat-chip"
                onClick={() => handleSend(prompt)}
                disabled={isTyping}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
