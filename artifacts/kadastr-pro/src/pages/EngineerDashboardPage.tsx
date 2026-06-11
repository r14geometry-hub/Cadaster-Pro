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
  useGetMyLeads, getGetMyLeadsQueryKey,
  useGetMyBalance, getGetMyBalanceQueryKey,
  useGetSettings, getGetSettingsQueryKey,
  useGetMyNotifications, getGetMyNotificationsQueryKey,
  useMarkNotificationsRead,
  useListRegions,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ClipboardList, MessageSquare, ShieldCheck, CheckCircle2, Sparkles, AlertTriangle, Wallet, Bell, Phone, Mail,
  MapPin, Plus, Trash2, Globe,
} from "lucide-react";

const REGIONS = ["Москва", "Санкт-Петербург", "Московская область", "Краснодарский край", "Татарстан", "Свердловская область", "Новосибирская область", "Другой"];
const SPECIALIZATIONS = ["Межевание", "Техплан", "Кадастровый паспорт", "Постановка на учёт", "Снятие с учёта", "Оценка"];

const DEFAULT_DEBT_LIMIT = 3000;

const bidSchema = z.object({
  message: z.string().min(10, "Минимум 10 символов"),
  price: z.string().optional(),
  proposedDeadline: z.string().optional(),
});
const profileSchema = z.object({
  region: z.string().min(1, "Выберите регион"),
  experience: z.string(),
  bio: z.string().optional(),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  whatsapp: z.string().optional(),
  district: z.string().optional(),
  sro: z.string().optional(),
});

const BID_STATUS: Record<string, { label: string; className: string }> = {
  pending:  { label: "Ожидает",   className: "bg-blue-50 text-blue-700 border-blue-200" },
  accepted: { label: "Принят",    className: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "Отклонён",  className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const LEAD_STATUS: Record<string, { label: string; className: string }> = {
  unpaid: { label: "Не оплачен", className: "bg-red-50 text-red-700 border-red-200" },
  paid:   { label: "Оплачен",   className: "bg-green-50 text-green-700 border-green-200" },
};

export default function EngineerDashboardPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [biddingOrderId, setBiddingOrderId] = useState<number | null>(null);
  const [registryNumber, setRegistryNumber] = useState("");
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);

  interface ServiceArea { region: string; districts: string[]; localities: string[]; }
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [newAreaRegion, setNewAreaRegion] = useState("");
  const [newAreaDistrict, setNewAreaDistrict] = useState("");
  const [newAreaLocality, setNewAreaLocality] = useState("");

  const { data: profile, isLoading: profileLoading } = useGetMyEngineerProfile({
    query: { enabled: !!user, queryKey: getGetMyEngineerProfileQueryKey() },
  });

  const { data: rfRegions } = useListRegions();

  const { data: openOrders, isLoading: ordersLoading } = useListOrders(
    { limit: 100, ...(profile?.id ? { forEngineer: profile.id } : {}) },
    { query: { enabled: !!user, queryKey: getListOrdersQueryKey({ limit: 100, ...(profile?.id ? { forEngineer: profile.id } : {}) }) } }
  );

  const { data: myBids, isLoading: bidsLoading } = useListEngineerBids(
    profile?.id ?? 0,
    { query: { enabled: !!profile, queryKey: getListEngineerBidsQueryKey(profile?.id ?? 0) } }
  );

  const { data: chats } = useListChats({ query: { enabled: !!user, queryKey: getListChatsQueryKey() } });
  const totalUnread = chats?.reduce((s, c) => s + (c.unreadCount ?? 0), 0) ?? 0;

  const { data: leadsData } = useGetMyLeads(
    {},
    { query: { enabled: !!user, queryKey: getGetMyLeadsQueryKey({}) } }
  );

  const { data: balanceData } = useGetMyBalance({
    query: { enabled: !!user, queryKey: getGetMyBalanceQueryKey() },
  });

  const { data: platformSettings } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() },
  });
  const debtLimit = parseInt(platformSettings?.debt_limit ?? "") || DEFAULT_DEBT_LIMIT;

  const { data: notifications } = useGetMyNotifications({
    query: { enabled: !!user, queryKey: getGetMyNotificationsQueryKey() },
  });
  const unreadNotifications = notifications?.filter(n => !n.isRead).length ?? 0;

  const markAllRead = useMarkNotificationsRead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyNotificationsQueryKey() });
      },
    },
  });

  const leads = leadsData?.items ?? [];
  const totalAccrued = balanceData?.totalAccrued ?? 0;
  const totalPaid = balanceData?.totalPaid ?? 0;
  const currentDebt = balanceData?.debtAmount ?? profile?.debtAmount ?? 0;
  const debtBlocked = currentDebt >= debtLimit;
  const debtWarning = currentDebt >= debtLimit * 0.8;

  const bidForm = useForm({
    resolver: zodResolver(bidSchema),
    defaultValues: { message: "", price: "", proposedDeadline: "" },
  });
  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      region: profile?.region ?? "",
      experience: String(profile?.experience ?? 0),
      bio: profile?.bio ?? "",
      phone: profile?.user?.phone ?? "",
      telegram: (profile?.user as unknown as { telegram?: string | null })?.telegram ?? "",
      whatsapp: (profile?.user as unknown as { whatsapp?: string | null })?.whatsapp ?? "",
      district: (profile as unknown as { district?: string | null })?.district ?? "",
      sro: (profile as unknown as { sro?: string | null })?.sro ?? "",
    },
  });

  // Initialise serviceAreas from profile (once profile loads)
  const profileServiceAreas = (profile as unknown as { serviceAreas?: ServiceArea[] })?.serviceAreas ?? [];
  const effectiveAreas = serviceAreas.length > 0 || profileServiceAreas.length === 0 ? serviceAreas : profileServiceAreas;

  function addServiceArea() {
    if (!newAreaRegion) return;
    const existing = effectiveAreas.find(a => a.region === newAreaRegion && !newAreaDistrict && !newAreaLocality);
    if (existing) return;
    const entry: ServiceArea = {
      region: newAreaRegion,
      districts: newAreaDistrict ? [newAreaDistrict] : [],
      localities: newAreaLocality ? [newAreaLocality] : [],
    };
    setServiceAreas([...effectiveAreas, entry]);
    setNewAreaRegion(""); setNewAreaDistrict(""); setNewAreaLocality("");
  }

  function removeServiceArea(idx: number) {
    setServiceAreas(effectiveAreas.filter((_, i) => i !== idx));
  }

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
        if (result.isValid) {
          if (result.preFilledSro) profileForm.setValue("sro", result.preFilledSro);
          if (result.preFilledDistrict) profileForm.setValue("district", result.preFilledDistrict);
        }
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
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-3xl font-bold text-foreground" data-testid="heading-engineer-dashboard">Кабинет инженера</h1>
          {profile?.isPro && (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2.5 py-1">
              <Sparkles className="w-3.5 h-3.5" /> PRO
            </span>
          )}
        </div>
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

      {/* Debt warning banner */}
      {debtBlocked && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">Подача откликов заблокирована</p>
            <p className="text-sm text-red-600 mt-0.5">Погасите задолженность перед платформой для продолжения. Текущий долг: <strong>{currentDebt.toLocaleString("ru-RU")} ₽</strong></p>
          </div>
        </div>
      )}
      {!debtBlocked && debtWarning && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700">Задолженность приближается к лимиту</p>
            <p className="text-sm text-amber-600 mt-0.5">Текущий долг: <strong>{currentDebt.toLocaleString("ru-RU")} ₽</strong> из {debtLimit.toLocaleString("ru-RU")} ₽</p>
          </div>
        </div>
      )}

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
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="orders" data-testid="tab-available-orders">Заявки</TabsTrigger>
          <TabsTrigger value="bids" data-testid="tab-my-bids">Мои отклики</TabsTrigger>
          <TabsTrigger value="balance" data-testid="tab-balance">
            Баланс
            {currentDebt > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                {currentDebt.toLocaleString("ru-RU")}₽
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile">Профиль</TabsTrigger>
          <TabsTrigger value="chats" data-testid="tab-chats" className="relative">
            Чаты
            {totalUnread > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                {totalUnread}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications" onClick={() => { if (unreadNotifications > 0) markAllRead.mutate(); }}>
            Уведомления
            {unreadNotifications > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                {unreadNotifications}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Available Orders */}
        <TabsContent value="orders">
          <h2 className="text-lg font-semibold mb-4">Доступные заявки</h2>
          {debtBlocked && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
              Подача откликов заблокирована из-за задолженности. Погасите долг для продолжения.
            </div>
          )}
          {ordersLoading ? (
            <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}</div>
          ) : openOrders && openOrders.items.filter(o => ["new", "open", "collecting_responses"].includes(o.status)).length > 0 ? (
            <div className="space-y-4">
              {openOrders.items.filter(o => ["new", "open", "collecting_responses"].includes(o.status)).map((order) => (
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
                            <Input type="number" placeholder="15000" {...bidForm.register("price")} data-testid="input-bid-price" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Предложенный срок</label>
                            <Input placeholder="например: 2 недели" {...bidForm.register("proposedDeadline")} data-testid="input-bid-deadline" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={createBid.isPending || debtBlocked} data-testid="button-submit-bid">
                            {createBid.isPending ? "Отправляем..." : "Отправить отклик"}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => { setBiddingOrderId(null); bidForm.reset(); }}>Отмена</Button>
                        </div>
                      </form>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setBiddingOrderId(order.id)}
                        disabled={debtBlocked}
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
                      {bid.status === "accepted" && (
                        <div className="mt-3 pt-3 border-t border-green-200 space-y-1.5">
                          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Контакты заказчика</p>
                          {bid.order.customer.phone && (
                            <a
                              href={`tel:${bid.order.customer.phone}`}
                              className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                              data-testid={`text-customer-phone-${bid.id}`}
                            >
                              <Phone className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                              {bid.order.customer.phone}
                            </a>
                          )}
                          {bid.order.customer.email && (
                            <a
                              href={`mailto:${bid.order.customer.email}`}
                              className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                              data-testid={`text-customer-email-${bid.id}`}
                            >
                              <Mail className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                              {bid.order.customer.email}
                            </a>
                          )}
                        </div>
                      )}
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

        {/* Balance */}
        <TabsContent value="balance">
          <h2 className="text-lg font-semibold mb-4">Баланс и история лидов</h2>

          {/* Balance summary cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{totalAccrued.toLocaleString("ru-RU")} ₽</p>
                    <p className="text-xs text-muted-foreground">Всего начислено</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{totalPaid.toLocaleString("ru-RU")} ₽</p>
                    <p className="text-xs text-muted-foreground">Оплачено</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={debtBlocked ? "border-red-300 bg-red-50" : debtWarning ? "border-amber-300 bg-amber-50" : ""}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${debtBlocked ? "bg-red-100" : debtWarning ? "bg-amber-100" : "bg-gray-50"}`}>
                    <AlertTriangle className={`w-5 h-5 ${debtBlocked ? "text-red-600" : debtWarning ? "text-amber-600" : "text-gray-400"}`} />
                  </div>
                  <div>
                    <p className={`text-xl font-bold ${debtBlocked ? "text-red-700" : debtWarning ? "text-amber-700" : ""}`}>
                      {currentDebt.toLocaleString("ru-RU")} ₽
                    </p>
                    <p className="text-xs text-muted-foreground">Текущий долг / {debtLimit.toLocaleString("ru-RU")} ₽ лимит</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lead history */}
          {leads.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="text-base">История лидов</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {leads.map((lead) => {
                    const status = LEAD_STATUS[lead.paymentStatus] ?? LEAD_STATUS.unpaid;
                    return (
                      <div key={lead.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{lead.serviceType}</p>
                          <p className="text-xs text-muted-foreground">Заявка #{lead.orderId} · {new Date(lead.createdAt).toLocaleDateString("ru-RU")}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm">{lead.leadCost.toLocaleString("ru-RU")} ₽</span>
                          <Badge variant="outline" className={`text-xs ${status.className}`}>{status.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Лидов пока нет</p>
              <p className="text-sm mt-1">Они появятся, когда заказчик примет ваш отклик</p>
            </div>
          )}
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile">
          {profileLoading ? <Skeleton className="h-64 rounded-xl" /> : profile ? (
            <div className="max-w-xl space-y-6">
              {/* Verification */}
              <Card>
                <CardHeader><CardTitle className="text-base">Верификация по реестру Росреестра</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {profile.isVerified ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-600">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="font-medium">Верифицирован: {(profile as unknown as { attestatNumber?: string }).attestatNumber ?? profile.registryNumber}</span>
                      </div>
                      {(profile as unknown as { sroName?: string }).sroName && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
                          <p className="font-medium mb-1">СРО: {(profile as unknown as { sroName?: string }).sroName}</p>
                          <p className="text-xs leading-relaxed">
                            Кадастровый инженер состоит в действующем СРО. Ответственность инженера обеспечена компенсационным фондом саморегулируемой организации.
                          </p>
                        </div>
                      )}
                      {(profile as unknown as { rosreestrWorksCount?: number }).rosreestrWorksCount != null && (
                        <div className="text-xs text-muted-foreground">
                          Работ в реестре: <span className="font-semibold text-foreground">{(profile as unknown as { rosreestrWorksCount?: number }).rosreestrWorksCount}</span> ·
                          Отказов: <span className="font-semibold text-foreground">{(profile as unknown as { rosreestrRejectionsCount?: number }).rosreestrRejectionsCount ?? 0}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Введите номер аттестата кадастрового инженера для проверки по реестру Росреестра.
                        Регистрация возможна только для инженеров с действующим аттестатом и членством в СРО.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Номер аттестата (напр. 77-13-2023001)"
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
                      <p className="text-xs text-muted-foreground">
                        Тестовые номера: 77-13-2023001, 78-05-2022015, 50-11-2021044
                      </p>
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
                  {/* Territory / Service Areas editor */}
                  <div className="mb-6 border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-primary" />
                      <p className="text-sm font-semibold">Территория деятельности</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Заявки из выбранных территорий будут отображаться в разделе «Заявки». Если список пуст — показываются все заявки.
                    </p>
                    {effectiveAreas.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {effectiveAreas.map((area, i) => (
                          <div key={i} className="flex items-center justify-between bg-background border rounded-md px-3 py-2 text-sm">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate">{area.region}</span>
                              {area.districts.length > 0 && (
                                <span className="text-muted-foreground truncate">› {area.districts.join(", ")}</span>
                              )}
                              {area.localities.length > 0 && (
                                <span className="text-muted-foreground truncate">› {area.localities.join(", ")}</span>
                              )}
                              {area.districts.length === 0 && area.localities.length === 0 && (
                                <span className="text-xs text-green-600">(весь регион)</span>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                              onClick={() => removeServiceArea(i)}
                              data-testid={`button-remove-area-${i}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Select value={newAreaRegion} onValueChange={setNewAreaRegion}>
                        <SelectTrigger className="h-8 text-sm" data-testid="select-new-area-region">
                          <SelectValue placeholder="Субъект РФ *" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {(rfRegions ?? []).filter(r => r.status === "active").map(r => (
                            <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newAreaRegion && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={newAreaDistrict}
                            onChange={(e) => setNewAreaDistrict(e.target.value)}
                            placeholder="Район / улус (необяз.)"
                            className="h-8 text-sm"
                            data-testid="input-new-area-district"
                          />
                          <Input
                            value={newAreaLocality}
                            onChange={(e) => setNewAreaLocality(e.target.value)}
                            placeholder="Нас. пункт (необяз.)"
                            className="h-8 text-sm"
                            data-testid="input-new-area-locality"
                          />
                        </div>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8"
                        onClick={addServiceArea}
                        disabled={!newAreaRegion}
                        data-testid="button-add-service-area"
                      >
                        <Plus className="w-3.5 h-3.5" /> Добавить территорию
                      </Button>
                    </div>
                  </div>

                  <form
                    onSubmit={profileForm.handleSubmit((v) => updateProfile.mutate({
                      data: {
                        region: v.region,
                        experience: parseInt(v.experience),
                        bio: v.bio,
                        specializations: selectedSpecs.length > 0 ? selectedSpecs : profile.specializations,
                        phone: v.phone || undefined,
                        telegram: v.telegram || undefined,
                        whatsapp: v.whatsapp || undefined,
                        district: v.district || undefined,
                        sro: v.sro || undefined,
                        serviceAreas: effectiveAreas,
                      } as Parameters<typeof updateProfile.mutate>[0]["data"],
                    }))}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-sm font-medium mb-1 block">Основной регион (для профиля)</label>
                      <Select onValueChange={(v) => profileForm.setValue("region", v)} defaultValue={profile.region}>
                        <SelectTrigger data-testid="select-profile-region"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-72">
                          {(rfRegions ?? []).map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Федеральный округ</label>
                      <Input {...profileForm.register("district")} placeholder="Например: Центральный" data-testid="input-district" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">СРО (саморегулируемая организация)</label>
                      <Input {...profileForm.register("sro")} placeholder="Например: СРО А «Кадастровые инженеры»" data-testid="input-sro" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Опыт работы (лет)</label>
                      <Input type="number" {...profileForm.register("experience")} data-testid="input-experience" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">О себе</label>
                      <Textarea {...profileForm.register("bio")} rows={4} placeholder="Расскажите о своём опыте..." data-testid="input-bio" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Телефон</label>
                      <Input {...profileForm.register("phone")} placeholder="+7 (999) 123-45-67" data-testid="input-phone" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Telegram</label>
                      <Input {...profileForm.register("telegram")} placeholder="@username" data-testid="input-telegram" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">WhatsApp</label>
                      <Input {...profileForm.register("whatsapp")} placeholder="+7 (999) 123-45-67" data-testid="input-whatsapp" />
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

        {/* Notifications */}
        <TabsContent value="notifications">
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Уведомления</h2>
              {unreadNotifications > 0 && (
                <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
                  Отметить все прочитанными
                </Button>
              )}
            </div>
            {!notifications || notifications.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Уведомлений нет</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <Card key={n.id} className={n.isRead ? "opacity-70" : "ring-1 ring-orange-200"}>
                    <CardContent className="p-4 flex gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        n.type === "error" ? "bg-red-500" :
                        n.type === "warning" ? "bg-amber-500" :
                        "bg-blue-500"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`font-medium text-sm ${n.type === "error" ? "text-red-700" : n.type === "warning" ? "text-amber-700" : "text-foreground"}`}>
                            {n.title}
                          </p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {new Date(n.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
