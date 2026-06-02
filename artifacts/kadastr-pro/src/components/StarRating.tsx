import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export default function StarRating({ rating, max = 5, size = "sm", showValue = true, interactive = false, onRate }: StarRatingProps) {
  const starClass = size === "sm" ? "w-3.5 h-3.5" : size === "md" ? "w-5 h-5" : "w-6 h-6";
  const textClass = size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base";

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <Star
            key={i}
            className={`${starClass} transition-colors ${
              i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/25"
            } ${interactive ? "cursor-pointer hover:fill-amber-300 hover:text-amber-300" : ""}`}
            onClick={interactive && onRate ? () => onRate(i + 1) : undefined}
          />
        ))}
      </div>
      {showValue && (
        <span className={`font-semibold text-foreground ${textClass}`}>
          {rating > 0 ? rating.toFixed(1) : "—"}
        </span>
      )}
    </div>
  );
}
