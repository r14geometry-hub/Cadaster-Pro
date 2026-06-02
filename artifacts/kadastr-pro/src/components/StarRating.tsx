import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: "sm" | "md";
  showValue?: boolean;
}

export default function StarRating({ rating, max = 5, size = "sm", showValue = true }: StarRatingProps) {
  const starSize = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <Star
            key={i}
            className={`${starSize} ${i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/30"}`}
          />
        ))}
      </div>
      {showValue && (
        <span className={`font-medium text-foreground ${size === "sm" ? "text-xs" : "text-sm"}`}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
