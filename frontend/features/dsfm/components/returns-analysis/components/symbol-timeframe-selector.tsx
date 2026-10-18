import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POPULAR_STOCKS, TIMEFRAME_GROUPS } from "@/features/dsfm/constants";

interface SymbolTimeframeSelectorProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;
}

export function SymbolTimeframeSelector({
  selectedSymbol,
  onSymbolChange,
  timeframe,
  onTimeframeChange,
}: SymbolTimeframeSelectorProps) {
  return (
    <div className="flex items-end gap-4">
      <div className="flex-1">
        <label className="mb-2 block text-sm font-medium">Select Stock</label>
        <Select value={selectedSymbol} onValueChange={onSymbolChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a stock" />
          </SelectTrigger>
          <SelectContent>
            {POPULAR_STOCKS.map((sym) => (
              <SelectItem key={sym} value={sym}>
                {sym}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-40">
        <label className="mb-2 block text-sm font-medium">Timeframe</label>
        <Select value={timeframe} onValueChange={onTimeframeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAME_GROUPS.map((group, idx) => (
              <div key={group.label}>
                {idx > 0 && <SelectSeparator />}
                <SelectGroup>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
