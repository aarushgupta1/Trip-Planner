'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import ShareTripModal from './ShareTripModal';
import type { TripPerson } from '@/app/trips/actions';

export default function ShareTripButton(props: {
  tripId: string;
  isOwner: boolean;
  currentUserId: string;
  people: TripPerson[];
  initialToken: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={props.isOwner ? 'Share this trip' : 'People on this trip'}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
      >
        <UserPlus size={15} />
        <span className="hidden sm:inline">{props.isOwner ? 'Share' : 'People'}</span>
      </button>
      {open && <ShareTripModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
