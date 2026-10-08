"use client";

import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  Bookmark,
  KeyRound,
  LogOut,
  type LucideIcon,
  MonitorSmartphone,
  Settings,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { NotificationDropdown } from "@/features/notifications/components/notification-dropdown";
import { NotificationErrorBoundary } from "@/features/notifications/error-boundary";
import { marketDataService } from "@/lib/market-data";

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  lastUpdated?: string;
}

interface DashboardNavbarProps {
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
}

export function DashboardNavbar({ user }: DashboardNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [marketData, setMarketData] = useState<{
    sensex: {
      data: MarketData | null;
      isLoading: boolean;
      error: string | null;
      lastUpdated: Date | null;
    };
    nifty: {
      data: MarketData | null;
      isLoading: boolean;
      error: string | null;
      lastUpdated: Date | null;
    };
  }>({
    sensex: { data: null, isLoading: true, error: null, lastUpdated: null },
    nifty: { data: null, isLoading: true, error: null, lastUpdated: null },
  });

  const marketService = marketDataService;

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const results = await marketService.getAllMarketDataWithStatus();

        setMarketData({
          sensex: results.sensex,
          nifty: results.nifty,
        });

        // Show error toast if there are any errors
        if (results.sensex.error || results.nifty.error) {
          const errors = [results.sensex.error, results.nifty.error].filter(
            Boolean,
          );
          if (errors.length > 0) {
            console.warn("Market data errors:", errors);
          }
        }
      } catch (error) {
        console.error("Failed to fetch market data:", error);

        // Set error state for both indices
        setMarketData((prev) => ({
          sensex: {
            ...prev.sensex,
            error: "Failed to load data",
            isLoading: false,
          },
          nifty: {
            ...prev.nifty,
            error: "Failed to load data",
            isLoading: false,
          },
        }));
      }
    };

    void fetchMarketData();

    // Start auto-refresh for both indices
    marketService.startAutoRefresh("BSE:SENSEX", 30000, (data, error) => {
      setMarketData((prev) => ({
        ...prev,
        sensex: {
          data,
          isLoading: false,
          error: error || null,
          lastUpdated: new Date(),
        },
      }));
    });

    marketService.startAutoRefresh("NSE:NIFTY", 30000, (data, error) => {
      setMarketData((prev) => ({
        ...prev,
        nifty: {
          data,
          isLoading: false,
          error: error || null,
          lastUpdated: new Date(),
        },
      }));
    });

    return () => {
      marketService.stopAllAutoRefresh();
    };
  }, [marketService]);

  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(); // auth-context handles redirect + message
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/login");
    }
  };

  type NavLink = {
    href: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
  };

  const navigationLinks: NavLink[] = [
    {
      href: "/dashboard/market",
      label: "Market",
      icon: BarChart3,
      active: pathname === "/dashboard/market",
    },
    {
      href: "/dashboard/watchlist",
      label: "Watchlist",
      icon: Bookmark,
      active: pathname === "/dashboard/watchlist",
    },
    {
      href: "/dashboard/dsfm",
      label: "DSFM",
      icon: Activity,
      active: pathname === "/dashboard/dsfm",
    },
  ];

  const MarketIndicator = ({
    marketInfo,
    isCompact = false,
  }: {
    marketInfo: {
      data: MarketData | null;
      isLoading: boolean;
      error: string | null;
      lastUpdated: Date | null;
    };
    isCompact?: boolean;
  }) => {
    if (marketInfo.isLoading) {
      return (
        <div
          className={`flex flex-col space-y-1 ${
            isCompact ? "items-center" : ""
          }`}
        >
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-12" />
          {!isCompact && <Skeleton className="h-2 w-20" />}
        </div>
      );
    }

    if (marketInfo.error) {
      return (
        <div
          className={`flex flex-col ${
            isCompact ? "items-center text-center" : ""
          }`}
        >
          <div className="flex items-center space-x-1">
            <AlertCircle className="h-3 w-3 text-red-500" />
            <span
              className={`text-red-500 ${isCompact ? "text-xs" : "text-xs"}`}
            >
              Error
            </span>
          </div>
          {!isCompact && (
            <div className="text-xs text-red-400">{marketInfo.error}</div>
          )}
        </div>
      );
    }

    if (!marketInfo.data) return null;

    const data = marketInfo.data;
    const isPositive = data.change >= 0;
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;
    const isDataFresh =
      marketInfo.lastUpdated &&
      marketService.isDataFresh(marketInfo.lastUpdated);

    return (
      <div
        className={`flex flex-col ${
          isCompact ? "items-center text-center" : ""
        }`}
      >
        <div className="flex items-center space-x-1">
          <span
            className={`font-medium text-gray-900 dark:text-gray-100 ${
              isCompact ? "text-xs" : "text-xs"
            }`}
          >
            {data.symbol}
          </span>
          <span
            className={`font-semibold text-gray-900 dark:text-gray-100 ${
              isCompact ? "text-xs" : "text-xs"
            }`}
          >
            {data.price.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          {!isCompact && (
            <div
              className={`h-2 w-2 rounded-full ${
                isDataFresh ? "bg-green-500" : "bg-yellow-500"
              }`}
              title={isDataFresh ? "Data is fresh" : "Data may be stale"}
            />
          )}
        </div>
        <div className="flex items-center space-x-1">
          <TrendIcon
            className={`h-3 w-3 ${
              isPositive ? "text-green-600" : "text-red-600"
            }`}
          />
          <span
            className={`font-medium ${
              isPositive ? "text-green-600" : "text-red-600"
            } ${isCompact ? "text-xs" : "text-xs"}`}
          >
            {isPositive ? "+" : ""}
            {data.change.toFixed(2)} ({isPositive ? "+" : ""}
            {data.changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>
    );
  };

  return (
    <nav className="safe-top sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/60 dark:border-gray-800 dark:bg-gray-950/95 dark:supports-backdrop-filter:bg-gray-950/60">
      <div className="flex h-16 items-center justify-between p-4">
        {/* Left Section */}
        <div className="flex items-center space-x-4 lg:space-x-8">
          {/* Logo */}
          <Link
            href="/dashboard/market"
            className="touch-target flex items-center space-x-2.5"
          >
            <Image
              src="/logo.png"
              alt="AngelFive"
              width={32}
              height={32}
              className="rounded-lg object-contain"
              priority
            />
            <span className="text-responsive-lg hidden font-bold tracking-tight text-gray-900 sm:block dark:text-gray-100">
              AngelFive
            </span>
          </Link>

          {/* Market Indicators */}
          <div className="hidden items-center space-x-6 lg:flex">
            {(marketData.sensex.error || marketData.nifty.error) && (
              <Alert className="w-auto p-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Market data issues detected
                </AlertDescription>
              </Alert>
            )}
            <MarketIndicator marketInfo={marketData.sensex} />
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
            <MarketIndicator marketInfo={marketData.nifty} />
          </div>
        </div>

        {/* Left Section */}
        <div className="flex items-center space-x-1">
          {/* Navigation Links */}
          <div className="hidden items-center space-x-1 md:flex">
            {navigationLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={link.active ? "default" : "ghost"}
                    size={link.active ? "default" : "icon-sm"}
                    title={link.label}
                    aria-label={link.label}
                    className={`touch-target transition-all duration-200 ease-out ${
                      link.active
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-medium"
                        : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {link.active && (
                      <span className="ml-2 text-sm font-medium">
                        {link.label}
                      </span>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Profile and Notifications */}
          <div className="flex items-center space-x-2 lg:space-x-4">
            {/* Mobile Market Indicators */}
            <div className="flex items-center space-x-2 lg:hidden">
              {!(marketData.sensex.error && marketData.nifty.error) && (
                <>
                  <MarketIndicator
                    marketInfo={marketData.sensex}
                    isCompact={true}
                  />
                  <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
                  <MarketIndicator
                    marketInfo={marketData.nifty}
                    isCompact={true}
                  />
                </>
              )}
            </div>
          </div>

          {/* Notifications */}
          <NotificationErrorBoundary>
            <NotificationDropdown />
          </NotificationErrorBoundary>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="touch-target relative h-8 w-8 rounded-full"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={user?.avatar}
                    alt={user?.name || "User Avatar"}
                  />
                  <AvatarFallback>
                    {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm leading-none font-medium">
                    {user?.name || "John Doe"}
                  </p>
                  <p className="text-muted-foreground text-xs leading-none">
                    {user?.email || "john.doe@example.com"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                  <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem className="cursor-pointer">
                      <MonitorSmartphone className="mr-2 h-4 w-4" />
                      <span>Appearance</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <Bell className="mr-2 h-4 w-4" />
                      <span>Notifications</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <KeyRound className="mr-2 h-4 w-4" />
                      <span>API Keys</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="cursor-pointer"
                  variant="destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                  <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
