import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-base-blue animate-spin mx-auto mb-4" />
        <p className="text-base-gray-400">Loading...</p>
      </div>
    </div>
  );
}
