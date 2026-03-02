import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase, Event } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SuggestEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuggestionSubmitted: () => void;
  event: Event;
}

export default function SuggestEditModal({ isOpen, onClose, onSuggestionSubmitted, event }: SuggestEditModalProps) {
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description);
  const [date, setDate] = useState(event.date.slice(0, 10));
  const [city, setCity] = useState(event.city || '');
  const [season, setSeason] = useState(event.season || '');
  const [location, setLocation] = useState(event.location || '');
  const [address, setAddress] = useState(event.address || '');
  const [imageUrl, setImageUrl] = useState(event.image_url || '');
  const [producers, setProducers] = useState(event.producers?.join(', ') || '');
  const [designers, setDesigners] = useState(event.featured_designers?.join(', ') || '');
  const [models, setModels] = useState(event.models?.join(', ') || '');
  const [hairMakeup, setHairMakeup] = useState(event.hair_makeup?.join(', ') || '');
  const [headerTags, setHeaderTags] = useState(event.header_tags?.join(', ') || '');
  const [footerTags, setFooterTags] = useState(event.footer_tags?.join(', ') || '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  if (!isOpen) return null;

  const parseArray = (str: string): string[] | null => {
    if (!str.trim()) return null;
    return str.split(',').map(item => item.trim()).filter(item => item);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to suggest edits');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for your suggested changes');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const suggestionData = {
        name,
        description,
        date,
        city: city || '',
        season: season || null,
        location: location || null,
        address: address || null,
        image_url: imageUrl || null,
        producers: parseArray(producers),
        featured_designers: parseArray(designers),
        models: parseArray(models),
        hair_makeup: parseArray(hairMakeup),
        header_tags: parseArray(headerTags),
        footer_tags: parseArray(footerTags),
      };

      const { error: insertError } = await supabase.from('edit_suggestions').insert({
        event_id: event.id,
        suggested_by: user.id,
        suggestion_data: suggestionData,
        reason: reason.trim(),
        status: 'pending',
      });

      if (insertError) throw insertError;

      onSuggestionSubmitted();
      onClose();
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit suggestion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-2">Suggest Edit</h2>
        <p className="text-sm text-gray-600 mb-6">
          Suggest changes to this event. An admin will review your suggestion before applying it.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Show Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Paris, New York, Milan"
              />
            </div>
          </div>

          <div>
            <label htmlFor="season" className="block text-sm font-medium text-gray-700 mb-1">
              Season
            </label>
            <input
              id="season"
              type="text"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Spring 2024, Fall 2023"
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Venue
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Grand Palais, Fashion Week"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              placeholder="e.g., 123 Avenue Street, 75008 Paris, France"
            />
          </div>

          <div>
            <label htmlFor="producers" className="block text-sm font-medium text-gray-700 mb-1">
              Producers
            </label>
            <input
              id="producers"
              type="text"
              value={producers}
              onChange={(e) => setProducers(e.target.value)}
              placeholder="e.g., Fashion Production Co, Designer Studios"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple producers with commas</p>
          </div>

          <div>
            <label htmlFor="designers" className="block text-sm font-medium text-gray-700 mb-1">
              Featured Designers
            </label>
            <input
              id="designers"
              type="text"
              value={designers}
              onChange={(e) => setDesigners(e.target.value)}
              placeholder="e.g., Valentino, Gucci, Alexander McQueen"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple designers with commas</p>
          </div>

          <div>
            <label htmlFor="models" className="block text-sm font-medium text-gray-700 mb-1">
              Featured Models
            </label>
            <input
              id="models"
              type="text"
              value={models}
              onChange={(e) => setModels(e.target.value)}
              placeholder="e.g., Gigi Hadid, Bella Hadid, Karlie Kloss"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple models with commas</p>
          </div>

          <div>
            <label htmlFor="hairMakeup" className="block text-sm font-medium text-gray-700 mb-1">
              Hair & Makeup Artists
            </label>
            <input
              id="hairMakeup"
              type="text"
              value={hairMakeup}
              onChange={(e) => setHairMakeup(e.target.value)}
              placeholder="e.g., James Boehmer, Pat McGrath"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="headerTags" className="block text-sm font-medium text-gray-700 mb-1">
              Header Tags
            </label>
            <input
              id="headerTags"
              type="text"
              value={headerTags}
              onChange={(e) => setHeaderTags(e.target.value)}
              placeholder="e.g., Spring 2024, Couture, Limited Edition"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="footerTags" className="block text-sm font-medium text-gray-700 mb-1">
              Footer Tags
            </label>
            <input
              id="footerTags"
              type="text"
              value={footerTags}
              onChange={(e) => setFooterTags(e.target.value)}
              placeholder="e.g., Award Winning, Sustainable Fashion"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Show Image URL
            </label>
            <input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional image link"
            />
          </div>

          <div className="border-t pt-4">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Suggestion *
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Correcting designer name spelling, adding missing model, updating venue address..."
            />
            <p className="text-xs text-gray-500 mt-1">Please explain what you're changing and why</p>
          </div>

          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 font-medium"
          >
            {loading ? 'Submitting...' : 'Submit Suggestion'}
          </button>
        </form>
      </div>
    </div>
  );
}
