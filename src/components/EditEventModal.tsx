import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { supabase, Event } from '../lib/supabase';
import { getSeasonFromDate } from '../lib/season';
import { useAuth } from '../contexts/AuthContext';
import { normalizeTagName, syncTagIdentitiesFromEventFields } from '../lib/tagIdentity';
import { coalesceTagList } from '../lib/eventTagArray';
import { effectiveHeaderTags } from '../lib/eventHeaderTags';
import { normalizeExternalUrl } from '../lib/externalUrl';
import { resolveVenueFormattedAddress } from '../lib/resolveVenueAddress';
import { isCanonicalCityLabel } from '../lib/cityPlaces';
import {
  SHOW_TYPE_OPTIONS,
  normalizeShowType,
  starringColumn,
  type ShowType,
} from '../lib/showType';
import {
  SPECIAL_GUESTS_SLUG,
  getSpecialGuests,
  isSpecialGuestsSlug,
  withSpecialGuests,
  withSpecialGuestsMeta,
} from '../lib/specialGuests';
import { useT } from '../contexts/CopyContext';
import { deleteStoredEventImage, ensureEventImageStored } from '../lib/eventImageUpload';
import TagInput from './TagInput';
import IconPicker from './IconPicker';
import CustomPerformerCategoryInput from './CustomPerformerCategoryInput';
import ModalShell from './ModalShell';
import EventImageField from './EventImageField';
import { Button, Input, Label } from './ui';
import { cn } from '../lib/utils';

interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventUpdated: () => void | Promise<void>;
  event: Event;
}

export default function EditEventModal({ isOpen, onClose, onEventUpdated, event }: EditEventModalProps) {
  const t = useT();
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date.slice(0, 10));
  const [showType, setShowType] = useState<ShowType>(() => normalizeShowType(event.show_type));
  const [city, setCity] = useState<string[]>(event.city ? [event.city] : []);
  const [venue, setVenue] = useState<string[]>(event.location ? [event.location] : []);
  const [imageUrl, setImageUrl] = useState(event.image_url || '');
  const [countdownLink, setCountdownLink] = useState(event.countdown_link || '');
  const [producers, setProducers] = useState<string[]>(() => coalesceTagList(event.producers));
  const [designers, setDesigners] = useState<string[]>(() => coalesceTagList(event.featured_designers));
  const [artists, setArtists] = useState<string[]>(() => coalesceTagList(event.featured_artists));
  const [specialGuests, setSpecialGuests] = useState<string[]>(() => getSpecialGuests(event.custom_tags));
  const [models, setModels] = useState<string[]>(() => coalesceTagList(event.models));
  const [hairMakeup, setHairMakeup] = useState<string[]>(() => coalesceTagList(event.hair_makeup));
  const [headerTags, setHeaderTags] = useState<string[]>(() => effectiveHeaderTags(event));
  const [footerTags, setFooterTags] = useState<string[]>(() => coalesceTagList(event.footer_tags));
  const [customTags, setCustomTags] = useState<Record<string, string[]>>(event.custom_tags || {});
  const [inlineCustomTypes, setInlineCustomTypes] = useState<{ slug: string; label: string; icon: string }[]>(() => {
    const ct = event.custom_tags || {};
    const meta = event.custom_tag_meta || {};
    return Object.keys(ct)
      .filter((slug) => !isSpecialGuestsSlug(slug))
      .map((slug) => ({
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
      setDate(event.date.slice(0, 10));
      setShowType(normalizeShowType(event.show_type));
      setCity(event.city ? [event.city] : []);
      setVenue(event.location ? [event.location] : []);
      setImageUrl(event.image_url || '');
      setCountdownLink(event.countdown_link || '');
      setProducers(coalesceTagList(event.producers));
      setDesigners(coalesceTagList(event.featured_designers));
      setArtists(coalesceTagList(event.featured_artists));
      setSpecialGuests(getSpecialGuests(event.custom_tags));
      setModels(coalesceTagList(event.models));
      setHairMakeup(coalesceTagList(event.hair_makeup));
      setHeaderTags(effectiveHeaderTags(event));
      setFooterTags(coalesceTagList(event.footer_tags));
      setCustomTags(event.custom_tags || {});
      const ct = event.custom_tags || {};
      const meta = event.custom_tag_meta || {};
      setInlineCustomTypes(
        Object.keys(ct)
          .filter((slug) => !isSpecialGuestsSlug(slug))
          .map((slug) => ({
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
    if (clean(city).length === 0) {
      setError('Please add a city');
      return;
    }
    if (!isCanonicalCityLabel(clean(city)[0] || '')) {
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
      /** Keep exact spellings; trim, dedupe by normalized form only. Identities are for search & credits, not to rewrite event text. */
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

      const resolvedProducers = resolveTags(clean(producers));
      const resolvedDesigners = showType === 'fashion' ? resolveTags(clean(designers)) : [];
      const resolvedArtists = showType === 'music' ? resolveTags(clean(artists)) : [];
      const isMusic = showType === 'music';
      const resolvedModels = isMusic ? [] : resolveTags(clean(models));
      const resolvedHairMakeup = isMusic ? [] : resolveTags(clean(hairMakeup));
      const resolvedHeaderTags = resolveTags(clean(headerTags));
      const resolvedFooterTags = resolveTags(clean(footerTags));

      const resolvedCustomTags: Record<string, string[]> = {};
      for (const [slug, tags] of Object.entries(customTags)) {
        if (isSpecialGuestsSlug(slug)) continue;
        const cleaned = (Array.isArray(tags) ? tags : []).map((s) => String(s).trim()).filter(Boolean);
        if (cleaned.length > 0) {
          resolvedCustomTags[slug] = resolveTags(cleaned);
        }
      }
      const resolvedSpecialGuests = showType === 'music' ? resolveTags(clean(specialGuests)) : [];
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
      const nextImageUrl = storedImage.url;

      const { data: updatedRows, error: updateError } = await supabase
        .from('events')
        .update({
          name,
          date,
          city: cityVal,
          season: date ? getSeasonFromDate(date) : null,
          show_type: showType,
          location: venueVal,
          formatted_address: formattedAddress,
          image_url: nextImageUrl,
          countdown_link: normalizedCountdownLink,
          producers: resolvedProducers.length ? resolvedProducers : null,
          featured_designers: resolvedDesigners.length ? resolvedDesigners : null,
          featured_artists: resolvedArtists.length ? resolvedArtists : null,
          models: resolvedModels.length ? resolvedModels : null,
          hair_makeup: resolvedHairMakeup.length ? resolvedHairMakeup : null,
          header_tags: resolvedHeaderTags.length ? resolvedHeaderTags : null,
          footer_tags: resolvedFooterTags.length ? resolvedFooterTags : null,
          custom_tags: Object.keys(customTagsWithGuests).length ? customTagsWithGuests : null,
          custom_tag_meta: customMeta,
        })
        .eq('id', event.id)
        .select('id');

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          'Your changes were not saved. You may not have permission to edit this show, or it may have been removed.'
        );
      }

      const prevImageUrl = event.image_url || null;
      if (prevImageUrl && prevImageUrl !== nextImageUrl) {
        void deleteStoredEventImage(prevImageUrl);
      }

      // Don't block the save UI on identity sync — festival lineups can be dozens of sequential DB calls.
      void syncTagIdentitiesFromEventFields(
        {
          producers: resolvedProducers,
          featured_designers: resolvedDesigners,
          featured_artists: resolvedArtists,
          models: resolvedModels,
          hair_makeup: resolvedHairMakeup,
          header_tags: resolvedHeaderTags,
          footer_tags: resolvedFooterTags,
          location: venueVal,
          custom_tags: Object.keys(customTagsWithGuests).length ? customTagsWithGuests : null,
        },
        user.id
      ).catch((err) => console.warn('Background tag identity sync failed:', err));

      await onEventUpdated();
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
    <ModalShell onClose={onClose} title={t("form.editTitle")} zClass="z-[100]">
        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          <div>
            <Label htmlFor="name" required>
              {t("form.showName")}
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
            <legend className="mb-1 block text-sm font-medium text-foreground">{t("form.showType")}</legend>
            <div className="flex gap-2" role="radiogroup" aria-label={t("form.showType")}>
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
                label={t("form.city")}
                value={city}
                onChange={setCity}
                useCitySuggestions
                maxTags={1}
                required
                placeholder={t("form.city.placeholder")}
              />
            </div>
          </div>

          <TagInput
            id="location"
            label={t("form.venue")}
            value={venue}
            onChange={setVenue}
            useVenueSuggestions
            maxTags={1}
            placeholder={showType === 'music' ? t('form.venue.placeholder.music') : t('form.venue.placeholder.fashion')}
          />

          <TagInput
            id="starring"
            label={t('event.starring')}
            value={showType === 'music' ? artists : designers}
            onChange={showType === 'music' ? setArtists : setDesigners}
            tagColumn={starringColumn(showType)}
            placeholder={showType === 'music' ? t('form.starring.placeholder.music') : t('form.starring.placeholder.fashion')}
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
            placeholder={showType === 'music' ? t('form.producedBy.placeholder.music') : t('form.producedBy.placeholder.fashion')}
            expandable
          />

          {showType === 'fashion' && (
            <>
              <TagInput
                id="models"
                label={t('form.featuredModels')}
                value={models}
                onChange={setModels}
                tagColumn="models"
                placeholder={t('form.featuredModels.placeholder')}
                expandable
              />

              <TagInput
                id="hairMakeup"
                label={t('form.hairMakeup')}
                value={hairMakeup}
                onChange={setHairMakeup}
                tagColumn="hair_makeup"
                placeholder={t('form.hairMakeup.placeholder')}
                expandable
              />
            </>
          )}

          <TagInput
            id="headerTags"
            label={t('form.genre')}
            value={headerTags}
            onChange={setHeaderTags}
            tagColumn="header_tags"
            placeholder={showType === 'music' ? t('form.genre.placeholder.music') : t('form.genre.placeholder.fashion')}
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
            placeholder={showType === 'music' ? t('form.collection.placeholder.music') : t('form.collection.placeholder.fashion')}
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
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
    </ModalShell>,
    document.body
  );
}
