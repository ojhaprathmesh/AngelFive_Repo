import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function DSFMPage() {
  return (
    <div className="flex justify-center p-2 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-5xl">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">DSFM</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Analytics and models module</p>
        </div>
        <div className="rounded-lg border bg-white dark:bg-gray-900 p-6">
          <Alert>
            <AlertDescription className="text-sm">
              This section is a placeholder. Configure data pipelines, analytics, and dashboards here.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button variant="outline" disabled>
              Configure module
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
