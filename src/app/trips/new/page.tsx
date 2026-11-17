import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import TripForm from '@/components/TripForm';

export const metadata = { title: 'New trip · Trip Planner' };

export default function NewTripPage() {
  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4">
          <ChevronLeft size={15} />
          My trips
        </Link>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Plan a new trip</h1>
          <p className="mt-1 mb-6 text-sm text-gray-500 dark:text-gray-400">
            Tell us where you’re headed and when.
          </p>
          <TripForm mode="create" />
        </div>
      </div>
    </main>
  );
}
