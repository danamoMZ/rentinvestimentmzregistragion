import { BRAND_LOGO, BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function Logo({
  size = 40,
  withText = true,
  className,
}: {
  size?: number;
  withText?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src={BRAND_LOGO}
        alt={BRAND_NAME}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-xl object-cover shadow-sm ring-1 ring-border"
      />
      {withText && (
        <span className="text-base font-extrabold leading-none tracking-tight">
          BLUE<span className="text-primary"> ORIGIN</span>
        </span>
      )}
    </div>
  );
}
