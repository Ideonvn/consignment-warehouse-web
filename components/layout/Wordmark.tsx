import { cn } from "@/lib/utils/cn";

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span aria-hidden className="h-6 w-6 rounded-md border border-accent-edge bg-accent" />
      <span className="text-sm font-semibold tracking-[0.2em] text-text-muted uppercase">
        Consignment Warehouse
      </span>
    </div>
  );
}
