import ZeroHackDashboard from '@/components/ZeroHackDashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function HomePage() {
  return (
    <ErrorBoundary>
      <div className="flex flex-col">
        <ZeroHackDashboard />
      </div>
    </ErrorBoundary>
  );
}
