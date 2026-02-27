import { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { supabase, EditSuggestion, Event } from '../lib/supabase';

interface SuggestionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSuggestionProcessed: () => void;
}

interface SuggestionWithDetails extends EditSuggestion {
  event_name?: string;
  suggested_by_email?: string;
}

export default function SuggestionsPanel({ isOpen, onClose, onSuggestionProcessed }: SuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<SuggestionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionWithDetails | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchSuggestions();
    }
  }, [isOpen]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('edit_suggestions')
        .select(`
          *,
          events!edit_suggestions_event_id_fkey(name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const suggestionsWithDetails = await Promise.all(
        (data || []).map(async (suggestion: any) => {
          const { data: userData } = await supabase
            .from('user_profiles')
            .select('username')
            .eq('user_id', suggestion.suggested_by)
            .maybeSingle();

          return {
            ...suggestion,
            event_name: suggestion.events?.name,
            suggested_by_email: userData?.username || 'Unknown user',
          };
        })
      );

      setSuggestions(suggestionsWithDetails);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (suggestion: SuggestionWithDetails) => {
    if (!confirm('Are you sure you want to apply these changes to the event?')) {
      return;
    }

    setProcessingId(suggestion.id);
    try {
      const { error: updateError } = await supabase
        .from('events')
        .update(suggestion.suggestion_data)
        .eq('id', suggestion.event_id);

      if (updateError) throw updateError;

      const { error: suggestionError } = await supabase
        .from('edit_suggestions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestion.id);

      if (suggestionError) throw suggestionError;

      onSuggestionProcessed();
      fetchSuggestions();
      setSelectedSuggestion(null);
    } catch (error) {
      console.error('Error approving suggestion:', error);
      alert('Failed to approve suggestion');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestionId: string) => {
    if (!confirm('Are you sure you want to reject this suggestion?')) {
      return;
    }

    setProcessingId(suggestionId);
    try {
      const { error } = await supabase
        .from('edit_suggestions')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      if (error) throw error;

      fetchSuggestions();
      setSelectedSuggestion(null);
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      alert('Failed to reject suggestion');
    } finally {
      setProcessingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Edit Suggestions</h2>
            <p className="text-sm text-gray-600 mt-1">
              Review and approve suggested changes from users
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading suggestions...</div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle size={48} className="mx-auto mb-4 text-gray-400" />
              <p>No pending suggestions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{suggestion.event_name}</h3>
                      <p className="text-sm text-gray-600">
                        Suggested by: {suggestion.suggested_by_email}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(suggestion.created_at).toLocaleDateString()} at{' '}
                        {new Date(suggestion.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedSuggestion(suggestion)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleApprove(suggestion)}
                        disabled={processingId === suggestion.id}
                        className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check size={16} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(suggestion.id)}
                        disabled={processingId === suggestion.id}
                        className="px-3 py-1 text-sm bg-red-600 text-white hover:bg-red-700 rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <X size={16} />
                        Reject
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
                    <p className="text-sm text-gray-600">{suggestion.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedSuggestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold">Suggested Changes</h3>
              <button
                onClick={() => setSelectedSuggestion(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(selectedSuggestion.suggestion_data).map(([key, value]) => (
                <div key={key} className="border-b pb-2">
                  <p className="text-sm font-medium text-gray-700 capitalize">
                    {key.replace(/_/g, ' ')}:
                  </p>
                  <p className="text-sm text-gray-900 mt-1">
                    {Array.isArray(value) ? value.join(', ') : String(value || '—')}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => handleReject(selectedSuggestion.id)}
                disabled={processingId === selectedSuggestion.id}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(selectedSuggestion)}
                disabled={processingId === selectedSuggestion.id}
                className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded transition-colors disabled:opacity-50"
              >
                Approve & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
