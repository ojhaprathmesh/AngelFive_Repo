"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
    const router = useRouter();
    return (
        <button
            onClick={() => router.back()}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Go back"
        >
            <ArrowLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>
    );
}
