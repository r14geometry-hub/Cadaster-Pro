import { useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import StarRating from "@/components/StarRating";
import OrderCard from "@/components/OrderCard";
import {
  useListOrders, getListOrdersQueryKey,
  useListOrderBids, getListOrderBidsQueryKey,
  useUpdateBid, useUpdateOrder,
  useCreateChatRoom, getListChatsQueryKey,
  useListChats, getListChatsQueryKey as chatKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, MessageSquare, Bell, CheckCircle, XCircle } from "lucide-react";
import type { Order } from "@workspace/api-client-react";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  open: { label: "Открыта", className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "В работе", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  completed: { label: "Завершена", className: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "Отменена", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

function BidsList({ order }: { order: Order }) {
  const { data: bids, isLoading } = useListOrderBids(order.id, {
    query: { queryKey: getListOrderBidsQueryKey(order.id) },
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const updateBid = useUpdateBid({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOrderBidsQueryKey(order.id) });
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        toast({ title: "Отклик обновлён" });
      },
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

  if (isLoading) return <Skeleton className="h-20 rounded-lg" />;
  if (!bids || bids.length === 0) return <p className="text-sm text-muted-foreground py-2">Откликов ещё нет</p>;

  return (
    <div className="space-y-3 mt-3">
      {bids.map((bid) => (
        <div key={bid.id} className="border rounded-lg p-4 bg-gray-50" data-testid={`card-bid-${bid.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {bid.engineer.user.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="font-medium text-sm" data-testid={`text-bid-engineer-${bid.id}`}>{bid.engineer.user.name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <StarRating rating={bid.engineer.rating} />
                  {bid.price && <span className="text-sm font-semibold text-primary">{bid.price.toLocaleString("ru-RU")} ₽</span>}
                </div>
              </div>
            </div>
            <Badge variant="outline" className={
              bid.status === "accepted" ? "bg-green-50 text-green-700 border-green-200" :
              bid.status === "rejected" ? "bg-gray-100 text-gray-500 border-gray-200" :
              "bg-blue-50 text-blue-700 border-blue-200"
            } data-testid={`status-bid-${bid.id}`}>
              {bid.status === "accepted" ? "Принят" : bid.status === "rejected" ? "Отклонён" : "Ожидает"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{bid.message}</p>
          {bid.status === "pending" && order.status === "open" && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                className="gap-1"
                onClick={() => updateBid.mutate({ orderId: order.id, bidId: bid.id, data: { status: "accepted" } })}
                disabled={updateBid.isPending}
                data-testid={`button-accept-bid-${bid.id}`}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Принять
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => updateBid.mutate({ orderId: order.id, bidId: bid.id, data: { status: "rejected" } })}
                disabled={updateBid.isPending}
                data-testid={`button-reject-bid-${bid.id}`}
              >
                <XCircle className="w-3.5 h-3.5" /> Отклонить
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 ml-auto"
                onClick={() => createChat.mutate({ data: { engineerId: bid.engineerId } })}
                data-testid={`button-chat-bid-${bid.id}`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Написать
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  const { data: orders, isLoading } = useListOrders(
    { customerId: user?.id },
    { query: { enabled: !!user, queryKey: getListOrdersQueryKey({ customerId: user?.id }) } }
  );

  const { data: chats } = useListChats({ query: { enabled: !!user, queryKey: chatKey() } });

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-4">Войдите, чтобы увидеть кабинет</h2>
        <Button onClick={() => setLocation("/auth/login")}>Войти</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1" data-testid="heading-customer-dashboard">Личный кабинет</h1>
        <p className="text-muted-foreground">Добро пожаловать, {user.name}</p>
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="mb-6" data-testid="tabs-dashboard">
          <TabsTrigger value="orders" data-testid="tab-orders">Мои заявки</TabsTrigger>
          <TabsTrigger value="chats" data-testid="tab-chats">Чаты</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Мои заявки</h2>
            <Button size="sm" onClick={() => setLocation("/orders/create")} data-testid="button-new-order">
              Новая заявка
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}</div>
          ) : orders && orders.items.length > 0 ? (
            <div className="space-y-4">
              {orders.items.map((order) => (
                <div key={order.id} data-testid={`order-row-${order.id}`}>
                  <OrderCard order={order} showLink={false} />
                  <div className="mt-2 px-1">
                    <button
                      className="text-sm text-primary hover:underline"
                      onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                      data-testid={`button-toggle-bids-${order.id}`}
                    >
                      {expandedOrder === order.id ? "Скрыть отклики" : `Показать отклики (${order.bidCount})`}
                    </button>
                    {expandedOrder === order.id && <BidsList order={order} />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="font-medium text-foreground mb-1">Заявок пока нет</h3>
              <p className="text-sm mb-4">Разместите заявку и получите отклики от инженеров</p>
              <Button onClick={() => setLocation("/orders/create")} data-testid="button-create-first-order">Разместить заявку</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="chats">
          {chats && chats.length > 0 ? (
            <div className="space-y-3">
              {chats.map((chat) => (
                <Card key={chat.id} className="cursor-pointer hover:shadow-sm" onClick={() => setLocation(`/chat/${chat.id}`)} data-testid={`card-chat-${chat.id}`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {chat.engineer.user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{chat.engineer.user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{chat.lastMessage ?? "Нет сообщений"}</p>
                    </div>
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="font-medium text-foreground mb-1">Чатов пока нет</h3>
              <p className="text-sm">Найдите инженера и начните общение</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
