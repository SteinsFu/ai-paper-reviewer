import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "./Icon";
import { useAppState } from "../state/AppState";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { copilot } from "../services";
import { SUGGESTED_PROMPTS } from "../data/copilotScript";
import type { ChatMessage } from "../services/types";

export function ChatPanel() {
  const { chatOpen, setChatOpen, bundle, currentPaperId } = useAppState();
  // trap Tab within the drawer; the input manages its own autofocus below
  const trapRef = useFocusTrap<HTMLDivElement>(chatOpen, { autoFocus: false });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const paperTitle = bundle?.paper.title ?? "the current paper";
  const paperId = currentPaperId ?? "p1";  // fall back to mock's default when unset

  useEffect(() => {
    if (chatOpen) setTimeout(() => inputRef.current?.focus(), 220);
  }, [chatOpen]);

  // Toggle a document-level attribute so the app layout can reserve room for
  // the panel on wide screens — the reader-rail then sits next to the chat
  // rather than being covered by it (see `body[data-chat-open]` in CSS).
  useEffect(() => {
    const root = document.body;
    if (chatOpen) root.setAttribute("data-chat-open", "true");
    else root.removeAttribute("data-chat-open");
    return () => root.removeAttribute("data-chat-open");
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
    for await (const chunk of copilot.streamReply(next, { paperId, paperTitle })) {
      acc += chunk;
      setPartial(acc);
    }
    setMessages([...next, { role: "assistant", content: acc }]);
    setPartial("");
    setStreaming(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Ignore Enter while an IME composition is active (Japanese/Chinese/Korean
    // conversion). `keyCode === 229` covers older Safari; isComposing covers
    // the rest.
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  return (
    <>
      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          title="Ask the reviewer (⌘J)"
          aria-label="Ask the reviewer"
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            zIndex: 40,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 18px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(145deg, var(--accent), var(--accent-deep))",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "var(--sh-lg, 0 10px 24px rgba(0,0,0,0.18))",
          }}
        >
          <Icon name="spark" size={18} fill/>
          <span>Ask about this review</span>
          <kbd style={{
            marginLeft: 4,
            padding: "2px 6px",
            borderRadius: 5,
            background: "rgba(255,255,255,0.22)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.4,
          }}>⌘J</kbd>
        </button>
      )}
      <AnimatePresence>
      {chatOpen && (
        <>
          {/* Backdrop only shown as an overlay when the viewport is too narrow
              to fit chat and reader-rail side by side — see the CSS media
              query. On wide screens the app content shifts left instead. */}
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
                  <div className="chat-bubble">
                    {m.role === "assistant"
                      ? <MarkdownContent content={m.content}/>
                      : m.content}
                  </div>
                </div>
              ))}

              {streaming && (
                <div className="chat-msg assistant">
                  <AssistantAvatar/>
                  <div className="chat-bubble">
                    {partial.length === 0
                      ? <ThinkingDots/>
                      : <>
                          <MarkdownContent content={partial}/>
                          <span className="chat-caret"/>
                        </>}
                  </div>
                </div>
              )}
            </div>

            <div className="chat-input-row">
              <textarea ref={inputRef} className="chat-input" rows={1}
                placeholder="Ask about this review… / この査読について質問…"
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
    </>
  );
}

/** Render an assistant reply as Markdown.

We use react-markdown with remark-gfm so common LLM output shapes (bold,
lists, code blocks, tables, strikethrough) render properly inside a chat
bubble. Bullet spacing is tightened so short lists don't blow up the bubble. */
function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
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
