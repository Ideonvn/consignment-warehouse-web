import { formatMoney } from "@/lib/format/money";
import { cn } from "@/lib/utils/cn";

type MoneyProps = {
  /** Integer minor units (cents). Never a float. */
  minor: number;
  currency?: string;
  className?: string;
};

/** The only place money is turned into text. */
export function Money({ minor, currency = "ZAR", className }: MoneyProps) {
  return <span className={cn("tabular", className)}>{formatMoney(minor, currency)}</span>;
}
