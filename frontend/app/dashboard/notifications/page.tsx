"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertCircle,
  Archive,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Info,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Shield,
  Trash2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notification, useNotifications } from "@/features/notifications";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    refresh,
    loading,
  } = useNotifications();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "unread" | "watchlist" | "market" | "dsfm"
  >("all");

  const filteredNotifications = notifications.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "unread" && n.status === "unread") ||
      filter === n.category;
    return matchesSearch && matchesFilter;
  });

  const getIcon = (category: string, priority: string) => {
    switch (category) {
      case "watchlist":
        return <Bell className="h-5 w-5" />;
      case "market":
        return <TrendingUp className="h-5 w-5" />;
      case "dsfm":
        return <Activity className="h-5 w-5" />;
      case "security":
        return <Shield className="h-5 w-5" />;
      default:
        if (priority === "critical" || priority === "high")
          return <AlertCircle className="h-5 w-5" />;
        return <Info className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: string, status: string) => {
    if (status === "read") return "text-gray-400 bg-gray-100 dark:bg-gray-800";
    switch (priority) {
      case "critical":
        return "text-red-600 bg-red-100 dark:bg-red-900/30";
      case "high":
        return "text-orange-600 bg-orange-100 dark:bg-orange-900/30";
      case "medium":
        return "text-blue-600 bg-blue-100 dark:bg-blue-900/30";
      default:
        return "text-green-600 bg-green-100 dark:bg-green-900/30";
    }
  };

  return (
    <div className="animate-in fade-in container mx-auto max-w-5xl space-y-6 p-4 duration-500 lg:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your alerts, market updates, and system messages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => markAllAsRead()}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-none bg-white shadow-sm dark:bg-gray-950">
        <CardHeader className="border-b border-gray-100 pb-3 dark:border-gray-800">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <Tabs
              value={filter}
              onValueChange={(v: any) => setFilter(v)}
              className="w-full md:w-auto"
            >
              <TabsList className="bg-gray-100 dark:bg-gray-900">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
                <TabsTrigger value="market">Market</TabsTrigger>
                <TabsTrigger value="dsfm">DSFM</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="group relative w-full md:w-64">
              <Search className="group-focus-within:text-primary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors" />
              <Input
                placeholder="Search notifications..."
                className="focus:ring-primary border-gray-200 bg-gray-50 pl-9 dark:border-gray-800 dark:bg-gray-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-muted-foreground p-12 text-center">
              <RefreshCcw className="mx-auto mb-4 h-8 w-8 animate-spin opacity-20" />
              <p>Fetching your notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-900">
                <Bell className="h-10 w-10 text-gray-300 dark:text-gray-700" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                No notifications found
              </h3>
              <p className="text-muted-foreground mx-auto mt-2 max-w-sm">
                {searchQuery || filter !== "all"
                  ? "We couldn't find any notifications matching your current filters."
                  : "You're all caught up! When you get new alerts, they'll show up here."}
              </p>
              {(searchQuery || filter !== "all") && (
                <Button
                  variant="link"
                  onClick={() => {
                    setSearchQuery("");
                    setFilter("all");
                  }}
                  className="mt-4"
                >
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "group flex flex-col p-6 transition-all hover:bg-gray-50/50 sm:flex-row dark:hover:bg-gray-900/30",
                    n.status === "unread" &&
                      "relative bg-blue-50/20 dark:bg-blue-900/5",
                  )}
                >
                  {n.status === "unread" && (
                    <div className="bg-primary absolute top-0 bottom-0 left-0 w-1" />
                  )}
                  <div
                    className={cn(
                      "mb-4 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-105 sm:mr-6 sm:mb-0",
                      getPriorityColor(n.priority, n.status),
                    )}
                  >
                    {getIcon(n.category, n.priority)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2">
                        <h3
                          className={cn(
                            "text-base font-bold",
                            n.status === "unread"
                              ? "text-gray-900 dark:text-white"
                              : "text-gray-600 dark:text-gray-400",
                          )}
                        >
                          {n.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className="h-5 border-gray-200 py-0 text-[10px] capitalize dark:border-gray-800"
                        >
                          {n.category}
                        </Badge>
                      </div>
                      <span className="flex items-center text-xs font-medium text-gray-400">
                        <Clock className="mr-1 h-3 w-3" />
                        {(() => {
                          try {
                            const ts = n.createdAt;
                            if (!ts) return "";
                            const ms = ts.seconds
                              ? ts.seconds * 1000
                              : ts._seconds
                                ? ts._seconds * 1000
                                : typeof ts === "string"
                                  ? new Date(ts).getTime()
                                  : typeof ts === "number"
                                    ? ts
                                    : null;
                            if (!ms || isNaN(ms)) return "";
                            return formatDistanceToNow(new Date(ms), {
                              addSuffix: true,
                            });
                          } catch {
                            return "";
                          }
                        })()}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mb-4 text-sm leading-relaxed",
                        n.status === "unread"
                          ? "text-gray-700 dark:text-gray-300"
                          : "text-gray-500",
                      )}
                    >
                      {n.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      {n.action && (
                        <Button
                          asChild
                          size="sm"
                          variant={
                            n.status === "unread" ? "default" : "outline"
                          }
                          className="h-8 text-xs font-semibold"
                          onClick={() =>
                            n.status === "unread" && markAsRead(n.id)
                          }
                        >
                          <Link href={n.action.url}>
                            {n.action.type === "navigate"
                              ? "Take Action"
                              : "Open Link"}
                            <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}

                      <div className="flex items-center gap-1">
                        {n.status === "unread" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-gray-500 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20"
                            onClick={() => markAsRead(n.id)}
                          >
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                            Mark as read
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          onClick={() => archiveNotification(n.id)}
                        >
                          <Archive className="mr-1.5 h-3.5 w-3.5" />
                          Archive
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 sm:mt-0 sm:ml-4 sm:flex-col">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => archiveNotification(n.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete forever
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center pb-8 text-xs text-gray-400">
        <p>
          Notifications are automatically archived after 30 days of inactivity.
        </p>
      </div>
    </div>
  );
}
