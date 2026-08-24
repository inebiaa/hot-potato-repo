import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getSeasonFromDate } from '../lib/season';
import { normalizeExternalUrl } from '../lib/externalUrl';
import { resolveVenueFormattedAddress } from '../lib/resolveVenueAddress';
import { isCanonicalCityLabel } from '../lib/cityPlaces';
import { useAuth } from '../contexts/AuthContext';
import { normalizeTagName, syncTagIdentitiesFromEventFields } from '../lib/tagIdentity';
import {
  SHOW_TYPE_OPTIONS,
  starringColumn,
  type ShowType,
} from '../lib/showType';
import {
  SPECIAL_GUESTS_SLUG,
  withSpecialGuests,
  withSpecialGuestsMeta,
} from '../lib/specialGuests';
import { useT } from '../hooks/useCopy';
import { ensureEventImageStored } from '../lib/eventImageUpload';
import TagInput from './TagInput';
import IconPicker from './IconPicker';
import CustomPerformerCategoryInput from './CustomPerformerCategoryInput';
import ModalShell from './ModalShell';
import EventImageField from './EventImageField';
import { Button, Input, Label } from './ui';
import { cn } from '../lib/utils';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventAdded: () => void;
}

export default function AddEventModal({ isOpen, onClose, onEventAdded }: AddEventModalProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [showType, setShowType] = useState<ShowType>('fashion');
  const [city, setCity] = useState<string[]>([]);
  const [venue, setVenue] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [countdownLink, setCountdownLink] = useState('');
  const [producers, setProducers] = useState<string[]>([]);
  const [designers, setDesigners] = useState<string[]>([]);
  const [artists, setArtists] = useState<string[]>([]);
  const [specialGuests, setSpecialGuests] = useState<string[]>([]);
  const [hairMakeup, setHairMakeup] = useState<string[]>([]);
  const [headerTags, setHeaderTags] = useState<string[]>([]);
  const [footerTags, setFooterTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<Record<string, string[]>>({});
  const [inlineCustomTypes, setInlineCustomTypes] = useState<{ slug: string; label: string; icon: string }[]>([]);
  const [newCustomTypeLabel, setNewCustomTypeLabel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const t = useT();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to create events');
      return;
    }
    const arr = (v: unknown) => (Array.isArray(v) ? v : []).map((s) => String(s).trim()).filter(Boolean);
    if (arr(city).length === 0) {
      setError('Please add a city');
      return;
    }
    if (!isCanonicalCityLabel(arr(city)[0] || '')) {
      setError('Please select a city from the suggestions (e.g. Denver, CO)');
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
      const resolvedDesigners = showType === 'fashion' ? cleanP(designers) : [];
      const resolvedArtists = showType === 'music' ? cleanP(artists) : [];
      const resolvedHairMakeup = showType === 'fashion' ? cleanP(hairMakeup) : [];
      const resolvedHeaderTags = cleanP(headerTags);
      const resolvedFooterTags = cleanP(footerTags);
      const resolvedCustomTags: Record<string, string[]> = {};
      for (const [slug, tags] of Object.entries(customTags)) {
        const cleaned = (Array.isArray(tags) ? tags : []).map((s) => String(s).trim()).filter(Boolean);
        if (cleaned.length > 0) {
          resolvedCustomTags[slug] = resolveTags(cleaned);
        }
      }
      const resolvedSpecialGuests = showType === 'music' ? cleanP(specialGuests) : [];
      const customTagsWithGuests = withSpecialGuests(resolvedCustomTags, resolvedSpecialGuests);
      const customMeta = withSpecialGuestsMeta(
        Object.fromEntries(inlineCustomTypes.map((t) => [t.slug, { icon: t.icon || 'Tag' }])),
        resolvedSpecialGuests.length > 0
      );
      const venueVal = venue[0] || null;
      const cityVal = (city && city[0]) || '';
      const formattedAddress = await resolveVenueFormattedAddress(venueVal, cityVal);

      const storedImage = await ensureEventImageStored(imageUrl);
      if ('error' in storedImage) {
        setError(storedImage.error);
        setLoading(false);
        return;
      }
      if (storedImage.url) setImageUrl(storedImage.url);

      const { error: insertError } = await supabase.from('events').insert({
        name,
        date,
        city: cityVal,
        season: date ? getSeasonFromDate(date) : null,
        show_type: showType,
        location: venueVal,
        formatted_address: formattedAddress,
        image_url: storedImage.url,
        countdown_link: normalizedCountdownLink,
        producers: resolvedProducers.length ? resolvedProducers : null,
        featured_designers: resolvedDesigners.length ? resolvedDesigners : null,
        featured_artists: resolvedArtists.length ? resolvedArtists : null,
        hair_makeup: resolvedHairMakeup.length ? resolvedHairMakeup : null,
        header_tags: resolvedHeaderTags.length ? resolvedHeaderTags : null,
        footer_tags: resolvedFooterTags.length ? resolvedFooterTags : null,
        custom_tags: Object.keys(customTagsWithGuests).length ? customTagsWithGuests : null,
        custom_tag_meta: customMeta,
        created_by: user.id,
      });

      if (insertError) throw insertError;

      // Don't block the create UI on identity sync (large festival lineups).
      void syncTagIdentitiesFromEventFields(
        {
          producers: resolvedProducers,
          featured_designers: resolvedDesigners,
          featured_artists: resolvedArtists,
          hair_makeup: resolvedHairMakeup,
          header_tags: resolvedHeaderTags,
          footer_tags: resolvedFooterTags,
          location: venueVal,
          custom_tags: Object.keys(customTagsWithGuests).length ? customTagsWithGuests : null,
        },
        user.id
      ).catch((err) => console.warn('Background tag identity sync failed:', err));

      onEventAdded();
      onClose();
      setName('');
      setDate('');
      setShowType('fashion');
      setCity([]);
      setVenue([]);
      setImageUrl('');
      setCountdownLink('');
      setProducers([]);
      setDesigners([]);
      setArtists([]);
      setSpecialGuests([]);
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
    <ModalShell onClose={onClose} title={t('form.createTitle')}>
        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          <div>
            <Label htmlFor="name" required>
              {t('form.showName')}
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-foreground">{t('form.showType')}</legend>
            <div className="flex gap-2" role="radiogroup" aria-label={t('form.showType')}>
              {SHOW_TYPE_OPTIONS.map((opt) => {
                const selected = showType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setShowType(opt.value)}
                    className={cn(
                      'min-h-10 flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      selected
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-input bg-card text-foreground hover:bg-muted',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="date" required>
                {t('form.date')}
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div>
              <TagInput
                id="city"
                label={t('form.city')}
                value={city}
                onChange={setCity}
                useCitySuggestions
                maxTags={1}
                required
                placeholder={t('form.city.placeholder')}
              />
            </div>
          </div>

          <TagInput
            id="location"
            label={t('form.venue')}
            value={venue}
            onChange={setVenue}
            useVenueSuggestions
            maxTags={1}
            placeholder={
              showType === 'music' ? t('form.venue.placeholder.music') : t('form.venue.placeholder.fashion')
            }
          />

          <TagInput
            id="starring"
            label={t('event.starring')}
            value={showType === 'music' ? artists : designers}
            onChange={showType === 'music' ? setArtists : setDesigners}
            tagColumn={starringColumn(showType)}
            placeholder={
              showType === 'music'
                ? t('form.starring.placeholder.music')
                : t('form.starring.placeholder.fashion')
            }
          />

          {showType === 'music' && (
            <TagInput
              id="specialGuests"
              label={t(specialGuests.length === 1 ? 'event.specialGuest' : 'event.specialGuests')}
              value={specialGuests}
              onChange={setSpecialGuests}
              tagColumn="featured_artists"
              placeholder={t('form.specialGuests.placeholder')}
              expandable
            />
          )}

          <TagInput
            id="producers"
            label={t('form.producedBy')}
            value={producers}
            onChange={setProducers}
            tagColumn="producers"
            placeholder={
              showType === 'music'
                ? t('form.producedBy.placeholder.music')
                : t('form.producedBy.placeholder.fashion')
            }
            expandable
          />

          {showType === 'fashion' && (
            <TagInput
              id="hairMakeup"
              label={t('form.hairMakeup')}
              value={hairMakeup}
              onChange={setHairMakeup}
              tagColumn="hair_makeup"
              placeholder={t('form.hairMakeup.placeholder')}
              expandable
            />
          )}

          <TagInput
            id="headerTags"
            label={t('form.genre')}
            value={headerTags}
            onChange={setHeaderTags}
            tagColumn="header_tags"
            placeholder={
              showType === 'music' ? t('form.genre.placeholder.music') : t('form.genre.placeholder.fashion')
            }
            expandable
          />

          {inlineCustomTypes.map(({ slug, label, icon }) => (
            <TagInput
              key={slug}
              id={`custom-inline-${slug}`}
              label={label}
              value={customTags[slug] || []}
              onChange={(v) => setCustomTags((prev) => ({ ...prev, [slug]: v }))}
              customTagSlug={slug}
              placeholder={`e.g., ${label}...`}
              expandable
              headerAction={
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
                  className="shrink-0 rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                  title="Remove this category"
                  aria-label={`Remove ${label} category`}
                >
                  <Trash2 size={16} />
                </button>
              }
              expandedExtras={
                <IconPicker
                  label="Icon"
                  value={icon}
                  onChange={(v) =>
                    setInlineCustomTypes((prev) => prev.map((t) => (t.slug === slug ? { ...t, icon: v } : t)))
                  }
                />
              }
            />
          ))}

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="newCustomType">Add custom category</Label>
              <CustomPerformerCategoryInput
                id="newCustomType"
                value={newCustomTypeLabel}
                onChange={setNewCustomTypeLabel}
                excludedSlugs={[SPECIAL_GUESTS_SLUG, ...inlineCustomTypes.map((t) => t.slug)]}
                onPickExisting={(slug, label) => {
                  if (slug === SPECIAL_GUESTS_SLUG || inlineCustomTypes.some((t) => t.slug === slug)) return;
                  setInlineCustomTypes((prev) => [...prev, { slug, label, icon: 'Tag' }]);
                }}
              />
              <p className="mt-0.5 text-xs text-muted-foreground">
                e.g. Presented By — choose existing or type a new name, then Add
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const label = newCustomTypeLabel.trim();
                if (!label) return;
                const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                if (!slug || slug === SPECIAL_GUESTS_SLUG) return;
                if (inlineCustomTypes.some((t) => t.slug === slug)) return;
                setInlineCustomTypes((prev) => [...prev, { slug, label, icon: 'Tag' }]);
                setNewCustomTypeLabel('');
              }}
            >
              Add
            </Button>
          </div>

          <TagInput
            id="footerTags"
            label={t('form.collection')}
            value={footerTags}
            onChange={setFooterTags}
            tagColumn="footer_tags"
            placeholder={
              showType === 'music'
                ? t('form.collection.placeholder.music')
                : t('form.collection.placeholder.fashion')
            }
            expandable
          />

          <EventImageField
            imageUrl={imageUrl}
            onImageUrlChange={setImageUrl}
            userId={user?.id}
          />

          <div>
            <Label htmlFor="countdownLink">Official ticket link</Label>
            <Input
              id="countdownLink"
              type="url"
              value={countdownLink}
              onChange={(e) => setCountdownLink(e.target.value)}
              placeholder="https://… public ticket or registration page"
            />
            <p className="mt-0.5 text-xs text-muted-foreground">Opens when the countdown pill is tapped on upcoming shows.</p>
          </div>

          {error && (
            <div className="text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating...' : 'Create Show'}
          </Button>
        </form>
    </ModalShell>
  );
}