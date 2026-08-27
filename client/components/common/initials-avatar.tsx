import { avatarTone, initials } from "@/lib/dayflow";
import { cn } from "@/lib/utils";

export function InitialsAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null | undefined;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("flex shrink-0 items-center justify-center rounded-full object-cover", className ?? "size-10")}
      />
    );
  }

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
