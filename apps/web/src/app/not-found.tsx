import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        <FileQuestion className="w-8 h-8" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Page Not Found</h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
          The requested page or asset resource does not exist or has been moved.
        </p>
      </div>
      <Link href="/">
        <Button className="gap-2">
          <Home className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Button>
      </Link>
    </div>
  );
}

