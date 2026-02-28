"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { marketDataService } from "@/lib/market-data";
import {
  TrendingUp,
  TrendingDown,
  User,
  Settings,
  LogOut,
  Bell,
  AlertCircle,
  GalleryVerticalEnd,
  Bookmark,
  Activity,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

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

    fetchMarketData();

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
  }, []);

  const handleLogout = async () => {
    try {
      // Clear session storage
      sessionStorage.clear();
      localStorage.clear();

      // Clear any cached data
      if (typeof window !== "undefined") {
        // Clear any application-specific storage
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith("angelfive_")) {
            localStorage.removeItem(key);
          }
        });
      }

      // Redirect to login with success message
      router.push("/login?message=Successfully logged out");
    } catch (error) {
      console.error("Logout error:", error);
      // Force redirect even if cleanup fails
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
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/60 dark:border-gray-800 dark:bg-gray-950/95 dark:supports-backdrop-filter:bg-gray-950/60 safe-top mb-4">
      <div className="flex h-16 items-center justify-between p-4">
        {/* Left Section */}
        <div className="flex items-center space-x-4 lg:space-x-8">
          {/* Logo */}
          <Link
            href="/dashboard/market"
            className="flex items-center space-x-2 touch-target"
          >
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <GalleryVerticalEnd className="size-4" />
            </div>
            <span className="hidden sm:block text-responsive-lg font-bold text-gray-900 dark:text-gray-100">
              AngelFive
            </span>
          </Link>

          {/* Market Indicators */}
          <div className="hidden lg:flex items-center space-x-6">
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
          <div className="hidden md:flex items-center space-x-1">
            {navigationLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={link.active ? "default" : "ghost"}
                    size={link.active ? "default" : "icon-sm"}
                    title={link.label}
                    aria-label={link.label}
                    className={`transition-all duration-200 ease-out touch-target ${
                      link.active
                        ? "px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
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
            <div className="flex lg:hidden items-center space-x-2">
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
          <Button variant="ghost" size="sm" className="relative touch-target">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 text-[9.75px]">
              3
            </Badge>
          </Button>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-full touch-target"
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
                  <p className="text-sm font-medium leading-none">
                    {user?.name || "John Doe"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || "john.doe@example.com"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-red-600 focus:text-red-600"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
