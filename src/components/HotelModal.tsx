'use client';

import { useState, useTransition } from 'react';
import { Hotel, Currency } from '@/lib/types';
import { CURRENCY_OPTIONS, currencySymbol, defaultCurrencyForCountry } from '@/lib/currency';
import { useTrip } from './TripProvider';
import { hotelPlaceholder } from '@/lib/placeExamples';
import { createHotel, updateHotel, deleteHotel } from '@/app/actions';
import { getMapsUrl, timeAgo, formatDateShort, datesInRange } from '@/lib/utils';
import { getEditorName } from '@/lib/editorName';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import LocationAutocomplete from './LocationAutocomplete';
import ConfirmDialog from './ConfirmDialog';
import { X, Trash2, Save, MapPin, WifiOff } from 'lucide-react';

interface HotelModalProps {
  hotel?: Hotel;
  onClose: () => void;
  onSaved: (hotel: Hotel) => void;
  onDeleted?: (deleted: Hotel) => void;
}


function nightsBetween(checkIn: string, checkOut: string): number | null {
  if (!checkIn || !checkOut) return null;
  const ms = new Date(checkOut + 'T00:00:00Z').getTime() - new Date(checkIn + 'T00:00:00Z').getTime();
  const n = Math.round(ms / (1000 * 60 * 60 * 24));
  return n > 0 ? n : null;
}

export default function HotelModal({ hotel, onClose, onSaved, onDeleted }: HotelModalProps) {
  const isEditing = !!hotel;
  const isOnline = useOnlineStatus();

  const { trip, dates: tripDates, cityNames } = useTrip();
  const initialForm = {
    name: hotel?.name ?? '',
    location: hotel?.location ?? '',
    check_in: hotel?.check_in ?? '',
    check_out: hotel?.check_out ?? '',
    price: hotel?.price != null ? String(hotel.price) : '',
    currency: hotel?.currency ?? (defaultCurrencyForCountry(trip.cities[0]?.country_code) as Currency),
    confirmation_number: hotel?.confirmation_number ?? '',
    notes: hotel?.notes ?? '',
    assigned_dates:
      hotel?.assigned_dates && hotel.assigned_dates.length > 0
        ? hotel.assigned_dates
        : datesInRange(hotel?.check_in ?? '', hotel?.check_out ?? ''),
  };
  const [form, setForm] = useState(initialForm);
  // Once true, changing check-in/check-out no longer touches the day picker —
  // otherwise every date tweak would silently clobber a manually customized
  // (e.g. non-contiguous) set of days. Starts true only if this hotel was
  // already saved with an explicit assigned_dates list that differs from
  // what its current range would produce.
  const [datesTouched, setDatesTouched] = useState(!!hotel?.assigned_dates && hotel.assigned_dates.length > 0);
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Prefer the precise geocoded coordinates from the last save, but as soon
  // as the location text is changed (or this is a brand new hotel with no
  // saved location at all yet), fall back to a plain-text maps link built
  // from whatever's currently typed — getMapsUrl doesn't need lat/lng, and
  // waiting for a save+reopen before showing this at all wasn't necessary.
  const mapsUrl =
    hotel && form.location.trim() === (hotel.location ?? '').trim()
      ? getMapsUrl(hotel)
      : getMapsUrl({ lat: null, lng: null, location: form.location });
  const nights = nightsBetween(form.check_in, form.check_out);

  // Only auto-fills the day picker from check-in/check-out while the user
  // hasn't manually toggled an individual day themselves — see datesTouched
  // above.
  const handleCheckInChange = (v: string) => {
    setForm((f) => ({ ...f, check_in: v, assigned_dates: datesTouched ? f.assigned_dates : datesInRange(v, f.check_out) }));
  };
  const handleCheckOutChange = (v: string) => {
    setForm((f) => ({ ...f, check_out: v, assigned_dates: datesTouched ? f.assigned_dates : datesInRange(f.check_in, v) }));
  };
  const toggleAssignedDate = (date: string) => {
    setDatesTouched(true);
    setForm((f) => ({
      ...f,
      assigned_dates: f.assigned_dates.includes(date)
        ? f.assigned_dates.filter((d) => d !== date)
        : [...f.assigned_dates, date].sort(),
    }));
  };
  const resetDatesToRange = () => {
    setDatesTouched(false);
    setForm((f) => ({ ...f, assigned_dates: datesInRange(f.check_in, f.check_out) }));
  };

  const handleClose = () => {
    const hasChanges = (Object.keys(initialForm) as (keyof typeof initialForm)[]).some(
      (key) => form[key] !== initialForm[key]
    );
    if (hasChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  const handleSave = () => {
    if (!form.name.trim() || !isOnline) return;
    setSaveError(null);

    const trimmedLocation = form.location.trim() || null;
    const price = form.price.trim() ? Number(form.price) : null;
    const checkIn = form.check_in || null;
    const checkOut = form.check_out || null;
    const confirmationNumber = form.confirmation_number.trim() || null;
    const notes = form.notes.trim() || null;

    startTransition(async () => {
      try {
        const editedBy = getEditorName();
        if (hotel) {
          const patch: Partial<Hotel> = {
            name: form.name.trim(),
            check_in: checkIn,
            check_out: checkOut,
            price,
            currency: form.currency,
            confirmation_number: confirmationNumber,
            notes,
            assigned_dates: form.assigned_dates,
          };
          // Only send location when it actually changed, so the server
          // doesn't re-geocode on every save (same reasoning as attractions).
          if (trimmedLocation !== hotel.location) patch.location = trimmedLocation;
          await updateHotel(hotel.id, patch, editedBy);
          onSaved({ ...hotel, ...patch, edited_by: editedBy, updated_at: new Date().toISOString() });
        } else {
          const created = await createHotel(
            {
              trip_id: trip.id,
              name: form.name.trim(),
              location: trimmedLocation,
              check_in: checkIn,
              check_out: checkOut,
              price,
              currency: form.currency,
              confirmation_number: confirmationNumber,
              notes,
              assigned_dates: form.assigned_dates,
            },
            editedBy
          );
          onSaved(created);
        }
        onClose();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Couldn't save — try again.");
      }
    });
  };

  const handleDelete = async () => {
    if (!hotel) return;
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const deleted = await deleteHotel(hotel.id);
      onDeleted?.(deleted);
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete — try again.");
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10 bg-white dark:bg-gray-900 rounded-t-2xl">
          <h2 className="font-bold text-gray-900 dark:text-gray-100">{isEditing ? 'Edit Hotel' : 'Add Hotel'}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X size={17} />
          </button>
        </div>

        {!isOnline && (
          <div className="flex items-center gap-2 px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
            <WifiOff size={13} className="shrink-0" />
            You&apos;re offline — read-only until you&apos;re back online.
          </div>
        )}

        {hotel?.edited_by && (
          <div className="px-6 pt-3 text-[11px] text-gray-400 dark:text-gray-500">
            Last edited by <span className="font-medium text-gray-500 dark:text-gray-400">{hotel.edited_by}</span> · {timeAgo(new Date(hotel.updated_at).getTime())}
          </div>
        )}

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {/* Name + actions */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Hotel Name <span className="text-red-400">*</span>
              </label>
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                disabled={!isOnline}
                placeholder={hotelPlaceholder(trip.cities[0]?.name ?? '')}
                className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-300 dark:placeholder-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={isPending || isDeleting || !form.name.trim() || !isOnline}
              title={isEditing ? 'Save changes' : 'Add hotel'}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Save size={16} />
              {isPending ? 'Saving…' : isEditing ? 'Save' : 'Add'}
            </button>
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={isDeleting || isPending || !isOnline}
                title="Delete hotel"
                className="shrink-0 p-2.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-700 dark:hover:text-red-300 rounded-xl transition-colors disabled:opacity-40"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
          {(saveError || deleteError) && (
            <p className="-mt-2 text-xs text-red-500 dark:text-red-400 font-medium">
              {saveError || deleteError}
            </p>
          )}

          {/* Location */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Location
              </label>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <MapPin size={11} />
                  Open in Maps
                </a>
              )}
            </div>
            <LocationAutocomplete
              value={form.location}
              onChange={(v) => setForm((f) => ({ ...f, location: v }))}
              disabled={!isOnline}
              className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-300 dark:placeholder-gray-600"
              placeholder={`Hotel address (${cityNames})`}
            />
          </div>

          {/* Check-in / Check-out */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Check-in
              </label>
              <input
                type="date"
                value={form.check_in}
                onChange={(e) => handleCheckInChange(e.target.value)}
                disabled={!isOnline}
                className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Check-out
              </label>
              <input
                type="date"
                value={form.check_out}
                onChange={(e) => handleCheckOutChange(e.target.value)}
                disabled={!isOnline}
                className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          {/* Days this hotel applies to */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Days this hotel applies to
              </label>
              {datesTouched && (
                <button
                  type="button"
                  onClick={resetDatesToRange}
                  disabled={!isOnline}
                  className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  Reset to check-in/check-out
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {tripDates.map((d) => {
                const selected = form.assigned_dates.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleAssignedDate(d)}
                    disabled={!isOnline}
                    className={[
                      'px-1.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                      selected
                        ? 'border-violet-400 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                    ].join(' ')}
                  >
                    {formatDateShort(d)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
              Defaults to the check-in/check-out range above — tap a day to customize (e.g. non-contiguous stays). More than one hotel can be assigned to the same day.
            </p>
          </div>

          {/* Price box */}
          <div className="rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4">
            <label className="block text-[11px] font-semibold text-violet-500 dark:text-violet-400 uppercase tracking-wide mb-2">
              Price
            </label>
            <div className="flex items-center gap-2">
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                disabled={!isOnline}
                aria-label="Currency"
                className="shrink-0 px-2.5 py-2.5 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900 text-violet-700 dark:text-violet-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
              >
                {(CURRENCY_OPTIONS.includes(form.currency) ? CURRENCY_OPTIONS : [form.currency, ...CURRENCY_OPTIONS]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-violet-400 dark:text-violet-500 font-bold pointer-events-none">
                  {currencySymbol(form.currency).trim()}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  disabled={!isOnline}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2.5 border border-violet-200 dark:border-violet-800 rounded-lg text-lg font-bold bg-white dark:bg-gray-900 text-violet-700 dark:text-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-violet-200 dark:placeholder-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>
            {nights && form.price.trim() && !isNaN(Number(form.price)) && (
              <p className="mt-2 text-xs text-violet-500 dark:text-violet-400">
                ≈ {currencySymbol(form.currency).trim()}{(Number(form.price) / nights).toFixed(2)} / night · {nights} night{nights === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {/* Confirmation number */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Confirmation Number
            </label>
            <input
              type="text"
              value={form.confirmation_number}
              onChange={(e) => setForm((f) => ({ ...f, confirmation_number: e.target.value }))}
              disabled={!isOnline}
              placeholder="Booking confirmation #"
              className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-300 dark:placeholder-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              disabled={!isOnline}
              placeholder="Room type, breakfast included, front desk hours…"
              className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder-gray-300 dark:placeholder-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {showDiscardConfirm && (
        <ConfirmDialog
          message="Discard unsaved changes?"
          onConfirm={onClose}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  );
}
