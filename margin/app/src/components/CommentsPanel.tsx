/* ============================================================
   CommentsPanel — user-authored notes (server-backed).
   Threaded 1-level (root + replies), Slack-style. Renders in the
   reader-rail alongside AI annotations, with a filled composer at
   the bottom for new root notes or replies to a specific root.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "./Icon";
import { useAppState } from "../state/AppState";
import { useNotes } from "../hooks/useNotes";
import type { Note, TextAnchor } from "../services/types";

interface Props {
  paperId: string;
  /** Called after mount so the parent can zero the paper's unread-notes count. */
  onOpened?: () => void;
  /** When set, seed the composer with an anchor. Used by the manuscript
      text-selection popover. Consumed via `pendingAnchor` prop. */
  pendingAnchor?: (TextAnchor & { section?: string }) | null;
  /** Called by the panel when it has consumed / cleared the pending anchor. */
  onPendingAnchorConsumed?: () => void;
  /** Called when the user clicks an anchor chip on a note, so the reader can
      scroll the manuscript to the anchored passage. */
  onNavigateAnchor?: (anchor: TextAnchor) => void;
}

export function CommentsPanel({
  paperId, onOpened, pendingAnchor, onPendingAnchorConsumed, onNavigateAnchor,
}: Props) {
  const { account } = useAppState();
  const { notes, loading, error, create, update, remove, markRead, reload } = useNotes(paperId);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [attachedAnchor, setAttachedAnchor] = useState<TextAnchor | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const currentUserId = account?.email ?? "";

  // Consume the pending anchor from the reader as soon as it arrives.
  useEffect(() => {
    if (pendingAnchor) {
      setAttachedAnchor({
        blockIndex: pendingAnchor.blockIndex,
        start: pendingAnchor.start,
        end: pendingAnchor.end,
        quote: pendingAnchor.quote,
      });
      setReplyingTo(null); // an anchored note is always a root note
      onPendingAnchorConsumed?.();
      // Focus the composer so typing lands there straight away.
      setTimeout(() => composerRef.current?.focus(), 40);
    }
  }, [pendingAnchor, onPendingAnchorConsumed]);

  useEffect(() => {
    onOpened?.();
    void markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  const threads = useMemo(() => {
    const roots = notes.filter((n) => !n.parentNoteId);
    const repliesByParent: Record<string, Note[]> = {};
    for (const n of notes) {
      if (n.parentNoteId) (repliesByParent[n.parentNoteId] ??= []).push(n);
    }
    for (const list of Object.values(repliesByParent)) list.sort((a, b) => a.createdAt - b.createdAt);
    return roots
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({ root: r, replies: repliesByParent[r.id] ?? [] }));
  }, [notes]);

  async function submitRoot() {
    const body = draft.trim();
    if (!body) return;
    const created = await create({ body, anchor: attachedAnchor });
    if (created) {
      setDraft("");
      setAttachedAnchor(null);
      // Scroll to bottom so the new note is visible.
      setTimeout(() => {
        bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
      }, 40);
    }
  }

  async function submitReply(parentId: string) {
    const body = replyDraft.trim();
    if (!body) return;
    const created = await create({ body, parentNoteId: parentId });
    if (created) {
      setReplyDraft("");
      setReplyingTo(null);
    }
  }

  async function saveEdit(noteId: string) {
    const body = editDraft.trim();
    if (!body) return;
    const updated = await update(noteId, body);
    if (updated) {
      setEditingId(null);
      setEditDraft("");
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditDraft(note.body);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>, fn: () => void) {
    // Enter → send, Shift+Enter → newline. IME composition is respected.
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      fn();
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:0, flex:1 }}>
      <div ref={bodyRef} className="scroll"
        style={{ flex:1, overflowY:"auto", padding:"12px 14px 8px" }}>
        {loading && (
          <div style={{ padding:"24px 12px", textAlign:"center", color:"var(--text-3)", fontSize:13 }}>
            Loading comments…
          </div>
        )}

        {error && !loading && (
          <div className="card" style={{ padding:12, background:"var(--critical-soft, rgba(220,38,38,0.08))",
            border:"1px solid var(--critical, #dc2626)", color:"var(--critical, #dc2626)",
            fontSize:12.5, marginBottom:8 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>Couldn't load comments</div>
            <div>{error}</div>
            <button className="btn btn-sm" onClick={() => void reload()} style={{ marginTop:8 }}>
              Retry
            </button>
          </div>
        )}

        {!loading && threads.length === 0 && !error && (
          <div style={{ padding:"22px 12px", textAlign:"center" }}>
            <div style={{ width:40, height:40, borderRadius:12, margin:"0 auto 10px",
              background:"var(--accent-soft)", display:"grid", placeItems:"center",
              color:"var(--accent-deep)" }}>
              <Icon name="chat" size={19}/>
            </div>
            <div style={{ fontSize:13.5, fontWeight:600, marginBottom:3 }}>No comments yet</div>
            <div style={{ fontSize:12, color:"var(--text-3)", lineHeight:1.5 }}>
              Start a discussion — anyone with this paper's id can join.
            </div>
          </div>
        )}

        {threads.map(({ root, replies }) => (
          <ThreadBlock
            key={root.id}
            root={root}
            replies={replies}
            currentUserId={currentUserId}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            replyDraft={replyDraft}
            setReplyDraft={setReplyDraft}
            editingId={editingId}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            onStartEdit={startEdit}
            onCancelEdit={() => { setEditingId(null); setEditDraft(""); }}
            onSaveEdit={saveEdit}
            onDelete={remove}
            onSubmitReply={submitReply}
            onKey={onKey}
            onNavigateAnchor={onNavigateAnchor}
          />
        ))}
      </div>

      {/* root composer */}
      <div style={{ borderTop:"1px solid var(--line-2)", padding:"10px 12px 12px",
        background:"var(--surface)" }}>
        {attachedAnchor && (
          <div className="chip" style={{ marginBottom:8, background:"var(--accent-soft)",
            color:"var(--accent-press)", fontSize:12, gap:6 }}>
            <Icon name="quote" size={12}/>
            <span style={{ maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              "{attachedAnchor.quote}"
            </span>
            <button className="icon-btn"
              onClick={() => setAttachedAnchor(null)}
              title="Remove anchor" aria-label="Remove anchor"
              style={{ width:20, height:20 }}>
              <Icon name="close" size={11}/>
            </button>
          </div>
        )}
        <textarea
          ref={composerRef}
          className="chat-input"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => onKey(e, submitRoot)}
          placeholder={attachedAnchor
            ? "Add a note on this passage…"
            : "Leave a comment for anyone reviewing this paper…"}
          style={{ width:"100%", padding:"9px 11px", fontSize:13.5, resize:"vertical",
            minHeight:44, maxHeight:180 }}
        />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          marginTop:6, fontSize:11, color:"var(--text-4)" }}>
          <span>Enter to post · Shift+Enter for newline</span>
          <button className="btn btn-sm btn-primary" disabled={!draft.trim()}
            onClick={() => void submitRoot()}
            style={{ opacity: draft.trim() ? 1 : 0.5 }}>
            Post
          </button>
        </div>
      </div>
    </div>
  );
}


function ThreadBlock({
  root, replies, currentUserId,
  replyingTo, setReplyingTo, replyDraft, setReplyDraft,
  editingId, editDraft, setEditDraft,
  onStartEdit, onCancelEdit, onSaveEdit, onDelete, onSubmitReply, onKey,
  onNavigateAnchor,
}: {
  root: Note; replies: Note[]; currentUserId: string;
  replyingTo: string | null; setReplyingTo: (v: string | null) => void;
  replyDraft: string; setReplyDraft: (v: string) => void;
  editingId: string | null; editDraft: string; setEditDraft: (v: string) => void;
  onStartEdit: (n: Note) => void; onCancelEdit: () => void;
  onSaveEdit: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
  onSubmitReply: (parentId: string) => Promise<void>;
  onKey: (e: React.KeyboardEvent<HTMLTextAreaElement>, fn: () => void) => void;
  onNavigateAnchor?: (anchor: TextAnchor) => void;
}) {
  return (
    <motion.div layout style={{ marginBottom:14, padding:"11px 12px 9px",
      background:"var(--surface-2)", border:"1px solid var(--line-2)",
      borderRadius:10 }}>
      <NoteRow note={root}
        currentUserId={currentUserId}
        editingId={editingId} editDraft={editDraft} setEditDraft={setEditDraft}
        onStartEdit={onStartEdit} onCancelEdit={onCancelEdit} onSaveEdit={onSaveEdit}
        onDelete={onDelete}
        onKey={onKey}
        onNavigateAnchor={onNavigateAnchor}
      />

      {replies.map((r) => (
        <div key={r.id} style={{ marginTop:8, paddingLeft:14,
          borderLeft:"2px solid var(--line-2)" }}>
          <NoteRow note={r}
            currentUserId={currentUserId}
            editingId={editingId} editDraft={editDraft} setEditDraft={setEditDraft}
            onStartEdit={onStartEdit} onCancelEdit={onCancelEdit} onSaveEdit={onSaveEdit}
            onDelete={onDelete}
            onKey={onKey}
            small
          />
        </div>
      ))}

      {replyingTo === root.id ? (
        <div style={{ marginTop:9, paddingLeft:14, borderLeft:"2px dashed var(--line-2)" }}>
          <textarea
            className="chat-input"
            rows={2}
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            onKeyDown={(e) => onKey(e, () => void onSubmitReply(root.id))}
            placeholder="Reply…"
            autoFocus
            style={{ width:"100%", padding:"7px 10px", fontSize:13, resize:"vertical" }}
          />
          <div style={{ display:"flex", justifyContent:"flex-end", gap:6, marginTop:5 }}>
            <button className="btn btn-sm" onClick={() => { setReplyingTo(null); setReplyDraft(""); }}>
              Cancel
            </button>
            <button className="btn btn-sm btn-primary" disabled={!replyDraft.trim()}
              onClick={() => void onSubmitReply(root.id)}
              style={{ opacity: replyDraft.trim() ? 1 : 0.5 }}>
              Reply
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn-sm" onClick={() => { setReplyingTo(root.id); setReplyDraft(""); }}
          style={{ marginTop:7 }}>
          <Icon name="chat" size={12}/> Reply
        </button>
      )}
    </motion.div>
  );
}


function NoteRow({
  note, currentUserId,
  editingId, editDraft, setEditDraft,
  onStartEdit, onCancelEdit, onSaveEdit, onDelete,
  onKey,
  onNavigateAnchor,
  small = false,
}: {
  note: Note; currentUserId: string;
  editingId: string | null; editDraft: string; setEditDraft: (v: string) => void;
  onStartEdit: (n: Note) => void; onCancelEdit: () => void;
  onSaveEdit: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
  onKey: (e: React.KeyboardEvent<HTMLTextAreaElement>, fn: () => void) => void;
  onNavigateAnchor?: (anchor: TextAnchor) => void;
  small?: boolean;
}) {
  const isMine = note.authorId === currentUserId && currentUserId !== "";
  const editing = editingId === note.id;
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const nameSize = small ? 12 : 13;
  const bodySize = small ? 12.5 : 13.5;

  const dateFmt = new Date(note.createdAt).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
        <div aria-hidden style={{ width:22, height:22, borderRadius:8, background:"var(--accent-soft)",
          color:"var(--accent-deep)", display:"grid", placeItems:"center", fontSize:11, fontWeight:700 }}>
          {initials(note.authorName || note.authorId)}
        </div>
        <span style={{ fontSize:nameSize, fontWeight:600 }}>{note.authorName || note.authorId}</span>
        {isMine && <span className="chip" style={{ fontSize:10.5, height:16, padding:"0 6px" }}>You</span>}
        <span style={{ fontSize:11, color:"var(--text-3)", marginLeft:"auto" }}>{dateFmt}</span>
      </div>

      {note.anchor && (
        <button className="chip"
          onClick={() => onNavigateAnchor?.(note.anchor!)}
          disabled={!onNavigateAnchor}
          style={{ marginBottom:5, gap:5, cursor: onNavigateAnchor ? "pointer" : "default",
            background:"var(--surface-3, rgba(0,0,0,0.05))", fontSize:11.5,
            maxWidth:"100%", textAlign:"left", height:"auto", padding:"3px 8px" }}>
          <Icon name="quote" size={11}/>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:240 }}>
            "{note.anchor.quote}"
          </span>
        </button>
      )}

      {!editing ? (
        <div style={{ fontSize:bodySize, lineHeight:1.5, color:"var(--text)", whiteSpace:"pre-wrap" }}>
          {note.body}
        </div>
      ) : (
        <>
          <textarea
            className="chat-input"
            rows={3}
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={(e) => onKey(e, () => void onSaveEdit(note.id))}
            style={{ width:"100%", fontSize:bodySize, padding:"7px 10px", resize:"vertical" }}
          />
          <div style={{ display:"flex", justifyContent:"flex-end", gap:6, marginTop:5 }}>
            <button className="btn btn-sm" onClick={onCancelEdit}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={() => void onSaveEdit(note.id)}
              disabled={!editDraft.trim()} style={{ opacity: editDraft.trim() ? 1 : 0.5 }}>
              Save
            </button>
          </div>
        </>
      )}

      {isMine && !editing && (
        <div style={{ display:"flex", gap:4, marginTop:5 }}>
          {confirmingDelete ? (
            <>
              <span style={{ fontSize:11, color:"var(--text-3)", alignSelf:"center", marginRight:4 }}>
                Delete this note?
              </span>
              <button className="btn btn-sm" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              <button className="btn btn-sm" style={{ color:"var(--critical, #dc2626)" }}
                onClick={async () => { setConfirmingDelete(false); await onDelete(note.id); }}>
                Delete
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-sm" style={{ fontSize:11 }} onClick={() => onStartEdit(note)}>
                Edit
              </button>
              <button className="btn btn-sm" style={{ fontSize:11 }} onClick={() => setConfirmingDelete(true)}>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function initials(nameOrEmail: string): string {
  const base = (nameOrEmail || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
