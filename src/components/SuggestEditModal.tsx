import { useState, useEffect } from 'react';
import { supabase, Event } from '../lib/supabase';
import { getSeasonFromDate } from '../lib/season';
import { useAuth } from '../contexts/AuthContext';
import TagInput from './TagInput';
import type { CustomPerformerTag } from './SettingsModal';

interface SuggestEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuggestionSubmitted: () => void;
  event: Event;
  customPerformerTags?: CustomPerformerTag[];
}

export default function SuggestEditModal({ isOpen, onClose, onSuggestionSubmitted, event, customPerformerTags = [] }: SuggestEditModalProps) {
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description);
  const [date, setDate] = useState(event.date.slice(0, 10));
  const [city, setCity] = useState<string[]>(event.city ? [event.city] : []);
  const [location, setLocation] = useState(event.location || '');
  const [address, setAddress] = useState(event.address || '');
  const [imageUrl, setImageUrl] = useState(event.image_url || '');
  const [producers, setProducers] = useState<string[]>(event.producers || []);
  const [designers, setDesigners] = useState<string[]>(event.featured_designers || []);
  const [models, setModels] = useState<string[]>(event.models || []);
  const [hairMakeup, setHairMakeup] = useState<string[]>(event.hair_makeup || []);
  const [headerTags, setHeaderTags] = useState<string[]>(event.header_tags || event.genre || []);
  const [footerTags, setFooterTags] = useState<string[]>(event.footer_tags || []);
  const [customTags, setCustomTags] = useState<Record<string, string[]>>(event.custom_tags || {});
  const [inlineCustomTypes, setInlineCustomTypes] = useState<{ slug: string; label: string }[]>(() => {
    const ct = event.custom_tags || {};
    return Object.keys(ct)
      .filter((slug) => !customPerformerTags.some((t) => t.slug === slug))
      .map((slug) => ({ slug, label: slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }));
  });
  const [newCustomTypeLabel, setNewCustomTypeLabel] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setProducers(event.producers || []);
      setDesigners(event.featured_designers || []);
      setModels(event.models || []);
      setHairMakeup(event.hair_makeup || []);
      setHeaderTags(event.header_tags || event.genre || []);
      setFooterTags(event.footer_tags || []);
      setCustomTags(event.custom_tags || {});
      const ct = event.custom_tags || {};
      setInlineCustomTypes(
        Object.keys(ct)
          .filter((slug) => !customPerformerTags.some((t) => t.slug === slug))
          .map((slug) => ({ slug, label: slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }))
      );
    }
  }, [isOpen, event, customPerformerTags]);

  if (!isOpen) return null;

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
        city: (city && city[0]) || '',
        season: date ? getSeasonFromDate(date) : null,
        location: location || null,
        address: address || null,
        image_url: imageUrl || null,
        producers: producers.length ? producers : null,
        featured_designers: designers.length ? designers : null,
        models: models.length ? models : null,
        hair_makeup: hairMakeup.length ? hairMakeup : null,
        header_tags: headerTags.length ? headerTags : null,
        footer_tags: footerTags.length ? footerTags : null,
        custom_tags: Object.keys(customTags).length ? customTags : null,
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
      <div className="relative max-w-2xl w-full my-8">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 w-8 h-8 flex items-center justify-center text-white/90 hover:text-white rounded-full hover:bg-white/10 transition-colors text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
        <div className="bg-white rounded-lg shadow-xl w-full p-6 max-h-[90vh] overflow-y-auto">
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
              <TagInput
                id="city"
                label="City"
                value={city}
                onChange={setCity}
                useCitySuggestions
                maxTags={1}
                placeholder="e.g., Paris, New York, Milan"
                hint="Type and press Enter; suggestions from existing events"
              />
            </div>
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

          <TagInput
            id="producers"
            label="Producers"
            value={producers}
            onChange={setProducers}
            tagColumn="producers"
            placeholder="e.g., Fashion Production Co, Designer Studios"
            hint="Type and press Enter to add; suggestions appear as you type"
          />

          <TagInput
            id="designers"
            label="Featured Designers"
            value={designers}
            onChange={setDesigners}
            tagColumn="featured_designers"
            placeholder="e.g., Valentino, Gucci, Alexander McQueen"
            hint="Type and press Enter to add; suggestions appear as you type"
          />

          <TagInput
            id="models"
            label="Featured Models"
            value={models}
            onChange={setModels}
            tagColumn="models"
            placeholder="e.g., Gigi Hadid, Bella Hadid, Karlie Kloss"
            hint="Type and press Enter to add; suggestions appear as you type"
          />

          <TagInput
            id="hairMakeup"
            label="Hair & Makeup Artists"
            value={hairMakeup}
            onChange={setHairMakeup}
            tagColumn="hair_makeup"
            placeholder="e.g., James Boehmer, Pat McGrath"
            hint="Type and press Enter to add; suggestions appear as you type"
          />

          <TagInput
            id="headerTags"
            label="Genre"
            value={headerTags}
            onChange={setHeaderTags}
            tagColumn="header_tags"
            placeholder="e.g., Spring 2024, Couture, Limited Edition"
          />

          <TagInput
            id="footerTags"
            label="Footer Tags"
            value={footerTags}
            onChange={setFooterTags}
            tagColumn="footer_tags"
            placeholder="e.g., Award Winning, Sustainable Fashion"
          />

          {inlineCustomTypes.map(({ slug, label }) => (
            <TagInput
              key={slug}
              id={`custom-inline-${slug}`}
              label={label}
              value={customTags[slug] || []}
              onChange={(v) => setCustomTags((prev) => ({ ...prev, [slug]: v }))}
              tagColumn="header_tags"
              customTagSlug={slug}
              placeholder={`e.g., ${label}...`}
              hint={`Optional ${label.toLowerCase()}`}
            />
          ))}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="newCustomType" className="block text-sm font-medium text-gray-700 mb-1">
                Add custom performer category
              </label>
              <input
                id="newCustomType"
                type="text"
                value={newCustomTypeLabel}
                onChange={(e) => setNewCustomTypeLabel(e.target.value)}
                placeholder="e.g., Hosted By, Music By"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-xs text-gray-500 mt-0.5">Add a custom tag type (e.g. Hosted By, Music By)</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const label = newCustomTypeLabel.trim();
                if (!label) return;
                const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                if (!slug) return;
                if (inlineCustomTypes.some((t) => t.slug === slug)) return;
                setInlineCustomTypes((prev) => [...prev, { slug, label }]);
                setNewCustomTypeLabel('');
              }}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium shrink-0"
            >
              Add
            </button>
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
    </div>
  );
}
