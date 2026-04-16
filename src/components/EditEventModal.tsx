import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { supabase, Event } from '../lib/supabase';
import { getSeasonFromDate } from '../lib/season';
import { useAuth } from '../contexts/AuthContext';
import { ensureIdentity, normalizeTagName, type TagType } from '../lib/tagIdentity';
import { normalizeExternalUrl } from '../lib/externalUrl';
import TagInput from './TagInput';
import IconPicker from './IconPicker';
import ModalShell from './ModalShell';

interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventUpdated: () => void;
  event: Event;
}

export default function EditEventModal({ isOpen, onClose, onEventUpdated, event }: EditEventModalProps) {
  const [name, setName] = useState(event.name);
  const [description, setDescription] = useState(event.description || '');
  const [date, setDate] = useState(event.date.slice(0, 10));
  const [city, setCity] = useState<string[]>(event.city ? [event.city] : []);
  const [venue, setVenue] = useState<string[]>(event.location ? [event.location] : []);
  const [address, setAddress] = useState(event.address || '');
  const [imageUrl, setImageUrl] = useState(event.image_url || '');
  const [countdownLink, setCountdownLink] = useState(event.countdown_link || '');
  const toArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [];
  const [producers, setProducers] = useState<string[]>(() => toArray(event.producers));
  const [designers, setDesigners] = useState<string[]>(() => toArray(event.featured_designers));
  const [models, setModels] = useState<string[]>(event.models || []);
  const [hairMakeup, setHairMakeup] = useState<string[]>(event.hair_makeup || []);
  const [headerTags, setHeaderTags] = useState<string[]>(event.header_tags || event.genre || []);
  const [footerTags, setFooterTags] = useState<string[]>(event.footer_tags || []);
  const [customTags, setCustomTags] = useState<Record<string, string[]>>(event.custom_tags || {});
  const [inlineCustomTypes, setInlineCustomTypes] = useState<{ slug: string; label: string; icon: string }[]>(() => {
    const ct = event.custom_tags || {};
    const meta = event.custom_tag_meta || {};
    return Object.keys(ct).map((slug) => ({
      slug,
      label: slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      icon: meta[slug]?.icon || 'Tag',
    }));
  });
  const [newCustomTypeLabel, setNewCustomTypeLabel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setName(event.name);
      setDescription(event.description || '');
      setDate(event.date.slice(0, 10));
      setCity(event.city ? [event.city] : []);
      setVenue(event.location ? [event.location] : []);
      setAddress(event.address || '');
      setImageUrl(event.image_url || '');
      setCountdownLink(event.countdown_link || '');
      setProducers(toArray(event.producers));
      setDesigners(toArray(event.featured_designers));
      setModels(event.models || []);
      setHairMakeup(event.hair_makeup || []);
      setHeaderTags(event.header_tags || event.genre || []);
      setFooterTags(event.footer_tags || []);
      setCustomTags(event.custom_tags || {});
      const ct = event.custom_tags || {};
      const meta = event.custom_tag_meta || {};
      setInlineCustomTypes(
        Object.keys(ct).map((slug) => ({
          slug,
          label: slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          icon: meta[slug]?.icon || 'Tag',
        }))
      );
    }
  }, [isOpen, event]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to edit events');
      return;
    }
    const clean = (arr: string[] | null | undefined) =>
      (Array.isArray(arr) ? arr : []).map((s) => String(s).trim()).filter(Boolean);
    const cleanProducers = clean(producers);
    const cleanDesigners = clean(designers);
    if (cleanProducers.length === 0 || cleanDesigners.length === 0) {
      setError('Please add at least one producer and one designer');
      return;
    }
    if (clean(city).length === 0) {
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
      const resolveTags = async (tagType: TagType, newTags: string[]): Promise<string[]> => {
        const resolved: string[] = [];
        for (const tag of newTags) {
          const identity = await ensureIdentity(tagType, tag, user.id);
          const canon = identity?.canonical_name ?? tag.trim();
          resolved.push(canon);
        }
        const seenNorm = new Set<string>();
        const deduped: string[] = [];
        for (const t of resolved) {
          const n = normalizeTagName(t);
          if (seenNorm.has(n)) continue;
          seenNorm.add(n);
          deduped.push(t);
        }
        return deduped;
      };

      const [resolvedProducers, resolvedDesigners, resolvedModels, resolvedHairMakeup, resolvedHeaderTags, resolvedFooterTags] = await Promise.all([
        resolveTags('producer', cleanProducers),
        resolveTags('designer', cleanDesigners),
        resolveTags('model', clean(models)),
        resolveTags('hair_makeup', clean(hairMakeup)),
        resolveTags('header_tags', clean(headerTags)),
        resolveTags('footer_tags', clean(footerTags)),
      ]);

      const resolvedCustomTags: Record<string, string[]> = {};
      for (const [slug, tags] of Object.entries(customTags)) {
        const cleaned = (Array.isArray(tags) ? tags : []).map((s) => String(s).trim()).filter(Boolean);
        if (cleaned.length > 0) {
          resolvedCustomTags[slug] = await resolveTags(`custom:${slug}` as TagType, cleaned);
        }
      }

      const { error: updateError } = await supabase
        .from('events')
        .update({
          name,
          description: description || null,
          date,
          city: (city && city[0]) || '',
          season: date ? getSeasonFromDate(date) : null,
          location: venue[0] || null,
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
        })
        .eq('id', event.id);

      if (updateError) throw updateError;

      onEventUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to update event:', err);
      const msg =
        err instanceof Error
          ? err.message
          : err && typeof err === 'object' && 'message' in err
            ? String((err as Record<string, unknown>).message ?? '')
            : 'Failed to update event';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <ModalShell onClose={onClose} title="Edit Fashion Show" zClass="z-[100]">
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
              <div className="w-full shrink-0 sm:w-28">
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <IconPicker label="" value={icon} onChange={(v) => setInlineCustomTypes((prev) => prev.map((t) => (t.slug === slug ? { ...t, icon: v } : t)))} />
              </div>
              <div className="flex-1 min-w-0">
                <TagInput
                  id={`custom-inline-${slug}`}
                  label=""
                  value={customTags[slug] || []}
                  onChange={(v) => setCustomTags((prev) => ({ ...prev, [slug]: v }))}
                  tagColumn="header_tags"
                  customTagSlug={slug}
                  placeholder={`e.g., ${label}...`}
                  hint={`Optional ${label.toLowerCase()}`}
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
            hint="Use a shared tag (e.g. NYFW Fall 2024) to group related shows"
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
            <p className="text-xs text-gray-500 mt-0.5">Opens when the countdown pill is tapped on upcoming shows. http or https only.</p>
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
            {loading ? 'Updating...' : 'Update Show'}
          </button>
        </form>
    </ModalShell>,
    document.body
  );
}
