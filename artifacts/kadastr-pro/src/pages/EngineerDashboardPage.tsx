import { useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import StarRating from "@/components/StarRating";
import OrderCard from "@/components/OrderCard";
import {
  useListOrders, getListOrdersQueryKey,
  useListEngineerBids, getListEngineerBidsQueryKey,
  useGetMyEngineerProfile, getGetMyEngineerProfileQueryKey,
  useCreateBid,
  useUpdateMyEngineerProfile,
  useVerifyEngineer,
  useListChats, getListChatsQueryKey,
  useCreateChatRoom,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ClipboardList, MessageSquare, ShieldCheck, CheckCircle2, ChevronRight,
} from "lucide-react";

const REGIONS = ["Москва", "Санкт-Петербург", "Московская область", "Краснодарский край", "Татарстан", "Свердловская область", "Новосибирская область", "Другой"];
const SPECIALIZATIONS = ["Межевание", "Техплан", "Кадастровый паспорт", "Постановка на учёт", "Снятие с учёта", "Оценка"];

const bidSchema = z.object({
  message: z.string().min(10, "Минимум 10 символов"),
  price: z.string().optional(),
  proposedDeadline: z.string().optional(),
});
const profileSchema = z.object({
  region: z.string().min(1, "Выберите регион"),
  experience: z.string(),
  bio: z.string().optional(),
});

const BID_STATUS: Record<string, { label: string; className: string }> = {
  pending:  { label: "Ожидает",   className: "bg-blue-50 text-blue-700 border-blue-200" },
  accepted: { label: "Принят",    className: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "Отклонён",  className: "bg-gray-100 text-gray-500 border-gray-200" },
};

export default function EngineerDashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [biddingOrderId, setBiddingOrderId] = useState<number | null>(null);
  const [registryNumber, setRegistryNumber] = useState("");
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);

  const { data: profile, isLoading: profileLoading } = useGetMyEngineerProfile({
    query: { enabled: !!user, queryKey: getGetMyEngineerProfileQueryKey() },
  });

  const { data: openOrders, isLoading: ordersLoading } = useListOrders(
    { status: "open" },
    { query: { enabled: !!user, queryKey: getListOrdersQueryKey({ status: "open" }) } }
  );

  const { data: myBids, isLoading: bidsLoading } = useListEngineerBids(
    profile?.id ?? 0,
    { query: { enabled: !!profile, queryKey: getListEngineerBidsQueryKey(profile?.id ?? 0) } }
  );

  const { data: chats } = useListChats({ query: { enabled: !!user, queryKey: getListChatsQueryKey() } });
  const totalUnread = chats?.reduce((s, c) => s + (c.unreadCount ?? 0), 0) ?? 0;

  const bidForm = useForm({
    resolver: zodResolver(bidSchema),
    defaultValues: { message: "", price: "", proposedDeadline: "" },
  });
  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { region: profile?.region ?? "", experience: String(profile?.experience ?? 0), bio: profile?.bio ?? "" },
  });

  const createBid = useCreateBid({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEngineerBidsQueryKey(profile?.id ?? 0) });
        setBiddingOrderId(null);
        bidForm.reset();
        toast({ title: "Отклик отправлен" });
      },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast({ title: "Ошибка", description: msg ?? "Не удалось отправить отклик", variant: "destructive" });
      },
    },
  });

  const updateProfile = useUpdateMyEngineerProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyEngineerProfileQueryKey() });
        toast({ title: "Профиль обновлён" });
      },
    },
  });

  const verifyMutation = useVerifyEngineer({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetMyEngineerProfileQueryKey() });
        toast({ title: result.isValid ? "Верификация пройдена" : "Номер не найден", description: result.message });
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

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-4">Войдите, чтобы увидеть кабинет</h2>
        <Button onClick={() => setLocation("/auth/login")}>Войти</Button>
      </div>
    );
  }

  const toggleSpec = (spec: string) => {
    setSelectedSpecs(prev => prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]);
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1" data-testid="heading-engineer-dashboard">Кабинет инженера</h1>
        <p className="text-muted-foreground">
          {profile?.isVerified ? (
            <span className="flex items-center gap-1.5 text-green-600">
              <ShieldCheck className="w-4 h-4" /> Верификация пройдена
            </span>
          ) : (
            <span>Добро пожаловать, {user.name}</span>
          )}
        </p>
      </div>

      {/* Stats row */}
      {profile && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Рейтинг",     value: profile.rating.toFixed(1) },
            { label: "Отзывов",     value: profile.reviewCount },
            { label: "Откликов",    value: myBids?.length ?? "—" },
            { label: "Непрочитано", value: totalUnread },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="orders">
        <TabsList className="mb-6">
          <TabsTrigger value="orders" data-testid="tab-available-orders">Заявки</TabsTrigger>
          <TabsTrigger value="bids" data-testid="tab-my-bids">Мои отклики</TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile">Профиль</TabsTrigger>
          <TabsTrigger value="chats" data-testid="tab-chats" className="relative">
            Чаты
            {totalUnread > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                {totalUnread}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Available Orders */}
        <TabsContent value="orders">
          <h2 className="text-lg font-semibold mb-4">Доступные заявки</h2>
          {ordersLoading ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}</div>
          ) : openOrders && openOrders.items.length > 0 ? (
            <div className="space-y-4">
              {openOrders.items.map((order) => (
                <div key={order.id}>
                  <OrderCard order={order} showLink={false} />
                  <div className="mt-2 px-1">
                    {biddingOrderId === order.id ? (
                      <form
                        onSubmit={bidForm.handleSubmit((v) =>
                          createBid.mutate({
                            orderId: order.id,
                            data: {
                              message: v.message,
                              price: v.price ? parseFloat(v.price) : undefined,
                              proposedDeadline: v.proposedDeadline || undefined,
                            },
                          })
                        )}
                        className="border rounded-xl p-4 bg-gray-50 space-y-3"
                      >
                        <p className="text-sm font-medium">Ваш отклик на заявку</p>
                        <Textarea
                          placeholder="Опишите свой подход, опыт выполнения похожих работ..."
                          {...bidForm.register("message")}
                          data-testid="input-bid-message"
                          rows={3}
                        />
                        {bidForm.formState.errors.message && (
                          <p className="text-xs text-destructive">{bidForm.formState.errors.message.message}</p>
                        )}
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Стоимость работ (₽)</label>
                            <Input
                              type="number"
                              placeholder="15000"
                              {...bidForm.register("price")}
                              data-testid="input-bid-price"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Предложенный срок</label>
                            <Input
                              placeholder="например: 2 недели"
                              {...bidForm.register("proposedDeadline")}
                              data-testid="input-bid-deadline"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={createBid.isPending} data-testid="button-submit-bid">
                            {createBid.isPending ? "Отправляем..." : "Отправить отклик"}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => { setBiddingOrderId(null); bidForm.reset(); }}>
                            Отмена
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBiddingOrderId(order.id)}
                        data-testid={`button-bid-${order.id}`}
                      >
                        Откликнуться
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Открытых заявок пока нет</p>
            </div>
          )}
        </TabsContent>

        {/* My Bids */}
        <TabsContent value="bids">
          <h2 className="text-lg font-semibold mb-4">Мои отклики</h2>
          {bidsLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
          ) : myBids && myBids.length > 0 ? (
            <div className="space-y-3">
              {myBids.map((bid) => {
                const bidStatus = BID_STATUS[bid.status] ?? BID_STATUS.pending;
                return (
                  <Card key={bid.id} data-testid={`card-my-bid-${bid.id}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm" data-testid={`text-bid-order-${bid.id}`}>{bid.order.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{bid.order.region} · {bid.order.serviceType}</p>
                        </div>
                        <Badge variant="outline" className={bidStatus.className} data-testid={`status-my-bid-${bid.id}`}>
                          {bidStatus.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{bid.message}</p>
                      <div className="flex items-center gap-4 text-sm">
                        {bid.price && <span className="font-semibold text-primary">{bid.price.toLocaleString("ru-RU")} ₽</span>}
                        {bid.proposedDeadline && <span className="text-muted-foreground">Срок: {bid.proposedDeadline}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-muted-foreground">{new Date(bid.createdAt).toLocaleDateString("ru-RU")}</p>
                        {bid.status === "accepted" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-7 text-xs"
                            onClick={() => createChat.mutate({ data: { engineerId: profile?.id ?? bid.engineerId, orderId: bid.orderId } })}
                            data-testid={`button-open-chat-bid-${bid.id}`}
                          >
                            <MessageSquare className="w-3 h-3" /> Открыть чат
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Откликов пока нет</p>
            </div>
          )}
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile">
          {profileLoading ? <Skeleton className="h-64 rounded-xl" /> : profile ? (
            <div className="max-w-xl space-y-6">
              {/* Verification */}
              <Card>
                <CardHeader><CardTitle className="text-base">Верификация по реестру</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {profile.isVerified ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <ShieldCheck className="w-5 h-5" />
                      <span className="font-medium">Верифицирован: {profile.registryNumber}</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">Введите номер реестра для подтверждения статуса</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Номер реестра (напр. 77-13-01)"
                          value={registryNumber}
                          onChange={(e) => setRegistryNumber(e.target.value)}
                          data-testid="input-registry-number"
                        />
                        <Button
                          onClick={() => verifyMutation.mutate({ data: { registryNumber } })}
                          disabled={verifyMutation.isPending || !registryNumber}
                          data-testid="button-verify"
                        >
                          Проверить
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Profile Edit */}
              <Card>
                <CardHeader><CardTitle className="text-base">Данные профиля</CardTitle></CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Специализации</p>
                    <div className="flex flex-wrap gap-2">
                      {SPECIALIZATIONS.map((s) => {
                        const active = (profile.specializations ?? []).includes(s) || selectedSpecs.includes(s);
                        return (
                          <Badge
                            key={s}
                            variant={active ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => toggleSpec(s)}
                            data-testid={`badge-spec-toggle-${s}`}
                          >
                            {s}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  <form
                    onSubmit={profileForm.handleSubmit((v) => updateProfile.mutate({
                      data: {
                        region: v.region,
                        experience: parseInt(v.experience),
                        bio: v.bio,
                        specializations: selectedSpecs.length > 0 ? selectedSpecs : profile.specializations,
                      },
                    }))}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-sm font-medium mb-1 block">Регион</label>
                      <Select onValueChange={(v) => profileForm.setValue("region", v)} defaultValue={profile.region}>
                        <SelectTrigger data-testid="select-profile-region"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Опыт работы (лет)</label>
                      <Input type="number" {...profileForm.register("experience")} data-testid="input-experience" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">О себе</label>
                      <Textarea {...profileForm.register("bio")} rows={4} placeholder="Расскажите о своём опыте..." data-testid="input-bio" />
                    </div>
                    <Button type="submit" disabled={updateProfile.isPending} data-testid="button-save-profile">
                      {updateProfile.isPending ? "Сохраняем..." : "Сохранить профиль"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          ) : null}
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
                      {chat.customer.avatarUrl && <AvatarImage src={chat.customer.avatarUrl} />}
                      <AvatarFallback className="bg-muted text-sm font-semibold">
                        {chat.customer.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{chat.customer.name}</p>
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
              <p>Чатов пока нет</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
