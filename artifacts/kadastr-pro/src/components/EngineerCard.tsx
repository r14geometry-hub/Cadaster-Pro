import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import StarRating from "./StarRating";
import { ShieldCheck, MapPin, Briefcase, MessageSquare } from "lucide-react";
import type { Engineer } from "@workspace/api-client-react";

interface EngineerCardProps {
  engineer: Engineer;
}

export default function EngineerCard({ engineer }: EngineerCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-engineer-${engineer.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="w-12 h-12 flex-shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {engineer.user.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/engineers/${engineer.id}`}>
                <span className="font-semibold text-foreground hover:text-primary transition-colors cursor-pointer" data-testid={`text-engineer-name-${engineer.id}`}>
                  {engineer.user.name}
                </span>
              </Link>
              {engineer.isVerified && (
                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs px-1.5 py-0" data-testid={`badge-verified-${engineer.id}`}>
                  <ShieldCheck className="w-3 h-3" /> Проверен
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span data-testid={`text-region-${engineer.id}`}>{engineer.region}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <StarRating rating={engineer.rating} />
              <span className="text-xs text-muted-foreground" data-testid={`text-reviews-${engineer.id}`}>
                {engineer.reviewCount} отзывов
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                {engineer.completedOrders} заказов
              </span>
            </div>
            {engineer.specializations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {engineer.specializations.slice(0, 3).map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs px-2 py-0" data-testid={`badge-spec-${engineer.id}`}>
                    {s}
                  </Badge>
                ))}
                {engineer.specializations.length > 3 && (
                  <Badge variant="secondary" className="text-xs px-2 py-0">
                    +{engineer.specializations.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Link href={`/engineers/${engineer.id}`} className="flex-1" data-testid={`link-engineer-profile-${engineer.id}`}>
            <Button variant="outline" size="sm" className="w-full">Профиль</Button>
          </Link>
          <Button variant="default" size="sm" className="flex items-center gap-1" data-testid={`button-chat-${engineer.id}`}>
            <MessageSquare className="w-3.5 h-3.5" /> Написать
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
