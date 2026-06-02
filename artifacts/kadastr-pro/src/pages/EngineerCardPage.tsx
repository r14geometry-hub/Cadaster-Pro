import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import StarRating from "@/components/StarRating";
import { useGetEngineer, getGetEngineerQueryKey, useListEngineerReviews, getListEngineerReviewsQueryKey, useCreateChatRoom, getListChatsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, MapPin, Briefcase, MessageSquare, Star, Clock, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EngineerCardPage() {
  const { id } = useParams<{ id: string }>();
  const engineerId = parseInt(id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: engineer, isLoading } = useGetEngineer(engineerId, {
    query: { enabled: !!engineerId, queryKey: getGetEngineerQueryKey(engineerId) },
  });

  const { data: reviews } = useListEngineerReviews(engineerId, {
    query: { enabled: !!engineerId, queryKey: getListEngineerReviewsQueryKey(engineerId) },
  });

  const createChat = useCreateChatRoom({
    mutation: {
      onSuccess: (room) => {
        queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
        setLocation(`/chat/${room.id}`);
      },
      onError: () => toast({ title: "Ошибка", description: "Не удалось открыть чат", variant: "destructive" }),
    },
  });

  const handleChat = () => {
    if (!user) { setLocation("/auth/login"); return; }
    createChat.mutate({ data: { engineerId } });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-10">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!engineer) {
    return (
      <div className="container mx-auto px-4 py-10 text-center">
        <h2 className="text-xl font-semibold">Инженер не найден</h2>
      </div>
    );
  }

  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews?.filter((r) => r.rating === star).length ?? 0,
  }));

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-5">
                <Avatar className="w-20 h-20 flex-shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                    {engineer.user.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-foreground" data-testid="text-engineer-name">{engineer.user.name}</h1>
                    {engineer.isVerified && (
                      <Badge className="bg-green-50 text-green-700 border-green-200 gap-1" data-testid="badge-verified">
                        <ShieldCheck className="w-3.5 h-3.5" /> Проверен реестром
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-muted-foreground text-sm">
                    <MapPin className="w-4 h-4" />
                    <span data-testid="text-region">{engineer.region}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <StarRating rating={engineer.rating} size="md" />
                      <span className="text-sm text-muted-foreground">({engineer.reviewCount} отзывов)</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Briefcase className="w-4 h-4" />
                      <span data-testid="text-completed">{engineer.completedOrders} заказов</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{engineer.experience} лет опыта</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {engineer.specializations.map((s) => (
                      <Badge key={s} variant="secondary" data-testid={`badge-spec-${s}`}>{s}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              {engineer.bio && (
                <div className="mt-5 pt-5 border-t">
                  <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-bio">{engineer.bio}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Отзывы</CardTitle>
            </CardHeader>
            <CardContent>
              {reviews && reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0" data-testid={`card-review-${review.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs bg-muted">{review.author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{review.author.name}</span>
                        </div>
                        <StarRating rating={review.rating} showValue={false} />
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                      )}
                      <span className="text-xs text-muted-foreground mt-1 block">
                        {new Date(review.createdAt).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Отзывов пока нет</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              <Button className="w-full gap-2" onClick={handleChat} disabled={createChat.isPending} data-testid="button-chat">
                <MessageSquare className="w-4 h-4" /> Написать сообщение
              </Button>
              <div className="text-xs text-muted-foreground text-center">
                Номер реестра: <span className="font-medium text-foreground" data-testid="text-registry">{engineer.registryNumber}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Рейтинг</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl font-bold text-foreground" data-testid="text-rating">{engineer.rating.toFixed(1)}</span>
                <div>
                  <StarRating rating={engineer.rating} size="md" showValue={false} />
                  <p className="text-xs text-muted-foreground mt-0.5">{engineer.reviewCount} отзывов</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {ratingBreakdown.map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-muted-foreground">{star}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: engineer.reviewCount > 0 ? `${(count / engineer.reviewCount) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="w-4 text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm">
                <Award className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Опыт работы:</span>
                <span className="font-medium">{engineer.experience} лет</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Завершённых заказов:</span>
                <span className="font-medium">{engineer.completedOrders}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
