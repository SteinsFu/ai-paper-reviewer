import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "./Icon";
import { useAppState } from "../state/AppState";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { copilot } from "../services";
import { SUGGESTED_PROMPTS } from "../data/copilotScript";
import type { ChatMessage } from "../services/types";

export function ChatPanel() {
  const { chatOpen, setChatOpen, bundle } = useAppState();
  // trap Tab within the drawer; the input manages its own autofocus below
  const trapRef = useFocusTrap<HTMLDivElement>(chatOpen, { autoFocus: false });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const paperTitle = bundle?.paper.title ?? "the current paper";

  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 220);
  }, [chatOpen]);

  // keep scrolled to bottom while streaming
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, partial, chatOpen]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setStreaming(true);
    setPartial("");
    let acc = "";
    for await (const chunk of copilot.streamReply(next, { paperId: "p1", paperTitle })) {
      acc += chunk;
      setPartial(acc);
    }
    setMessages([...next, { role: "assistant", content: acc }]);
    setPartial("");
    setStreaming(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  return (
    <AnimatePresence>
      {chatOpen && (
        <>
          <motion.div key="chat-backdrop" className="chat-backdrop"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.18 }}
            onClick={() => setChatOpen(false)}/>
          <motion.div key="chat" ref={trapRef} className="chat-panel" role="dialog" aria-label="Margin copilot"
            initial={{ x:420, opacity:0.6 }} animate={{ x:0, opacity:1 }} exit={{ x:420, opacity:0.6 }}
            transition={{ type:"spring", stiffness:380, damping:36 }}>

            <div className="chat-head">
              <div className="brand-mark" style={{ width:26, height:26, borderRadius:8 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:700, letterSpacing:"-0.01em" }}>Margin copilot</div>
                <div style={{ fontSize:11.5, color:"var(--text-3)", overflow:"hidden",
                  textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{paperTitle}</div>
              </div>
              <button className="icon-btn" onClick={() => setChatOpen(false)} title="Close (Esc)">
                <Icon name="close" size={15}/>
              </button>
            </div>

            <div ref={bodyRef} className="chat-body scroll">
              {messages.length === 0 && !streaming && (
                <div style={{ margin:"auto 0", textAlign:"center", padding:"20px 10px" }}>
                  <div style={{ width:46, height:46, borderRadius:14, margin:"0 auto 14px",
                    background:"var(--accent-soft)", display:"grid", placeItems:"center",
                    color:"var(--accent-deep)" }}>
                    <Icon name="spark" size={22} fill/>
                  </div>
                  <div style={{ fontSize:14.5, fontWeight:600, marginBottom:5 }}>Ask the reviewer</div>
                  <div style={{ fontSize:12.5, color:"var(--text-3)", lineHeight:1.5, marginBottom:18 }}>
                    Questions about the notes, the novelty check,<br/>or what to fix first.
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"center" }}>
                    {SUGGESTED_PROMPTS.map((p) => (
                      <button key={p} className="chat-suggestion" onClick={() => void send(p)}>{p}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`chat-msg ${m.role}`}>
                  {m.role === "assistant" && <AssistantAvatar/>}
                  <div className="chat-bubble">{m.content}</div>
                </div>
              ))}

              {streaming && (
                <div className="chat-msg assistant">
                  <AssistantAvatar/>
                  <div className="chat-bubble">
                    {partial.length === 0
                      ? <ThinkingDots/>
                      : <>{partial}<span className="chat-caret"/></>}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding:"0 16px 4px", fontSize:10.5, color:"var(--text-4)", textAlign:"center" }}>
              Mocked responses — live Claude API backend coming next.
            </div>
            <div className="chat-input-row">
              <textarea ref={inputRef} className="chat-input" rows={1}
                placeholder="Ask about this review…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}/>
              <button className="chat-send" disabled={!draft.trim() || streaming}
                onClick={() => void send(draft)} title="Send">
                <Icon name="send" size={15} strokeWidth={2}/>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function AssistantAvatar() {
  return (
    <div style={{ width:24, height:24, borderRadius:8, flex:"0 0 auto", marginTop:2,
      background:"linear-gradient(145deg, var(--accent), var(--accent-deep))",
      display:"grid", placeItems:"center", color:"#fff" }}>
      <Icon name="spark" size={13} fill/>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span style={{ display:"inline-flex", gap:4, padding:"3px 0" }}>
      {[0, 1, 2].map((i) => (
        <motion.span key={i}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.18 }}
          style={{ width:6, height:6, borderRadius:99, background:"var(--text-3)" }}/>
      ))}
    </span>
  );
}
