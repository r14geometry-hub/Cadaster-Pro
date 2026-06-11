import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import StarRating from "@/components/StarRating";
import {
  useGetOrder, getGetOrderQueryKey,
  useListOrderBids, getListOrderBidsQueryKey,
  useUpdateBid,
  useUpdateOrder, getListOrdersQueryKey,
  useCompleteOrder,
  useCreateChatRoom, getListChatsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin, Calendar, Wallet, CheckCircle, XCircle, MessageSquare,
  ShieldCheck, Clock, ChevronLeft, Star, AlertCircle, Phone, Mail,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; step: number }> = {
  draft:                { label: "Черновик",       color: "bg-gray-100 text-gray-600 border-gray-200",     step: 0 },
  new:                  { label: "Новая",          color: "bg-blue-50 text-blue-700 border-blue-200",      step: 1 },
  open:                 { label: "Открыта",        color: "bg-blue-50 text-blue-700 border-blue-200",      step: 1 },
  collecting_responses: { label: "Сбор откликов", color: "bg-indigo-50 text-indigo-700 border-indigo-200", step: 2 },
  engineer_selected:    { label: "Инженер выбран",color: "bg-teal-50 text-teal-700 border-teal-200",       step: 3 },
  in_progress:          { label: "В работе",       color: "bg-amber-50 text-amber-700 border-amber-200",   step: 3 },
  completed:            { label: "Завершена",      color: "bg-green-50 text-green-700 border-green-200",   step: 4 },
  cancelled:            { label: "Отменена",       color: "bg-red-50 text-red-600 border-red-200",         step: -1 },
};

const STEPS = ["Черновик", "Новая", "Сбор откликов", "Инженер выбран", "Завершена"];

function StatusBar({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
        <XCircle className="w-4 h-4" /> Заявка отменена
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${i <= cfg.step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {i < cfg.step && <CheckCircle className="w-3 h-3" />}
            {label}
          </div>
          {i < STEPS.length - 1 && <div className={`h-px w-6 ${i < cfg.step ? "bg-primary" : "bg-muted"}`} />}
        </div>
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-0.5 transition-transform hover:scale-110"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          <Star
            className={`w-7 h-7 ${(hover || value) >= star ? "fill-amber-400 text-amber-400" : "text-gray-300"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const id = parseInt(orderId);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [acceptingBid, setAcceptingBid] = useState<number | null>(null);

  const { data: order, isLoading: orderLoading } = useGetOrder(id, {
    query: { queryKey: getGetOrderQueryKey(id) },
  });

  const { data: bids, isLoading: bidsLoading } = useListOrderBids(id, {
    query: { queryKey: getListOrderBidsQueryKey(id) },
  });

  const updateBid = useUpdateBid({
    mutation: {
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: getListOrderBidsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        if (vars.data.status === "accepted") {
          toast({ title: "Отклик принят", description: "Чат с инженером создан автоматически" });
          queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
        } else {
          toast({ title: "Отклик отклонён" });
        }
        setAcceptingBid(null);
      },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    },
  });

  const updateOrder = useUpdateOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast({ title: "Заявка обновлена" });
      },
    },
  });

  const completeOrder = useCompleteOrder({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        setReviewOpen(false);
        toast({ title: "Заявка завершена!", description: reviewRating > 0 ? "Отзыв опубликован" : undefined });
      },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    },
  });

  const createChat = useCreateChatRoom({
    mutation: {
      onSuccess: (room) => {
        queryClient.invalidateQueries({ queryKey: getListChatsQueryKey() });
        setLocation(`/chat/${room.id}`);
      },
    },
  });

  const isOwner = order?.customerId === user?.id;
  const acceptedBid = bids?.find(b => b.status === "accepted");
  const pendingBids = bids?.filter(b => b.status === "pending") ?? [];

  if (orderLoading) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold mb-2">Заявка не найдена</h2>
        <Button onClick={() => setLocation("/dashboard/customer")}>В кабинет</Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.open;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back */}
      <button
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        onClick={() => setLocation(user?.role === "engineer" ? "/dashboard/engineer" : "/dashboard/customer")}
      >
        <ChevronLeft className="w-4 h-4" /> Назад
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-order-detail">{order.title}</h1>
          <Badge variant="outline" className={statusCfg.color} data-testid="badge-order-status">
            {statusCfg.label}
          </Badge>
        </div>
        <StatusBar status={order.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">

          {/* Order Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Описание заявки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground leading-relaxed">{order.description}</p>
              <Separator />
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span>{order.region}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">{order.serviceType}</span>
                </div>
                {order.budget && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wallet className="w-4 h-4 flex-shrink-0" />
                    <span>Бюджет: <strong className="text-foreground">{order.budget.toLocaleString("ru-RU")} ₽</strong></span>
                  </div>
                )}
                {order.deadline && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>Срок: <strong className="text-foreground">{order.deadline}</strong></span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Размещена {new Date(order.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </CardContent>
          </Card>

          {/* Bids */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Отклики инженеров</span>
                <Badge variant="secondary">{bids?.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bidsLoading ? (
                <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
              ) : bids && bids.length > 0 ? (
                <div className="space-y-4">
                  {bids.map((bid) => {
                    const isAccepted = bid.status === "accepted";
                    const isRejected = bid.status === "rejected";
                    return (
                      <div
                        key={bid.id}
                        className={`border rounded-xl p-4 transition-all ${isAccepted ? "border-green-300 bg-green-50/50" : isRejected ? "opacity-60 bg-gray-50" : "hover:border-primary/30"}`}
                        data-testid={`card-bid-${bid.id}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <Avatar className="w-11 h-11">
                              {bid.engineer.user.avatarUrl && <AvatarImage src={bid.engineer.user.avatarUrl} alt={bid.engineer.user.name} />}
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {bid.engineer.user.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {bid.engineer.isOnline && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <span
                                className="font-semibold text-sm cursor-pointer hover:text-primary"
                                onClick={() => setLocation(`/engineers/${bid.engineerId}`)}
                                data-testid={`text-bid-engineer-${bid.id}`}
                              >
                                {bid.engineer.user.name}
                              </span>
                              {bid.engineer.isVerified && (
                                <span className="flex items-center gap-0.5 text-xs text-green-600 font-medium">
                                  <ShieldCheck className="w-3 h-3" /> Проверен
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className={
                                  isAccepted ? "bg-green-100 text-green-700 border-green-200" :
                                  isRejected ? "bg-gray-100 text-gray-500" :
                                  "bg-blue-50 text-blue-700 border-blue-200"
                                }
                                data-testid={`status-bid-${bid.id}`}
                              >
                                {isAccepted ? "Принят" : isRejected ? "Отклонён" : "Ожидает"}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-3 mb-2">
                              <StarRating rating={bid.engineer.rating} />
                              <span className="text-xs text-muted-foreground">{bid.engineer.reviewCount} отзывов</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">{bid.engineer.experience} лет опыта</span>
                            </div>

                            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{bid.message}</p>

                            {/* Proposed terms */}
                            <div className="flex flex-wrap gap-4 text-sm">
                              {bid.price && (
                                <div className="flex items-center gap-1.5">
                                  <Wallet className="w-4 h-4 text-primary" />
                                  <span className="font-semibold text-primary">{bid.price.toLocaleString("ru-RU")} ₽</span>
                                </div>
                              )}
                              {bid.proposedDeadline && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Clock className="w-4 h-4" />
                                  <span>Срок: {bid.proposedDeadline}</span>
                                </div>
                              )}
                            </div>

                            {/* Contact info unlocked for accepted bid */}
                            {isAccepted && isOwner && (
                              <div className="mt-3 pt-3 border-t border-green-200 space-y-1.5">
                                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Контакты инженера</p>
                                {bid.engineer.user.phone && (
                                  <a
                                    href={`tel:${bid.engineer.user.phone}`}
                                    className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                                    data-testid={`text-engineer-phone-${bid.id}`}
                                  >
                                    <Phone className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                    {bid.engineer.user.phone}
                                  </a>
                                )}
                                {bid.engineer.user.email && (
                                  <a
                                    href={`mailto:${bid.engineer.user.email}`}
                                    className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                                    data-testid={`text-engineer-email-${bid.id}`}
                                  >
                                    <Mail className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                    {bid.engineer.user.email}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions for order owner */}
                        {isOwner && !isRejected && (
                          <div className="flex gap-2 mt-4 pt-3 border-t">
                            {bid.status === "pending" && ["new", "open", "collecting_responses"].includes(order.status) && (
                              <>
                                <Button
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => {
                                    setAcceptingBid(bid.id);
                                    updateBid.mutate({ orderId: id, bidId: bid.id, data: { status: "accepted" } });
                                  }}
                                  disabled={updateBid.isPending && acceptingBid === bid.id}
                                  data-testid={`button-accept-bid-${bid.id}`}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  {updateBid.isPending && acceptingBid === bid.id ? "Принимаем..." : "Принять"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                  onClick={() => updateBid.mutate({ orderId: id, bidId: bid.id, data: { status: "rejected" } })}
                                  disabled={updateBid.isPending}
                                  data-testid={`button-reject-bid-${bid.id}`}
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Отклонить
                                </Button>
                              </>
                            )}
                            {isAccepted && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => createChat.mutate({ data: { engineerId: bid.engineerId, orderId: id } })}
                                data-testid={`button-open-chat-${bid.id}`}
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> Открыть чат
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-25" />
                  <p className="text-sm">Откликов ещё нет. Инженеры скоро свяжутся с вами.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer actions */}
          {isOwner && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Управление заявкой</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {order.status === "draft" && (
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => updateOrder.mutate({ orderId: id, data: { status: "new" } })}
                    disabled={updateOrder.isPending}
                    data-testid="button-publish-order"
                  >
                    Опубликовать заявку
                  </Button>
                )}
                {order.status === "engineer_selected" && (
                  <Button
                    className="w-full gap-1.5"
                    size="sm"
                    onClick={() => updateOrder.mutate({ orderId: id, data: { status: "in_progress" } })}
                    disabled={updateOrder.isPending}
                    data-testid="button-start-order"
                  >
                    Начать работу
                  </Button>
                )}
                {order.status === "in_progress" && (
                  <Button
                    className="w-full gap-1.5"
                    size="sm"
                    onClick={() => setReviewOpen(true)}
                    data-testid="button-complete-order"
                  >
                    <CheckCircle className="w-4 h-4" /> Завершить заявку
                  </Button>
                )}
                {["draft", "new", "open", "collecting_responses"].includes(order.status) && (
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    onClick={() => updateOrder.mutate({ orderId: id, data: { status: "cancelled" } })}
                    disabled={updateOrder.isPending}
                    data-testid="button-cancel-order"
                  >
                    Отменить
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Accepted engineer card */}
          {acceptedBid && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-green-700 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Выбранный инженер
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    {acceptedBid.engineer.user.avatarUrl && <AvatarImage src={acceptedBid.engineer.user.avatarUrl} alt={acceptedBid.engineer.user.name} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                      {acceptedBid.engineer.user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{acceptedBid.engineer.user.name}</p>
                    <StarRating rating={acceptedBid.engineer.rating} />
                  </div>
                </div>
                {acceptedBid.price && (
                  <p className="text-sm font-semibold text-primary">{acceptedBid.price.toLocaleString("ru-RU")} ₽</p>
                )}
                {acceptedBid.proposedDeadline && (
                  <p className="text-xs text-muted-foreground">Срок: {acceptedBid.proposedDeadline}</p>
                )}
                {isOwner && (acceptedBid.engineer.user.phone || acceptedBid.engineer.user.email) && (
                  <div className="space-y-1.5 pt-2 border-t border-green-200">
                    {acceptedBid.engineer.user.phone && (
                      <a
                        href={`tel:${acceptedBid.engineer.user.phone}`}
                        className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                        data-testid="text-sidebar-engineer-phone"
                      >
                        <Phone className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                        {acceptedBid.engineer.user.phone}
                      </a>
                    )}
                    {acceptedBid.engineer.user.email && (
                      <a
                        href={`mailto:${acceptedBid.engineer.user.email}`}
                        className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                        data-testid="text-sidebar-engineer-email"
                      >
                        <Mail className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                        {acceptedBid.engineer.user.email}
                      </a>
                    )}
                  </div>
                )}
                <Button
                  className="w-full gap-1.5"
                  size="sm"
                  variant="outline"
                  onClick={() => createChat.mutate({ data: { engineerId: acceptedBid.engineerId, orderId: id } })}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Написать
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardContent className="p-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Откликов</span>
                <span className="font-medium text-foreground">{bids?.length ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Ожидают ответа</span>
                <span className="font-medium text-foreground">{pendingBids.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Статус</span>
                <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Complete Order + Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Завершить заявку</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <p className="text-sm text-muted-foreground">
              Подтвердите завершение работ и оставьте отзыв инженеру — это поможет другим заказчикам.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">Оценка работы</p>
              <StarPicker value={reviewRating} onChange={setReviewRating} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Отзыв (необязательно)</p>
              <Textarea
                placeholder="Расскажите о качестве работы, соблюдении сроков..."
                rows={4}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                data-testid="input-review-comment"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewOpen(false)}>Отмена</Button>
              <Button
                onClick={() => {
                  if (!acceptedBid) return;
                  completeOrder.mutate({
                    orderId: id,
                    data: {
                      engineerId: acceptedBid.engineerId,
                      rating: reviewRating,
                      comment: reviewComment || undefined,
                    },
                  });
                }}
                disabled={completeOrder.isPending || !acceptedBid}
                data-testid="button-submit-review"
              >
                {completeOrder.isPending ? "Завершаем..." : "Завершить и оценить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
