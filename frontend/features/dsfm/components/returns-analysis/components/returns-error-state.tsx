import { Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReturnsErrorStateProps {
  error: string | null;
  selectedSymbol: string;
}

export function ReturnsErrorState({
  error,
  selectedSymbol,
}: ReturnsErrorStateProps) {
  if (error) {
    if (error.includes("SmartAPI credentials not configured")) {
      return (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <Info className="h-5 w-5" />
              SmartAPI Credentials Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-left">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              To fetch real-time stock data, you need to configure your Angel
              One SmartAPI credentials.
            </p>
            <div className="space-y-1 rounded bg-white p-3 font-mono text-xs dark:bg-gray-800">
              <p className="mb-2 font-semibold">
                Add these to{" "}
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">
                  backend/.env
                </code>
                :
              </p>
              <p>SMARTAPI_API_KEY=your_api_key</p>
              <p>SMARTAPI_CLIENT_CODE=your_client_code</p>
              <p>SMARTAPI_PASSWORD=your_password</p>
              <p>SMARTAPI_TOTP_SECRET=your_totp_secret</p>
            </div>
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              After adding credentials, restart the backend server.
            </p>
            <p className="text-xs text-gray-500">
              Get your credentials from:{" "}
              <a
                href="https://smartapi.angelone.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Angel One SmartAPI
              </a>
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        <p className="font-semibold text-red-600 dark:text-red-400">
          Error loading data
        </p>
        <p className="text-sm whitespace-pre-line text-gray-600 dark:text-gray-400">
          {error}
        </p>
        {(error.includes("port 5000") || error.includes("Network error")) && (
          <p className="mt-2 text-xs text-gray-500">
            Make sure the backend server is running on port 5000
          </p>
        )}
      </div>
    );
  }

  if (selectedSymbol) {
    return (
      <p className="text-gray-500">No data available for {selectedSymbol}</p>
    );
  }

  return (
    <p className="text-gray-500">Select a stock to view returns analysis</p>
  );
}
