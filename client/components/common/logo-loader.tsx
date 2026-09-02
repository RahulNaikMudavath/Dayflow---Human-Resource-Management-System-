import { Sunrise, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoLoaderProps {
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

export function LogoLoader({
  label = "Aligning your workspace...",
  className,
  fullScreen = false,
}: LogoLoaderProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-6 text-center select-none animate-in fade-in zoom-in-95 duration-500 overflow-hidden",
        fullScreen
          ? "fixed inset-0 z-50 bg-background/95 backdrop-blur-2xl"
          : "min-h-[380px] w-full py-16",
        className
      )}
    >
      {/* Background Ambient Aura */}
      <div className="absolute size-80 rounded-full bg-gradient-to-tr from-amber-500/15 via-primary/20 to-amber-300/10 blur-3xl animate-loader-pulse-glow pointer-events-none" />

      {/* Main Animated Loader Center Container */}
      <div className="relative flex items-center justify-center animate-loader-float">
        {/* Deep Pulsing Halo Ring */}
        <span className="absolute size-28 rounded-full bg-gradient-to-r from-amber-500/20 via-primary/25 to-amber-400/20 animate-loader-pulse-glow blur-md" />

        {/* Outer Counter-Clockwise Dotted Orbit Ring */}
        <div className="absolute size-24 rounded-full border border-dashed border-amber-500/35 animate-loader-spin-ccw" />

        {/* Inner Clockwise Glowing Gradient Ring */}
        <div className="absolute size-20 rounded-full border-2 border-transparent border-t-amber-400 border-r-primary border-b-amber-500/40 animate-loader-spin-cw shadow-sm" />

        {/* Orbiting Satellite Sparkles */}
        <div className="absolute size-24 animate-loader-spin-cw">
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex size-4 items-center justify-center rounded-full bg-amber-400/20 p-0.5 backdrop-blur-xs">
            <Sparkles className="size-3 text-amber-400 fill-amber-400 animate-pulse" />
          </span>
        </div>

        <div className="absolute size-24 animate-loader-spin-ccw">
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex size-3.5 items-center justify-center rounded-full bg-primary/20 p-0.5 backdrop-blur-xs">
            <span className="size-1.5 rounded-full bg-primary animate-ping" />
          </span>
        </div>

        {/* Central Glassmorphic Badge with Glowing Sunrise Icon */}
        <div className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-amber-600 to-amber-400 text-primary-foreground shadow-2xl shadow-amber-500/30 ring-4 ring-amber-400/25 backdrop-blur-md">
          <Sunrise className="size-7 text-amber-100 animate-pulse" />
        </div>
      </div>

      {/* Brand & Animated Loading Status */}
      <div className="relative z-10 flex flex-col items-center gap-2.5">
        {/* Brand Header */}
        <h2 className="font-display text-2xl font-bold tracking-tight bg-gradient-to-r from-amber-500 via-primary to-amber-400 bg-clip-text text-transparent">
          Dayflow
        </h2>

        {/* Status Indicator Pill */}
        <div className="flex items-center gap-2.5 rounded-full border border-border/60 bg-muted/40 px-3.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm shadow-xs">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
          </span>
          <span className="tracking-wide text-foreground/90 font-sans">{label}</span>
        </div>

        {/* Liquid Shimmer Progress Bar */}
        <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-muted/80 p-0.5 border border-border/40 shadow-inner">
          <div className="relative h-full w-full overflow-hidden rounded-full bg-muted/50">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary via-amber-400 to-amber-500 animate-loader-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

