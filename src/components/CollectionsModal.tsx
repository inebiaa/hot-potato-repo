import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { supabase, EventCollection } from '../lib/supabase';

interface CollectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCollectionsUpdated: () => void;
}

export default function CollectionsModal({ isOpen, onClose, onCollectionsUpdated }: CollectionsModalProps) {
  const [collections, setCollections] = useState<EventCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        supabase.from('event_collections').select('*').order('sort_order').order('name'),
        supabase.from('events').select('collection_id'),
      ]).then(([colRes, eventsRes]) => {
        setCollections(colRes.data || []);
        const counts: Record<string, number> = {};
        (eventsRes.data || []).forEach((e: { collection_id: string | null }) => {
          if (e.collection_id) {
            counts[e.collection_id] = (counts[e.collection_id] || 0) + 1;
          }
        });
        setEventCounts(counts);
        setLoading(false);
      });
    }
  }, [isOpen]);

  const startEdit = (c: EventCollection) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDescription(c.description || '');
    setEditSortOrder(c.sort_order);
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
    setEditSortOrder(0);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setError('');
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('event_collections')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          sort_order: editSortOrder,
        })
        .eq('id', editingId);
      if (updateError) throw updateError;
      setCollections((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? { ...c, name: editName.trim(), description: editDescription.trim() || null, sort_order: editSortOrder }
            : c
        )
      );
      setEditingId(null);
      onCollectionsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update collection');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this collection? Events in it will become ungrouped.')) return;
    setSaving(true);
    setError('');
    try {
      const { error: unsetError } = await supabase.from('events').update({ collection_id: null }).eq('collection_id', id);
      if (unsetError) throw unsetError;
      const { error: deleteError } = await supabase.from('event_collections').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setCollections((prev) => prev.filter((c) => c.id !== id));
      setEventCounts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onCollectionsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete collection');
    } finally {
      setSaving(false);
    }
  };

  const startAdd = () => {
    setIsAdding(true);
    setNewName('');
    setNewDescription('');
    setNewSortOrder(collections.length > 0 ? Math.max(...collections.map((c) => c.sort_order)) + 1 : 0);
    setError('');
  };

  const cancelAdd = () => {
    setIsAdding(false);
  };

  const saveAdd = async () => {
    if (!newName.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data, error: insertError } = await supabase
        .from('event_collections')
        .insert({ name: newName.trim(), description: newDescription.trim() || null, sort_order: newSortOrder })
        .select('id, name, description, sort_order, created_at')
        .single();
      if (insertError) throw insertError;
      setCollections((prev) => [...prev, data].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
      setIsAdding(false);
      onCollectionsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-w-lg w-full my-8" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <FolderOpen size={24} />
          <h2 className="text-xl font-bold">Collections</h2>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Group events into collections (e.g. &quot;NYFW Fall 2024&quot;). Assign a collection when adding or editing a show.
              </p>
              <div className="space-y-2 mb-4">
                {collections.map((c) => (
                  <div
                    key={c.id}
                    className="border rounded-lg p-3 flex items-center justify-between gap-2"
                  >
                    {editingId === c.id ? (
                      <div className="flex-1 space-y-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Collection name"
                        />
                        <input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="Description (optional)"
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Order:</label>
                          <input
                            type="number"
                            value={editSortOrder}
                            onChange={(e) => setEditSortOrder(Number(e.target.value))}
                            className="w-16 px-2 py-1 border rounded text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button onClick={cancelEdit} className="text-sm px-3 py-1 border rounded hover:bg-gray-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="font-medium">{c.name}</span>
                          {c.description && (
                            <p className="text-xs text-gray-500">{c.description}</p>
                          )}
                          <span className="text-xs text-gray-400">{(eventCounts[c.id] || 0)} shows</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(c)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={saving}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {isAdding ? (
                <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                    placeholder="Collection name"
                  />
                  <input
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                    placeholder="Description (optional)"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Order:</label>
                    <input
                      type="number"
                      value={newSortOrder}
                      onChange={(e) => setNewSortOrder(Number(e.target.value))}
                      className="w-16 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveAdd}
                      disabled={saving}
                      className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Create
                    </button>
                    <button onClick={cancelAdd} className="text-sm px-3 py-1 border rounded hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={startAdd}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  <Plus size={18} />
                  Add collection
                </button>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
