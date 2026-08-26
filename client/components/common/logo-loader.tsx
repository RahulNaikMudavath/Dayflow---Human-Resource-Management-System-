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
        "flex flex-col items-center justify-center gap-5 text-center select-none animate-in fade-in zoom-in-95 duration-300",
        fullScreen
          ? "fixed inset-0 z-50 bg-background/95 backdrop-blur-xl"
          : "min-h-[360px] w-full py-14",
        className
      )}
    >
      {/* Animated Dayflow Logo Structure */}
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulsing background halo */}
        <span className="absolute size-24 rounded-3xl bg-amber-500/15 animate-ping opacity-75" />

        {/* Outer spinning gradient ring */}
        <div className="absolute size-20 rounded-3xl border-2 border-transparent border-t-amber-400 border-r-primary border-b-amber-500/40 animate-spin [animation-duration:2s]" />

        {/* Orbiting Sparkle container */}
        <div className="absolute size-24 animate-spin [animation-duration:3s]">
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 flex size-3 items-center justify-center">
            <Sparkles className="size-3 text-amber-400 fill-amber-400 animate-pulse" />
          </span>
        </div>

        {/* Main Logo Container */}
        <div className="relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary via-amber-600 to-amber-400 text-primary-foreground shadow-2xl shadow-amber-500/30 ring-4 ring-amber-400/20 transition-transform">
          <Sunrise className="size-7 text-amber-100 animate-pulse" />
        </div>
      </div>

      {/* Brand & Loading Label */}
      <div className="flex flex-col items-center gap-2 mt-1">
        <h2 className="font-display text-2xl font-bold tracking-tight bg-gradient-to-r from-amber-500 via-primary to-amber-400 bg-clip-text text-transparent animate-pulse">
          Dayflow
        </h2>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="size-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="size-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
          <span className="tracking-wide text-foreground/80">{label}</span>
        </div>

        {/* Subtle sliding loading bar */}
        <div className="mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-muted/60">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-primary via-amber-400 to-amber-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
