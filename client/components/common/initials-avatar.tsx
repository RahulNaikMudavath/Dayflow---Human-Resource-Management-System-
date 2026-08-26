import { avatarTone, initials } from "@/lib/dayflow";
import { cn } from "@/lib/utils";

export function InitialsAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        avatarTone(name),
        className ?? "size-10 text-sm",
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}
