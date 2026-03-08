import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

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
                <Card>
                    <CardContent>
                        <Alert>
                            <AlertTitle>Portfolio Empty</AlertTitle>
                            <AlertDescription className="text-sm">
                                Your portfolio is empty. Add holdings to monitor gains, losses,
                                and allocation.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                    <CardFooter>
                        <Button variant="outline" disabled>
                            Add holdings
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
