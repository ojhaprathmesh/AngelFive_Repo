import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function PortfolioPage() {
    return (
        <div className="flex justify-center p-2 min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="w-full max-w-5xl">
                <div className="mb-4">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        Portfolio
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Track your holdings and performance
                    </p>
                </div>
                <div className="rounded-lg border bg-white dark:bg-gray-900 p-6">
                    <Alert>
                        <AlertDescription className="text-sm">
                            Your portfolio is empty. Add holdings to monitor gains, losses,
                            and allocation.
                        </AlertDescription>
                    </Alert>
                    <div className="mt-4">
                        <Button variant="outline" disabled>
                            Add holdings
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
