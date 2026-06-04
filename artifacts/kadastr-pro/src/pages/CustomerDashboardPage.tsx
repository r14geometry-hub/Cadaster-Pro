import { useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  useListOrders, getListOrdersQueryKey,
  useListChats, getListChatsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardList, MessageSquare, ChevronRight, Plus } from "lucide-react";
import type { Order } from "@workspace/api-client-react";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:       { label: "Черновик",  className: "bg-gray-100 text-gray-600 border-gray-200" },
  open:        { label: "Открыта",   className: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "В работе",  className: "bg-amber-50 text-amber-700 border-amber-200" },
  completed:   { label: "Завершена", className: "bg-green-50 text-green-700 border-green-200" },
  cancelled:   { label: "Отменена",  className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const ORDER_FILTER_TABS = [
  { value: "all",         label: "Все" },
  { value: "open",        label: "Открытые" },
  { value: "in_progress", label: "В работе" },
  { value: "completed",   label: "Завершённые" },
  { value: "draft",       label: "Черновики" },
];

function OrderRow({ order }: { order: Order }) {
  const [, setLocation] = useLocation();
  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.open;
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setLocation(`/orders/${order.id}`)}
      data-testid={`order-row-${order.id}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`text-xs ${status.className}`} data-testid={`badge-order-status-${order.id}`}>
                {status.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{order.serviceType}</span>
            </div>
            <p className="font-semibold text-sm truncate" data-testid={`text-order-title-${order.id}`}>{order.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{order.region}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{order.bidCount} откликов</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(order.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerDashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [orderTab, setOrderTab] = useState("all");

  const { data: orders, isLoading } = useListOrders(
    { customerId: user?.id },
    { query: { enabled: !!user, queryKey: getListOrdersQueryKey({ customerId: user?.id }) } }
  );

  const { data: chats } = useListChats({ query: { enabled: !!user, queryKey: getListChatsQueryKey() } });

  const totalUnread = chats?.reduce((s, c) => s + (c.unreadCount ?? 0), 0) ?? 0;

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-4">Войдите, чтобы увидеть кабинет</h2>
        <Button onClick={() => setLocation("/auth/login")}>Войти</Button>
      </div>
    );
  }

  const filteredOrders = orders?.items.filter(o =>
    orderTab === "all" ? true : o.status === orderTab
  ) ?? [];

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1" data-testid="heading-customer-dashboard">Личный кабинет</h1>
          <p className="text-muted-foreground">Добро пожаловать, {user.name}</p>
        </div>
        <Button onClick={() => setLocation("/orders/create")} data-testid="button-new-order" className="gap-1.5">
          <Plus className="w-4 h-4" /> Новая заявка
        </Button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Всего заявок",    value: orders?.total ?? 0 },
          { label: "Открытые",        value: orders?.items.filter(o => o.status === "open").length ?? 0 },
          { label: "В работе",        value: orders?.items.filter(o => o.status === "in_progress").length ?? 0 },
          { label: "Непрочитанных",   value: totalUnread },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="mb-6" data-testid="tabs-dashboard">
          <TabsTrigger value="orders" data-testid="tab-orders">Мои заявки</TabsTrigger>
          <TabsTrigger value="chats" data-testid="tab-chats" className="relative">
            Чаты
            {totalUnread > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                {totalUnread}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Orders */}
        <TabsContent value="orders">
          {/* Sub-filter tabs */}
          <div className="flex gap-1 flex-wrap mb-4">
            {ORDER_FILTER_TABS.map(tab => (
              <button
                key={tab.value}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${orderTab === tab.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                onClick={() => setOrderTab(tab.value)}
              >
                {tab.label}
                {tab.value !== "all" && orders && (
                  <span className="ml-1 opacity-60">
                    {orders.items.filter(o => o.status === tab.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : filteredOrders.length > 0 ? (
            <div className="space-y-3">
              {filteredOrders.map((order) => <OrderRow key={order.id} order={order} />)}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="font-medium text-foreground mb-1">
                {orderTab === "all" ? "Заявок пока нет" : `Нет заявок со статусом «${ORDER_FILTER_TABS.find(t => t.value === orderTab)?.label}»`}
              </h3>
              {orderTab === "all" && (
                <>
                  <p className="text-sm mb-4">Разместите заявку и получите отклики от инженеров</p>
                  <Button onClick={() => setLocation("/orders/create")} data-testid="button-create-first-order">Разместить заявку</Button>
                </>
              )}
            </div>
          )}
        </TabsContent>

        {/* Chats */}
        <TabsContent value="chats">
          {chats && chats.length > 0 ? (
            <div className="space-y-2 max-w-2xl">
              {chats.map((chat) => (
                <Card
                  key={chat.id}
                  className="cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => setLocation(`/chat/${chat.id}`)}
                  data-testid={`card-chat-${chat.id}`}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar className="w-11 h-11 flex-shrink-0">
                      {chat.engineer.user.avatarUrl && <AvatarImage src={chat.engineer.user.avatarUrl} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {chat.engineer.user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{chat.engineer.user.name}</p>
                        {chat.lastMessageAt && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {new Date(chat.lastMessageAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMessage ?? "Нет сообщений"}</p>
                    </div>
                    {(chat.unreadCount ?? 0) > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center flex-shrink-0">
                        {chat.unreadCount}
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <h3 className="font-medium text-foreground mb-1">Чатов пока нет</h3>
              <p className="text-sm">Примите отклик инженера, и чат откроется автоматически</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
