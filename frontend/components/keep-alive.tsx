// frontend/components/KeepAlive.tsx
"use client";
import { useKeepAlive } from "@/lib/hooks/useKeepAlive";

export function KeepAlive() {
    useKeepAlive();
    return null;
}