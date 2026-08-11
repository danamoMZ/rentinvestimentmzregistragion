import logoAsset from "@/assets/ri-logo.jpg.asset.json";
const logo = logoAsset.url;
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
        src={logo}
        alt="RENT INVESTIMENT"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="rounded-xl object-cover shadow-sm ring-1 ring-border"
      />
      {withText && (
        <span className="text-base font-extrabold leading-none tracking-tight">
          RENT<span className="text-primary"> INVESTIMENT</span>
        </span>
      )}
    </div>
  );
}
