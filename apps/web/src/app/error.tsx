'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
      <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
        <AlertCircle className="w-8 h-8" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Something went wrong</h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
          An error occurred while loading this view. You can try refreshing the page or retry.
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline" className="gap-2">
        <RotateCcw className="w-4 h-4" />
        <span>Try Again</span>
      </Button>
    </div>
  );
}

