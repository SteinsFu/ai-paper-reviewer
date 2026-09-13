import { useCallback, useEffect, useState } from "react";
import { api } from "../services";
import type { CreateNoteInput } from "../services/api";
import type { Note } from "../services/types";

interface UseNotesResult {
  notes: Note[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  create: (input: CreateNoteInput) => Promise<Note | null>;
  update: (noteId: string, body: string) => Promise<Note | null>;
  remove: (noteId: string) => Promise<boolean>;
  markRead: () => Promise<void>;
}

/** Server-backed notes on a paper. Reloads on `paperId` change; callers can
    also force a reload after external mutations (e.g. via SSE, mark-read
    from another tab). */
export function useNotes(paperId: string): UseNotesResult {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!paperId) { setNotes([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const list = await api.listNotes(paperId);
      setNotes(list);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => { void reload(); }, [reload]);

  const create = useCallback(async (input: CreateNoteInput) => {
    try {
      const note = await api.createNote(paperId, input);
      setNotes((prev) => [...prev, note]);
      return note;
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      return null;
    }
  }, [paperId]);

  const update = useCallback(async (noteId: string, body: string) => {
    try {
      const updated = await api.updateNote(paperId, noteId, body);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      return updated;
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      return null;
    }
  }, [paperId]);

  const remove = useCallback(async (noteId: string) => {
    try {
      await api.deleteNote(paperId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId && n.parentNoteId !== noteId));
      return true;
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      return false;
    }
  }, [paperId]);

  const markRead = useCallback(async () => {
    try { await api.markNotesRead(paperId); }
    catch (e) { setError(String((e as Error)?.message ?? e)); }
  }, [paperId]);

  return { notes, loading, error, reload, create, update, remove, markRead };
}
