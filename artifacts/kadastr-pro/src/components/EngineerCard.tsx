import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import StarRating from "./StarRating";
import { ShieldCheck, MapPin, Briefcase, MessageSquare, Clock, Award, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateChatRoom, getListChatsQueryKey, type Engineer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface EngineerCardProps {
  engineer: Engineer;
}

export default function EngineerCard({ engineer }: EngineerCardProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createChat = useCreateChatRoom({
    mutation: {
      onSuccess: (room) => {
        queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
        setLocation(`/chat/${room.id}`);
      },
      onError: () => toast({ title: "Ошибка", description: "Не удалось открыть чат", variant: "destructive" }),
    },
  });

  const handleChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { setLocation("/auth/login"); return; }
    createChat.mutate({ data: { engineerId: engineer.id } });
  };

  const specs = engineer.specializations as string[];

  return (
    <Card
      className={`group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border overflow-hidden ${
        engineer.isPro ? "border-amber-300 ring-1 ring-amber-200" : "border-border/60"
      }`}
      data-testid={`card-engineer-${engineer.id}`}
    >
      <CardContent className="p-0">
        {/* PRO banner */}
        {engineer.isPro && (
          <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-white" />
            <span className="text-xs font-bold text-white uppercase tracking-wide">PRO</span>
          </div>
        )}

        {/* Top section */}
        <div className="p-5 pb-4">
          <div className="flex items-start gap-4">
            {/* Avatar with online indicator */}
            <div className="relative flex-shrink-0">
              <Avatar className="w-16 h-16 ring-2 ring-border">
                <AvatarImage src={engineer.user.avatarUrl ?? undefined} alt={engineer.user.name} />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary font-bold text-lg">
                  {engineer.user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {engineer.isOnline && (
                <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" data-testid={`indicator-online-${engineer.id}`} />
              )}
            </div>

            {/* Name + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <Link href={`/engineers/${engineer.id}`}>
                  <h3 className="font-bold text-base text-foreground hover:text-primary transition-colors leading-tight cursor-pointer" data-testid={`text-engineer-name-${engineer.id}`}>
                    {engineer.user.name}
                  </h3>
                </Link>
              </div>

              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {engineer.isPro && (
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5" data-testid={`badge-pro-${engineer.id}`}>
                    <Sparkles className="w-3 h-3" /> PRO
                  </div>
                )}
                {engineer.isVerified && (
                  <div className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5" data-testid={`badge-verified-${engineer.id}`}>
                    <ShieldCheck className="w-3 h-3" /> Росреестр ✓
                  </div>
                )}
                {engineer.isOnline ? (
                  <span className="text-xs text-emerald-600 font-medium">● Онлайн</span>
                ) : (
                  <span className="text-xs text-muted-foreground">● Офлайн</span>
                )}
              </div>

              {/* Rating row */}
              <div className="flex items-center gap-2 mt-2">
                <StarRating rating={engineer.rating} size="sm" />
                <span className="text-xs text-muted-foreground" data-testid={`text-reviews-${engineer.id}`}>
                  {engineer.reviewCount} {pluralReviews(engineer.reviewCount)}
                </span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-dashed">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span><span className="font-semibold text-foreground">{engineer.experience}</span> лет</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Briefcase className="w-3.5 h-3.5 text-blue-500" />
              <span><span className="font-semibold text-foreground">{engineer.rosreestrWorksCount ?? engineer.completedOrders}</span> работ</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-violet-500" />
              <span>{engineer.responseTime}</span>
            </div>
          </div>
          {(engineer.sroName || (engineer as unknown as { sro?: string | null }).sro) && (
            <div className="mt-2 text-xs text-muted-foreground truncate" title={(engineer.sroName || (engineer as unknown as { sro?: string | null }).sro) as string}>
              СРО: {(engineer.sroName || (engineer as unknown as { sro?: string | null }).sro) as string}
            </div>
          )}
        </div>

        {/* Specializations */}
        {specs.length > 0 && (
          <div className="px-5 pb-3 flex flex-wrap gap-1.5">
            {specs.slice(0, 3).map((s: string) => (
              <Badge key={s} variant="secondary" className="text-xs px-2 py-0.5 bg-muted/60 font-normal" data-testid={`badge-spec-${engineer.id}`}>
                {s}
              </Badge>
            ))}
            {specs.length > 3 && (
              <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-muted/60 font-normal">
                +{specs.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Region + price */}
        <div className="px-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span data-testid={`text-region-${engineer.id}`}>{engineer.region}</span>
          </div>
          {engineer.priceFrom && (
            <div className="flex items-center gap-1 text-xs font-semibold text-primary">
              <span data-testid={`text-price-${engineer.id}`}>от {engineer.priceFrom.toLocaleString("ru-RU")} ₽</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-2">
          <Link href={`/engineers/${engineer.id}`} className="flex-1" data-testid={`link-engineer-profile-${engineer.id}`}>
            <Button variant="outline" size="sm" className="w-full text-sm font-medium">Профиль</Button>
          </Link>
          <Button
            size="sm"
            className="flex-1 gap-1.5 text-sm font-medium"
            onClick={handleChat}
            disabled={createChat.isPending}
            data-testid={`button-chat-${engineer.id}`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Написать
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function pluralReviews(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "отзыв";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "отзыва";
  return "отзывов";
}
