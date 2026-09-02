import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("dayflow-theme") as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  localStorage.setItem("dayflow-theme", theme);
}

interface ThemeToggleProps {
  className?: string;
  variant?: "default" | "sidebar" | "ghost" | "outline";
  showLabel?: boolean;
}

export function ThemeToggle({ className, variant = "ghost", showLabel = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant={variant === "sidebar" ? "ghost" : variant}
      size={showLabel ? "default" : "icon"}
      onClick={toggleTheme}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label="Toggle theme"
      className={cn(
        "relative flex items-center justify-center rounded-xl cursor-pointer transition-all duration-300",
        showLabel ? "px-3 py-2 gap-2 h-9" : "size-9",
        variant === "sidebar"
          ? "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          : "text-foreground/70 hover:bg-accent hover:text-foreground",
        className
      )}
    >
      {isDark ? (
        <Moon className="size-4 text-amber-400 animate-in fade-in zoom-in-75 duration-200" />
      ) : (
        <Sun className="size-4 text-amber-500 animate-in fade-in zoom-in-75 duration-200" />
      )}
      {showLabel && (
        <span className="text-xs font-semibold capitalize">
          {isDark ? "Dark Mode" : "Light Mode"}
        </span>
      )}
    </Button>
  );
}
