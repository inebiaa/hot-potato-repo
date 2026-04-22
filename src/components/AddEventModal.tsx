import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSeasonFromDate } from '../lib/season';
import { normalizeExternalUrl } from '../lib/externalUrl';
import { useAuth } from '../contexts/AuthContext';
import { normalizeTagName, syncTagIdentitiesFromEventFields } from '../lib/tagIdentity';
import TagInput from './TagInput';
import IconPicker from './IconPicker';
import CustomPerformerCategoryInput from './CustomPerformerCategoryInput';
import ModalShell from './ModalShell';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventAdded: () => void;
}

export default function AddEventModal({ isOpen, onClose, onEventAdded }: AddEventModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [city, setCity] = useState<string[]>([]);
  const [venue, setVenue] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [countdownLink, setCountdownLink] = useState('');
  const [producers, setProducers] = useState<string[]>([]);
  const [designers, setDesigners] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [hairMakeup, setHairMakeup] = useState<string[]>([]);
  const [headerTags, setHeaderTags] = useState<string[]>([]);
  const [footerTags, setFooterTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<Record<string, string[]>>({});
  const [inlineCustomTypes, setInlineCustomTypes] = useState<{ slug: string; label: string; icon: string }[]>([]);
  const [newCustomTypeLabel, setNewCustomTypeLabel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to create events');
      return;
    }
    const arr = (v: unknown) => (Array.isArray(v) ? v : []).map((s) => String(s).trim()).filter(Boolean);
    if (arr(producers).length === 0 || arr(designers).length === 0) {
      setError('Please add at least one producer and one designer');
      return;
    }
    if (arr(city).length === 0) {
      setError('Please add a city');
      return;
    }

    setError('');
    setLoading(true);

    let normalizedCountdownLink: string | null = null;
    try {
      normalizedCountdownLink = normalizeExternalUrl(countdownLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid official ticket link');
      setLoading(false);
      return;
    }

    try {
      const resolveTags = (newTags: string[]): string[] => {
        const seenNorm = new Set<string>();
        const out: string[] = [];
        for (const tag of newTags) {
          const t = String(tag).trim();
          if (!t) continue;
          const n = normalizeTagName(t);
          if (seenNorm.has(n)) continue;
          seenNorm.add(n);
          out.push(t);
        }
        return out;
      };
      const cleanP = (a: string[]) => resolveTags((Array.isArray(a) ? a : []).map((s) => String(s).trim()).filter(Boolean));
      const resolvedProducers = cleanP(producers);
      const resolvedDesigners = cleanP(designers);
      const resolvedModels = cleanP(models);
      const resolvedHairMakeup = cleanP(hairMakeup);
      const resolvedHeaderTags = cleanP(headerTags);
      const resolvedFooterTags = cleanP(footerTags);
      const resolvedCustomTags: Record<string, string[]> = {};
      for (const [slug, tags] of Object.entries(customTags)) {
        const cleaned = (Array.isArray(tags) ? tags : []).map((s) => String(s).trim()).filter(Boolean);
        if (cleaned.length > 0) {
          resolvedCustomTags[slug] = resolveTags(cleaned);
        }
      }
      const venueVal = venue[0] || null;
      if (resolvedProducers.length === 0 || resolvedDesigners.length === 0) {
        setError('Please add at least one producer and one designer');
        setLoading(false);
        return;
      }

      const { error: insertError } = await supabase.from('events').insert({
        name,
        description: description || null,
        date,
        city: (city && city[0]) || '',
        season: date ? getSeasonFromDate(date) : null,
        location: venueVal,
        address: address || null,
        image_url: imageUrl || null,
        countdown_link: normalizedCountdownLink,
        producers: resolvedProducers.length ? resolvedProducers : null,
        featured_designers: resolvedDesigners.length ? resolvedDesigners : null,
        models: resolvedModels.length ? resolvedModels : null,
        hair_makeup: resolvedHairMakeup.length ? resolvedHairMakeup : null,
        header_tags: resolvedHeaderTags.length ? resolvedHeaderTags : null,
        footer_tags: resolvedFooterTags.length ? resolvedFooterTags : null,
        custom_tags: Object.keys(resolvedCustomTags).length ? resolvedCustomTags : null,
        custom_tag_meta: inlineCustomTypes.length ? Object.fromEntries(inlineCustomTypes.map((t) => [t.slug, { icon: t.icon || 'Tag' }])) : null,
        created_by: user.id,
      });

      if (insertError) throw insertError;

      await syncTagIdentitiesFromEventFields(
        {
          producers: resolvedProducers,
          featured_designers: resolvedDesigners,
          models: resolvedModels,
          hair_makeup: resolvedHairMakeup,
          header_tags: resolvedHeaderTags,
          footer_tags: resolvedFooterTags,
          location: venueVal,
          custom_tags: Object.keys(resolvedCustomTags).length ? resolvedCustomTags : null,
        },
        user.id
      );

      onEventAdded();
      onClose();
      setName('');
      setDescription('');
      setDate('');
      setCity([]);
      setVenue([]);
      setAddress('');
      setImageUrl('');
      setCountdownLink('');
      setProducers([]);
      setDesigners([]);
      setModels([]);
      setHairMakeup([]);
      setHeaderTags([]);
      setFooterTags([]);
      setCustomTags({});
      setInlineCustomTypes([]);
      setNewCustomTypeLabel('');
    } catch (err) {
      console.error('Failed to create event', err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to create event');
      } else if (err && typeof err === 'object' && 'message' in err) {
        const msg = (err as Record<string, unknown>).message;
        setError(typeof msg === 'string' ? msg : 'Failed to create event');
      } else {
        setError(String(err) || 'Failed to create event');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Create New Fashion Show">
        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Show Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="Short description of the show"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
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
                required
                placeholder="e.g., Paris, New York, Milan"
                hint="Type and press Enter; suggestions from existing events"
              />
            </div>
          </div>

          <TagInput
            id="location"
            label="Venue"
            value={venue}
            onChange={setVenue}
            useVenueSuggestions
            maxTags={1}
            placeholder="e.g., Grand Palais, Fashion Week"
            hint="Type and press Enter; suggestions from venues already used on events"
          />

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Street address
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
              placeholder="Shown on the card when set; included in Event structured data"
            />
          </div>

          <TagInput
            id="producers"
            label="Producers"
            value={producers}
            onChange={setProducers}
            tagColumn="producers"
            placeholder="e.g., Fashion Production Co, Designer Studios"
            required
            hint="Type and press Enter to add; suggestions appear as you type"
          />

          <TagInput
            id="designers"
            label="Featured Designers"
            value={designers}
            onChange={setDesigners}
            tagColumn="featured_designers"
            placeholder="e.g., Valentino, Gucci, Alexander McQueen"
            required
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
            hint="Tags for the header section"
          />

          {inlineCustomTypes.map(({ slug, label, icon }) => (
            <div key={slug} className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3">
              <div className="shrink-0 w-full sm:w-28">
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <IconPicker label="" value={icon} onChange={(v) => setInlineCustomTypes((prev) => prev.map((t) => (t.slug === slug ? { ...t, icon: v } : t)))} />
              </div>
              <div className="flex-1 min-w-0">
                <TagInput
                  id={`custom-inline-${slug}`}
                  label=""
                  value={customTags[slug] || []}
                  onChange={(v) => setCustomTags((prev) => ({ ...prev, [slug]: v }))}
                  customTagSlug={slug}
                  placeholder={`e.g., ${label}...`}
                  hint="Type and press Enter to add; suggestions appear as you type"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setInlineCustomTypes((prev) => prev.filter((t) => t.slug !== slug));
                  setCustomTags((prev) => {
                    const next = { ...prev };
                    delete next[slug];
                    return next;
                  });
                }}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded shrink-0 mt-6"
                title="Remove this category"
                aria-label={`Remove ${label} category`}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="newCustomType" className="block text-sm font-medium text-gray-700 mb-1">
                Add custom performer category
              </label>
              <CustomPerformerCategoryInput
                id="newCustomType"
                value={newCustomTypeLabel}
                onChange={setNewCustomTypeLabel}
                excludedSlugs={inlineCustomTypes.map((t) => t.slug)}
                onPickExisting={(slug, label) => {
                  if (inlineCustomTypes.some((t) => t.slug === slug)) return;
                  setInlineCustomTypes((prev) => [...prev, { slug, label, icon: 'Tag' }]);
                }}
              />
              <p className="text-xs text-gray-500 mt-0.5">
                Choose an existing category as you type, or enter a new name and click Add
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const label = newCustomTypeLabel.trim();
                if (!label) return;
                const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                if (!slug) return;
                if (inlineCustomTypes.some((t) => t.slug === slug)) return;
                setInlineCustomTypes((prev) => [...prev, { slug, label, icon: 'Tag' }]);
                setNewCustomTypeLabel('');
              }}
              className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium shrink-0"
            >
              Add
            </button>
          </div>

          <TagInput
            id="footerTags"
            label="Collection"
            value={footerTags}
            onChange={setFooterTags}
            tagColumn="footer_tags"
            placeholder="e.g., Award Winning, Sustainable Fashion, NYFW Fall 2024"
            hint="Additional descriptors or event groupings (e.g., NYFW Fall 2024)"
          />

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
              placeholder="https://…"
            />
          </div>

          <div>
            <label htmlFor="countdownLink" className="block text-sm font-medium text-gray-700 mb-1">
              Official ticket link
            </label>
            <input
              id="countdownLink"
              type="url"
              value={countdownLink}
              onChange={(e) => setCountdownLink(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://… public ticket or registration page"
            />
            <p className="text-xs text-gray-500 mt-0.5">Opens when the countdown pill is tapped on upcoming shows.</p>
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
            {loading ? 'Creating...' : 'Create Show'}
          </button>
        </form>
    </ModalShell>
  );
}