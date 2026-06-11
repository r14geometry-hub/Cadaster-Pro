import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import StarRating from "@/components/StarRating";
import {
  useGetEngineer, getGetEngineerQueryKey,
  useListEngineerReviews, getListEngineerReviewsQueryKey,
  useCreateChatRoom, getListChatsQueryKey,
  useListOrders, getListOrdersQueryKey,
  useCreateReview,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, MapPin, Briefcase, MessageSquare, Star,
  Clock, Award, ChevronRight, CheckCircle2, Folder,
  Calendar, Banknote, Phone, Building2, BarChart3, AlertTriangle
} from "lucide-react";

interface PortfolioItem {
  title: string;
  description: string;
  type: string;
  region: string;
  year: number;
  area?: string;
}

function ReviewForm({ engineerId, orderId }: { engineerId: number; orderId: number }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createReview = useCreateReview({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEngineerReviewsQueryKey(engineerId) });
        toast({ title: "Отзыв опубликован" });
        setComment("");
      },
      onError: () => toast({ title: "Ошибка", description: "Не удалось оставить отзыв", variant: "destructive" }),
    },
  });

  return (
    <div className="border rounded-xl p-4 bg-muted/30 space-y-3">
      <p className="text-sm font-medium">Оставить отзыв</p>
      <StarRating rating={rating} size="lg" interactive onRate={setRating} showValue={false} />
      <Textarea
        placeholder="Расскажите о работе специалиста..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        data-testid="input-review-comment"
      />
      <Button
        size="sm"
        onClick={() => createReview.mutate({ data: { orderId, engineerId, rating, comment } })}
        disabled={createReview.isPending || !comment.trim()}
        data-testid="button-submit-review"
      >
        {createReview.isPending ? "Публикуем..." : "Опубликовать отзыв"}
      </Button>
    </div>
  );
}

export default function EngineerCardPage() {
  const { id } = useParams<{ id: string }>();
  const engineerId = parseInt(id);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: engineer, isLoading } = useGetEngineer(engineerId, {
    query: { enabled: !!engineerId, queryKey: getGetEngineerQueryKey(engineerId), refetchInterval: 30000 },
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
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-56 rounded-2xl mb-6" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><Skeleton className="h-96 rounded-xl" /></div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!engineer) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold">Инженер не найден</h2>
        <Link href="/engineers"><Button className="mt-4">К каталогу</Button></Link>
      </div>
    );
  }

  const specs = engineer.specializations as string[];
  const regions = (engineer as unknown as { regions?: string[] }).regions ?? [engineer.region];
  const portfolio = (engineer as unknown as { portfolioItems?: PortfolioItem[] }).portfolioItems ?? [];
  const sroName = (engineer.sroName || (engineer as unknown as { sro?: string | null }).sro) as string | null | undefined;
  const rosreestrWorksCount = engineer.rosreestrWorksCount as number | null | undefined;
  const rosreestrRejectionsCount = engineer.rosreestrRejectionsCount as number | null | undefined;
  const rosreestrRejectionRate = engineer.rosreestrRejectionRate as number | null | undefined;
  const rosreestrCheckedAt = engineer.rosreestrCheckedAt as string | null | undefined;
  const rosreestrStatus = engineer.rosreestrStatus as string | null | undefined;

  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews?.filter((r) => r.rating === star).length ?? 0,
  }));

  // Use stored reviewCount for the headline count; use actual loaded reviews for the breakdown
  const totalReviews = engineer?.reviewCount ?? reviews?.length ?? 0;
  const loadedReviewCount = reviews?.length ?? 0;

  return (
    <div>
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0 flex flex-col items-center gap-1.5">
              <div className="relative">
                <Avatar className="w-24 h-24 ring-4 ring-white/20">
                  <AvatarImage src={engineer.user.avatarUrl ?? undefined} alt={engineer.user.name} />
                  <AvatarFallback className="bg-gradient-to-br from-primary/40 to-primary/60 text-white font-bold text-2xl">
                    {engineer.user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {engineer.isOnline && (
                  <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-gray-900 rounded-full" />
                )}
              </div>
              {rosreestrCheckedAt && (
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 leading-tight">Проверен</p>
                  <p className="text-[10px] text-gray-300 leading-tight font-medium">
                    {new Date(rosreestrCheckedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold" data-testid="text-engineer-name">{engineer.user.name}</h1>
                {engineer.isVerified && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3 py-1" data-testid="badge-verified">
                    <ShieldCheck className="w-3.5 h-3.5" /> Проверен Росреестром
                  </div>
                )}
                {engineer.isOnline ? (
                  <span className="text-xs text-green-400 font-medium">● Онлайн</span>
                ) : (
                  <span className="text-xs text-gray-400 font-medium">● Не в сети</span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <StarRating rating={engineer.rating} size="md" />
                <span className="text-sm text-gray-300">{engineer.reviewCount} {pluralReviews(engineer.reviewCount)}</span>
              </div>

              <div className="flex flex-wrap gap-4 mt-4">
                {[
                  { icon: Award, label: `${engineer.experience} лет опыта`, color: "text-amber-400" },
                  { icon: Briefcase, label: `${engineer.completedOrders} заказов`, color: "text-blue-400" },
                  { icon: Clock, label: engineer.responseTime ?? "в течение дня", color: "text-violet-400" },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm text-gray-300">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span>{label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1 text-sm text-gray-300">
                  <MapPin className="w-4 h-4 text-red-400" />
                  <span>{regions.slice(0, 2).join(", ")}</span>
                </div>
              </div>

              {specs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {specs.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs bg-white/10 text-gray-200 border-white/10 font-normal" data-testid={`badge-spec-${s}`}>
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="about">
              <TabsList className="mb-6 w-full sm:w-auto">
                <TabsTrigger value="about">О специалисте</TabsTrigger>
                <TabsTrigger value="portfolio" data-testid="tab-portfolio">
                  Портфолио{portfolio.length > 0 && ` (${portfolio.length})`}
                </TabsTrigger>
                <TabsTrigger value="reviews" data-testid="tab-reviews">
                  Отзывы{loadedReviewCount > 0 && ` (${loadedReviewCount})`}
                </TabsTrigger>
              </TabsList>

              {/* About */}
              <TabsContent value="about" className="space-y-5">
                {engineer.bio && (
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="font-semibold text-base mb-3">О себе</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-bio">{engineer.bio}</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-base mb-4">Специализации</h3>
                    <div className="flex flex-wrap gap-2">
                      {specs.map((s) => (
                        <div key={s} className="flex items-center gap-1.5 text-sm border rounded-lg px-3 py-2">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-semibold text-base mb-4">Регионы работы</h3>
                    <div className="flex flex-wrap gap-2">
                      {regions.map((r: string) => (
                        <div key={r} className="flex items-center gap-1.5 text-sm border rounded-lg px-3 py-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Key numbers */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Лет опыта", value: engineer.experience, icon: Award, color: "bg-amber-50 text-amber-600" },
                    { label: "Работ в реестре", value: rosreestrWorksCount ?? engineer.completedOrders, icon: Briefcase, color: "bg-blue-50 text-blue-600" },
                    { label: "Отзывов", value: totalReviews, icon: Star, color: "bg-violet-50 text-violet-600" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label}>
                      <CardContent className="p-4 text-center">
                        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center mx-auto mb-2`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Rosreestr data */}
                {engineer.isVerified && (
                  <Card className="border-emerald-200 bg-emerald-50/30">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-semibold text-base text-emerald-800">Данные Росреестра</h3>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
                        {sroName && (
                          <div className="flex items-start gap-2">
                            <Building2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">Членство в СРО</p>
                              <p className="font-medium text-foreground text-xs leading-tight">{sroName}</p>
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5 mt-1">
                                <CheckCircle2 className="w-3 h-3" /> Действующее
                              </span>
                            </div>
                          </div>
                        )}
                        {rosreestrWorksCount != null && (
                          <div className="flex items-start gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">Статистика работ</p>
                              <p className="font-semibold text-foreground">{rosreestrWorksCount} работ</p>
                              {rosreestrRejectionsCount != null && (
                                <p className="text-xs text-muted-foreground">
                                  Отказов: {rosreestrRejectionsCount}
                                  {rosreestrRejectionRate != null && ` (${(rosreestrRejectionRate * 100).toFixed(1)}%)`}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {rosreestrCheckedAt && (
                          <div className="flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">Дата проверки</p>
                              <p className="text-xs text-foreground">
                                {new Date(rosreestrCheckedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-xs text-emerald-800 leading-relaxed">
                          Кадастровый инженер состоит в действующем СРО. Ответственность инженера обеспечена компенсационным фондом саморегулируемой организации.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Portfolio */}
              <TabsContent value="portfolio">
                {portfolio.length > 0 ? (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {portfolio.map((item: PortfolioItem, i: number) => (
                      <Card key={i} className="overflow-hidden hover:shadow-md transition-shadow" data-testid={`card-portfolio-${i}`}>
                        <div className="h-2 bg-gradient-to-r from-primary to-primary/60" />
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Folder className="w-5 h-5 text-primary" />
                            </div>
                            <Badge variant="secondary" className="text-xs">{item.type}</Badge>
                          </div>
                          <h4 className="font-semibold text-sm text-foreground mb-1.5">{item.title}</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{item.description}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground pt-2 border-t">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.region}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.year}</span>
                            {item.area && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{item.area}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-14 text-muted-foreground">
                    <Folder className="w-12 h-12 mx-auto mb-3 opacity-25" />
                    <p>Портфолио не добавлено</p>
                  </div>
                )}
              </TabsContent>

              {/* Reviews */}
              <TabsContent value="reviews">
                {totalReviews > 0 && (
                  <Card className="mb-5">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-6">
                        <div className="text-center flex-shrink-0">
                          <div className="text-5xl font-bold text-foreground">{engineer.rating.toFixed(1)}</div>
                          <StarRating rating={engineer.rating} size="sm" showValue={false} />
                          <p className="text-xs text-muted-foreground mt-1">{totalReviews} отзывов</p>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          {ratingBreakdown.map(({ star, count }) => (
                            <div key={star} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-3">{star}</span>
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-amber-400 rounded-full transition-all"
                                  style={{ width: totalReviews > 0 ? `${(count / totalReviews) * 100}%` : "0%" }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-4">
                  {reviews && reviews.length > 0 ? (
                    reviews.map((review) => (
                      <Card key={review.id} data-testid={`card-review-${review.id}`}>
                        <CardContent className="p-5">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10 flex-shrink-0">
                              <AvatarImage src={(review.author as unknown as { avatarUrl?: string }).avatarUrl ?? undefined} />
                              <AvatarFallback className="text-xs bg-muted font-medium">
                                {review.author.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                  <p className="font-semibold text-sm">{review.author.name}</p>
                                  {(review as unknown as { isVerifiedPurchase?: boolean }).isVerifiedPurchase && (
                                    <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                                      <CheckCircle2 className="w-3 h-3" /> Подтверждённый заказ
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <StarRating rating={review.rating} size="sm" showValue={false} />
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(review.createdAt).toLocaleDateString("ru-RU", { year: "numeric", month: "long" })}
                                  </span>
                                </div>
                              </div>
                              {review.comment && (
                                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{review.comment}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-14 text-muted-foreground">
                      <Star className="w-12 h-12 mx-auto mb-3 opacity-25" />
                      <p className="font-medium text-foreground mb-1">Отзывов пока нет</p>
                      <p className="text-sm">Станьте первым, кто оставит отзыв</p>
                    </div>
                  )}

                  {user && user.role === "customer" && (
                    <ReviewForm engineerId={engineerId} orderId={1} />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>


          {/* Sidebar */}
          <div className="space-y-4">
            {/* Contact card */}
            <Card className="sticky top-20">
              <CardContent className="p-5 space-y-3">
                {engineer.priceFrom && (
                  <div className="text-center pb-3 border-b">
                    <p className="text-xs text-muted-foreground mb-0.5">Стоимость услуг</p>
                    <p className="text-2xl font-bold text-primary" data-testid="text-price">
                      от {engineer.priceFrom.toLocaleString("ru-RU")} ₽
                    </p>
                  </div>
                )}

                <Button className="w-full gap-2" onClick={handleChat} disabled={createChat.isPending} data-testid="button-chat">
                  <MessageSquare className="w-4 h-4" /> Написать сообщение
                </Button>

                {/* Contact info — gated until bid is accepted */}
                {(engineer as unknown as { contactsLocked?: boolean }).contactsLocked === false ? (
                  <div className="space-y-2" data-testid="contacts-unlocked">
                    {engineer.user.phone && (
                      <Button variant="outline" className="w-full gap-2" asChild data-testid="button-phone">
                        <a href={`tel:${engineer.user.phone}`}>
                          <Phone className="w-4 h-4" /> {engineer.user.phone}
                        </a>
                      </Button>
                    )}
                    {(engineer.user as unknown as { telegram?: string | null }).telegram && (
                      <Button variant="outline" className="w-full gap-2" asChild data-testid="button-telegram">
                        <a href={`https://t.me/${(engineer.user as unknown as { telegram: string }).telegram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">
                          <span className="text-sm">💬</span> Telegram: {(engineer.user as unknown as { telegram: string }).telegram}
                        </a>
                      </Button>
                    )}
                    {(engineer.user as unknown as { whatsapp?: string | null }).whatsapp && (
                      <Button variant="outline" className="w-full gap-2" asChild data-testid="button-whatsapp">
                        <a href={`https://wa.me/${(engineer.user as unknown as { whatsapp: string }).whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                          <span className="text-sm">📱</span> WhatsApp: {(engineer.user as unknown as { whatsapp: string }).whatsapp}
                        </a>
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground" data-testid="contacts-locked">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0 opacity-40" />
                    <span>Контакты доступны после выбора исполнителя</span>
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-violet-500" />
                    <span>Отвечает: <span className="font-medium text-foreground">{engineer.responseTime}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>
                      {engineer.isVerified
                        ? <span className="font-medium text-emerald-600">Реестр №{engineer.registryNumber}</span>
                        : "Не верифицирован"
                      }
                    </span>
                  </div>
                  {sroName && (
                    <div className="flex items-start gap-2">
                      <Building2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="text-emerald-700 font-medium leading-tight">{sroName}</span>
                    </div>
                  )}
                  {rosreestrWorksCount != null && (
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>{rosreestrWorksCount} работ · {rosreestrRejectionsCount ?? 0} отказов
                        {rosreestrRejectionRate != null && ` · ${(rosreestrRejectionRate * 100).toFixed(1)}% отказов`}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Rating card */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl font-bold" data-testid="text-rating">{engineer.rating.toFixed(1)}</span>
                  <div>
                    <StarRating rating={engineer.rating} size="sm" showValue={false} />
                    <p className="text-xs text-muted-foreground">{totalReviews} отзывов</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {ratingBreakdown.map(({ star, count }) => (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-muted-foreground">{star}</span>
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: totalReviews > 0 ? `${(count / totalReviews) * 100}%` : "0%" }}
                        />
                      </div>
                      <span className="w-4 text-muted-foreground text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function pluralReviews(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "отзыв";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "отзыва";
  return "отзывов";
}
