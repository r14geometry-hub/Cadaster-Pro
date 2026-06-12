import { useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useGetAdminStats, getGetAdminStatsQueryKey,
  useListAdminUsers, getListAdminUsersQueryKey,
  useListAdminOrders, getListAdminOrdersQueryKey,
  useUpdateAdminUser,
  useGetAdminLeadPrices, getGetAdminLeadPricesQueryKey,
  useUpdateAdminLeadPrices,
  useListAdminLeads, getListAdminLeadsQueryKey,
  useUpdateAdminLead,
  useGetAdminLeadsSummary, getGetAdminLeadsSummaryQueryKey,
  useListAdminEngineers, getListAdminEngineersQueryKey,
  useUpdateAdminEngineer,
  useSetEngineerVisibility,
  useDeleteAdminEngineer,
  useListAdminReviews, getListAdminReviewsQueryKey,
  useModerateReview,
  useSetUserRole,
  useGetAdminSettings, getGetAdminSettingsQueryKey,
  useUpdateAdminSettings,
  useListAdminVerificationLogs, getListAdminVerificationLogsQueryKey,
  useReverifyEngineer,
  useListAdminComplaints, getListAdminComplaintsQueryKey,
  useResolveComplaint,
  useListAdminRegions, getListAdminRegionsQueryKey,
  useUpdateAdminRegion,
  useListAdminPaymentRequisites, getListAdminPaymentRequisitesQueryKey,
  useCreateAdminPaymentRequisite,
  useUpdateAdminPaymentRequisite,
  useActivateAdminPaymentRequisite,
  useArchiveAdminPaymentRequisite,
  useGetAdminPaymentRequisiteLog,
  type PaymentRequisiteAdmin,
  type PaymentRequisiteCreate,
  type PaymentRequisiteUpdate,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Users, ClipboardList, Shield, Sparkles, Wallet, AlertTriangle, ShieldCheck,
  RefreshCw, MessageSquare, Eye, EyeOff, Trash2, Star, CheckCircle2, TrendingDown, Clock, MapPin,
  CreditCard, Plus, Archive, ChevronDown, ChevronUp, Pencil, History,
} from "lucide-react";


const ALL_ROLES = ["customer", "engineer", "admin", "superadmin"];
const ROLE_LABELS: Record<string, string> = {
  customer: "Заказчик",
  engineer: "Инженер",
  admin: "Администратор",
  superadmin: "Суперадмин",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  new:                  { label: "Новая",             className: "bg-blue-50 text-blue-700" },
  open:                 { label: "Открыта",           className: "bg-blue-50 text-blue-700" },
  collecting_responses: { label: "Сбор откликов",     className: "bg-indigo-50 text-indigo-700" },
  engineer_selected:    { label: "Инженер выбран",    className: "bg-teal-50 text-teal-700" },
  in_progress:          { label: "В работе",          className: "bg-yellow-50 text-yellow-700" },
  completed:            { label: "Завершена",          className: "bg-green-50 text-green-700" },
  cancelled:            { label: "Отменена",           className: "bg-gray-100 text-gray-600" },
  draft:                { label: "Черновик",           className: "bg-gray-50 text-gray-500" },
};

const MODERATION_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: "На модерации", className: "bg-amber-50 text-amber-700 border-amber-200" },
  published: { label: "Опубликован",  className: "bg-green-50 text-green-700 border-green-200" },
  hidden:    { label: "Скрыт",        className: "bg-gray-100 text-gray-500 border-gray-200" },
};

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
  const [editingSettings, setEditingSettings] = useState<Record<string, string>>({});
  const [reviewFilter, setReviewFilter] = useState<string>("pending");

  const isSuperAdmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || isSuperAdmin;

  const { data: stats, isLoading: statsLoading } = useGetAdminStats({
    query: { enabled: isAdmin, queryKey: getGetAdminStatsQueryKey() },
  });

  const { data: users, isLoading: usersLoading } = useListAdminUsers(
    {},
    { query: { enabled: isAdmin, queryKey: getListAdminUsersQueryKey({}) } }
  );

  const { data: orders, isLoading: ordersLoading } = useListAdminOrders(
    {},
    { query: { enabled: isAdmin, queryKey: getListAdminOrdersQueryKey({}) } }
  );

  const { data: leadPrices, isLoading: leadPricesLoading } = useGetAdminLeadPrices({
    query: { enabled: isAdmin, queryKey: getGetAdminLeadPricesQueryKey() },
  });

  const { data: leadsData, isLoading: leadsLoading } = useListAdminLeads(
    {},
    { query: { enabled: isAdmin, queryKey: getListAdminLeadsQueryKey({}) } }
  );

  const { data: debtSummary, isLoading: debtSummaryLoading } = useGetAdminLeadsSummary({
    query: { enabled: isAdmin, queryKey: getGetAdminLeadsSummaryQueryKey() },
  });

  const { data: adminEngineers, isLoading: engineersLoading } = useListAdminEngineers(
    {},
    { query: { enabled: isAdmin, queryKey: getListAdminEngineersQueryKey({}) } }
  );

  const { data: adminReviews, isLoading: reviewsLoading } = useListAdminReviews(
    { moderationStatus: reviewFilter || undefined },
    { query: { enabled: isAdmin, queryKey: getListAdminReviewsQueryKey({ moderationStatus: reviewFilter || undefined }) } }
  );

  const { data: verificationLogs, isLoading: logsLoading } = useListAdminVerificationLogs(
    {},
    { query: { enabled: isAdmin, queryKey: getListAdminVerificationLogsQueryKey({}) } }
  );

  const { data: complaintsData, isLoading: complaintsLoading } = useListAdminComplaints(
    {},
    { query: { enabled: isAdmin, queryKey: getListAdminComplaintsQueryKey({}) } }
  );

  const updateUser = useUpdateAdminUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey({}) });
        toast({ title: "Пользователь обновлён" });
      },
    },
  });

  const setUserRole = useSetUserRole({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey({}) });
        toast({ title: "Роль изменена" });
      },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    },
  });

  const updateLeadPrices = useUpdateAdminLeadPrices({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAdminLeadPricesQueryKey() });
        setEditingPrices({});
        toast({ title: "Цены лидов обновлены" });
      },
    },
  });

  const updateLead = useUpdateAdminLead({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminLeadsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getGetAdminLeadsSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAdminEngineersQueryKey({}) });
        toast({ title: "Лид обновлён" });
      },
    },
  });

  const updateEngineer = useUpdateAdminEngineer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminEngineersQueryKey({}) });
        toast({ title: "Инженер обновлён" });
      },
    },
  });

  const setVisibility = useSetEngineerVisibility({
    mutation: {
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: getListAdminEngineersQueryKey({}) });
        toast({ title: vars.data.isHidden ? "Профиль скрыт" : "Профиль показан" });
      },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    },
  });

  const deleteEngineer = useDeleteAdminEngineer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminEngineersQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast({ title: "Инженер удалён" });
      },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    },
  });

  const moderateReview = useModerateReview({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminReviewsQueryKey({ moderationStatus: reviewFilter || undefined }) });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        toast({ title: "Статус отзыва изменён" });
      },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    },
  });

  const resolveComplaint = useResolveComplaint({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminComplaintsQueryKey({}) });
        toast({ title: "Жалоба закрыта" });
      },
      onError: () => toast({ title: "Ошибка", variant: "destructive" }),
    },
  });

  const reverify = useReverifyEngineer({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListAdminVerificationLogsQueryKey({}) });
        toast({
          title: result.isValid ? "Верификация пройдена" : "Верификация не пройдена",
          description: result.message,
          variant: result.isValid ? "default" : "destructive",
        });
      },
      onError: () => toast({ title: "Ошибка", description: "Не удалось повторить проверку", variant: "destructive" }),
    },
  });

  const { data: adminSettings } = useGetAdminSettings({
    query: { enabled: isAdmin, queryKey: getGetAdminSettingsQueryKey() },
  });
  const debtLimit = parseInt(adminSettings?.["debt_limit"] ?? "3000") || 3000;

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold mb-2">Доступ запрещён</h2>
        <p className="text-muted-foreground mb-4">Эта страница доступна только администраторам</p>
        <Button onClick={() => setLocation("/")} variant="outline">На главную</Button>
      </div>
    );
  }

  const handleSavePrices = () => {
    if (!leadPrices) return;
    const prices = leadPrices.map(p => ({
      serviceType: p.serviceType,
      price: editingPrices[p.serviceType] ?? p.price,
    }));
    updateLeadPrices.mutate({ data: { prices } });
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1" data-testid="heading-admin">Панель управления</h1>
        <p className="text-muted-foreground">
          КадастрПро Administration{isSuperAdmin && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Суперадмин</span>}
        </p>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Пользователей", value: stats.totalUsers, icon: Users, color: "text-blue-600", bg: "bg-blue-50", alert: false },
            { label: "Инженеров", value: stats.totalEngineers, icon: Shield, color: "text-green-600", bg: "bg-green-50", alert: false },
            { label: "Верифицировано", value: stats.verifiedEngineers, icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50", alert: false },
            { label: "Нужна ре-верификация", value: stats.needsReverification, icon: Clock, color: stats.needsReverification > 0 ? "text-red-600" : "text-slate-500", bg: stats.needsReverification > 0 ? "bg-red-50" : "bg-slate-50", alert: stats.needsReverification > 0 },
            { label: "Всего заявок", value: stats.totalOrders, icon: ClipboardList, color: "text-purple-600", bg: "bg-purple-50", alert: false },
            { label: "Отзывов на модерации", value: stats.pendingReviews, icon: Star, color: "text-amber-600", bg: "bg-amber-50", alert: false },
            { label: "Долг (неоплачено)", value: `${stats.totalRevenue.toLocaleString("ru-RU")} ₽`, icon: Wallet, color: "text-orange-600", bg: "bg-orange-50", alert: false },
          ].map(({ label, value, icon: Icon, color, bg, alert }) => (
            <Card key={label} data-testid={`stat-card-${label}`} className={alert ? "ring-1 ring-red-300" : ""}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold ${alert ? "text-red-600" : "text-foreground"}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="users">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="users" data-testid="tab-admin-users">Пользователи</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-admin-orders">Заявки</TabsTrigger>
          <TabsTrigger value="engineers-mod" data-testid="tab-admin-engineers-mod">Инженеры</TabsTrigger>
          <TabsTrigger value="reviews" data-testid="tab-admin-reviews">
            Отзывы
            {stats && stats.pendingReviews > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs font-semibold rounded-full px-1.5 py-0.5">
                {stats.pendingReviews}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="leads" data-testid="tab-admin-leads">Учёт лидов</TabsTrigger>
          <TabsTrigger value="engineers-pro" data-testid="tab-admin-engineers-pro">PRO и Буст</TabsTrigger>
          <TabsTrigger value="verification" data-testid="tab-admin-verification">Логи проверок</TabsTrigger>
          <TabsTrigger value="complaints" data-testid="tab-admin-complaints">
            Жалобы
            {complaintsData && complaintsData.items.filter(c => c.status === "open").length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs font-semibold rounded-full px-1.5 py-0.5">
                {complaintsData.items.filter(c => c.status === "open").length}
              </span>
            )}
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="geography" data-testid="tab-admin-geography">
              <MapPin className="w-3.5 h-3.5 mr-1" />
              География
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="requisites" data-testid="tab-admin-requisites">
              <CreditCard className="w-3.5 h-3.5 mr-1" />
              Реквизиты
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Users ─────────────────────────────────────────────────────────── */}
        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle className="text-base">Пользователи платформы</CardTitle></CardHeader>
            <CardContent>
              {usersLoading ? <Skeleton className="h-64 rounded" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Имя</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.items.filter((u) => isSuperAdmin || u.role !== "superadmin").map((u) => (
                        <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell>
                            {isSuperAdmin && u.id !== user!.id ? (
                              <Select
                                value={u.role}
                                onValueChange={(role) => setUserRole.mutate({ userId: u.id, data: { role } })}
                              >
                                <SelectTrigger className="h-7 w-36 text-xs" data-testid={`select-role-${u.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ALL_ROLES.map(r => (
                                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.isBlocked === "true" ? "destructive" : "secondary"}>
                              {u.isBlocked === "true" ? "Заблокирован" : "Активен"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                          </TableCell>
                          <TableCell>
                            {u.id !== user!.id && (isSuperAdmin || u.role !== "superadmin") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateUser.mutate({ userId: u.id, data: { isBlocked: u.isBlocked !== "true" } })}
                                data-testid={`button-block-${u.id}`}
                              >
                                {u.isBlocked === "true" ? "Разблокировать" : "Заблокировать"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Orders ─────────────────────────────────────────────────────────── */}
        <TabsContent value="orders">
          <Card>
            <CardHeader><CardTitle className="text-base">Все заявки</CardTitle></CardHeader>
            <CardContent>
              {ordersLoading ? <Skeleton className="h-64 rounded" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Название</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>Регион</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Откликов</TableHead>
                        <TableHead>Дата</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders?.items.map((order) => {
                        const s = STATUS_CONFIG[order.status] ?? { label: order.status, className: "bg-gray-100 text-gray-600" };
                        return (
                          <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                            <TableCell className="font-medium max-w-xs truncate">{order.title}</TableCell>
                            <TableCell className="text-muted-foreground">{order.serviceType}</TableCell>
                            <TableCell className="text-muted-foreground">{order.region}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={s.className}>{s.label}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{order.bidCount}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Engineers Moderation ───────────────────────────────────────────── */}
        <TabsContent value="engineers-mod">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Модерация профилей инженеров</CardTitle>
            </CardHeader>
            <CardContent>
              {engineersLoading ? <Skeleton className="h-64 rounded" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Инженер</TableHead>
                        <TableHead>Регион / СРО</TableHead>
                        <TableHead>Рейтинг</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Росреестр</TableHead>
                        <TableHead>Видимость</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminEngineers?.items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Инженеры не найдены</TableCell>
                        </TableRow>
                      )}
                      {adminEngineers?.items.map((eng) => (
                        <TableRow key={eng.id} data-testid={`row-engineer-mod-${eng.id}`} className={eng.isHidden ? "opacity-60" : ""}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{eng.name}</p>
                              <p className="text-xs text-muted-foreground">{eng.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground">{eng.region}</p>
                            {eng.sroName && <p className="text-xs text-muted-foreground truncate max-w-[130px]">{eng.sroName}</p>}
                          </TableCell>
                          <TableCell className="text-sm">{eng.rating.toFixed(1)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {eng.isVerified ? (
                                <Badge className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                  <ShieldCheck className="w-3 h-3" /> Верифицирован
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Не верифицирован</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              {eng.attestatNumber ? (
                                <p className="text-xs font-mono text-muted-foreground">{eng.attestatNumber}</p>
                              ) : (
                                <p className="text-xs text-muted-foreground">—</p>
                              )}
                              {eng.rosreestrRejectionRate !== null && eng.rosreestrRejectionRate !== undefined ? (
                                <span className={`text-xs flex items-center gap-0.5 ${eng.rosreestrRejectionRate > 0.3 ? "text-red-600" : "text-emerald-600"}`}>
                                  <TrendingDown className="w-3 h-3" />
                                  {Math.round(eng.rosreestrRejectionRate * 100)}% отказов
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={eng.isHidden ? "secondary" : "outline"} className={eng.isHidden ? "bg-gray-100 text-gray-500" : "bg-green-50 text-green-700 border-green-200"}>
                              {eng.isHidden ? <><EyeOff className="w-3 h-3 mr-1 inline" />Скрыт</> : <><Eye className="w-3 h-3 mr-1 inline" />Виден</>}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() => setVisibility.mutate({ engineerId: eng.id, data: { isHidden: !eng.isHidden } })}
                                disabled={setVisibility.isPending}
                                data-testid={`button-visibility-${eng.id}`}
                              >
                                {eng.isHidden ? <><Eye className="w-3 h-3" /> Показать</> : <><EyeOff className="w-3 h-3" /> Скрыть</>}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => reverify.mutate({ id: eng.id })}
                                disabled={reverify.isPending}
                                data-testid={`button-reverify-mod-${eng.id}`}
                              >
                                <RefreshCw className="w-3 h-3" /> Верифицировать
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1"
                                onClick={() => {
                                  if (window.confirm(`Удалить инженера ${eng.name} и его аккаунт? Это действие необратимо.`)) {
                                    deleteEngineer.mutate({ engineerId: eng.id });
                                  }
                                }}
                                disabled={deleteEngineer.isPending}
                                data-testid={`button-delete-engineer-${eng.id}`}
                              >
                                <Trash2 className="w-3 h-3" /> Удалить
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Reviews Moderation ────────────────────────────────────────────── */}
        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" /> Модерация отзывов
                </CardTitle>
                <Select value={reviewFilter} onValueChange={setReviewFilter}>
                  <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-review-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">На модерации</SelectItem>
                    <SelectItem value="published">Опубликованные</SelectItem>
                    <SelectItem value="hidden">Скрытые</SelectItem>
                    <SelectItem value="">Все</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {reviewsLoading ? <Skeleton className="h-64 rounded" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Автор</TableHead>
                        <TableHead>Инженер</TableHead>
                        <TableHead>Оценка</TableHead>
                        <TableHead>Комментарий</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!adminReviews || adminReviews.items.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Отзывов не найдено
                          </TableCell>
                        </TableRow>
                      )}
                      {adminReviews?.items.map((review) => {
                        const modCfg = MODERATION_CONFIG[review.moderationStatus] ?? MODERATION_CONFIG.pending;
                        return (
                          <TableRow key={review.id} data-testid={`row-review-${review.id}`}>
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                              {new Date(review.createdAt).toLocaleDateString("ru-RU")}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{review.authorName}</p>
                              <p className="text-xs text-muted-foreground">{review.authorEmail}</p>
                            </TableCell>
                            <TableCell className="text-sm">{review.engineerName}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: review.rating }).map((_, i) => (
                                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                ))}
                                <span className="text-xs text-muted-foreground ml-1">{review.rating}/5</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs">
                              <p className="text-sm line-clamp-2 text-muted-foreground">{review.comment ?? "—"}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={modCfg.className} data-testid={`badge-review-status-${review.id}`}>
                                {modCfg.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {review.moderationStatus !== "published" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50 gap-1"
                                    onClick={() => moderateReview.mutate({ reviewId: review.id, data: { moderationStatus: "published" } })}
                                    disabled={moderateReview.isPending}
                                    data-testid={`button-publish-review-${review.id}`}
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Опубликовать
                                  </Button>
                                )}
                                {review.moderationStatus !== "hidden" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-gray-600 border-gray-300 hover:bg-gray-50 gap-1"
                                    onClick={() => moderateReview.mutate({ reviewId: review.id, data: { moderationStatus: "hidden" } })}
                                    disabled={moderateReview.isPending}
                                    data-testid={`button-hide-review-${review.id}`}
                                  >
                                    <EyeOff className="w-3 h-3" /> Скрыть
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Lead Billing ─────────────────────────────────────────────────── */}
        <TabsContent value="leads">
          <div className="space-y-6">
            {/* Debt summary */}
            <Card>
              <CardHeader><CardTitle className="text-base">Задолженности по инженерам</CardTitle></CardHeader>
              <CardContent>
                {debtSummaryLoading ? <Skeleton className="h-32 rounded" /> : debtSummary && debtSummary.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Инженер</TableHead>
                          <TableHead className="text-right">Начислено</TableHead>
                          <TableHead className="text-right">Оплачено</TableHead>
                          <TableHead className="text-right">Долг</TableHead>
                          <TableHead>Статус</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {debtSummary.map((s) => (
                          <TableRow key={s.engineerId} data-testid={`row-debt-${s.engineerId}`}>
                            <TableCell className="font-medium">{s.engineerName}</TableCell>
                            <TableCell className="text-right">{s.totalAccrued.toLocaleString("ru-RU")} ₽</TableCell>
                            <TableCell className="text-right text-green-600">{s.totalPaid.toLocaleString("ru-RU")} ₽</TableCell>
                            <TableCell className="text-right font-semibold">{s.debtAmount.toLocaleString("ru-RU")} ₽</TableCell>
                            <TableCell>
                              {s.debtAmount >= debtLimit ? (
                                <Badge variant="destructive" className="text-xs gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Заблокирован
                                </Badge>
                              ) : s.debtAmount >= debtLimit * 0.8 ? (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                  Предупреждение
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">ОК</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">Нет задолженностей</p>
                )}
              </CardContent>
            </Card>

            {/* Lead list */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Все лиды</CardTitle>
                  <span className="text-sm text-muted-foreground">{leadsData?.total ?? 0} записей</span>
                </div>
              </CardHeader>
              <CardContent>
                {leadsLoading ? <Skeleton className="h-64 rounded" /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Инженер</TableHead>
                          <TableHead>Тип услуги</TableHead>
                          <TableHead>Заявка</TableHead>
                          <TableHead className="text-right">Стоимость</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Дата</TableHead>
                          <TableHead>Действие</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leadsData?.items.map((lead) => (
                          <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                            <TableCell className="font-medium">{lead.engineerName ?? "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{lead.serviceType}</TableCell>
                            <TableCell className="text-muted-foreground">#{lead.orderId}</TableCell>
                            <TableCell className="text-right font-semibold">{lead.leadCost.toLocaleString("ru-RU")} ₽</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                lead.paymentStatus === "paid"
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }>
                                {lead.paymentStatus === "paid" ? "Оплачен" : "Не оплачен"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(lead.createdAt).toLocaleDateString("ru-RU")}
                            </TableCell>
                            <TableCell>
                              {lead.paymentStatus === "unpaid" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-700 border-green-300 hover:bg-green-50"
                                  onClick={() => updateLead.mutate({ leadId: lead.id, data: { paymentStatus: "paid" } })}
                                  disabled={updateLead.isPending}
                                  data-testid={`button-pay-lead-${lead.id}`}
                                >
                                  Отметить оплаченным
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lead price settings */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Настройки лидов</CardTitle>
                  <Button
                    size="sm"
                    onClick={handleSavePrices}
                    disabled={updateLeadPrices.isPending || Object.keys(editingPrices).length === 0}
                    data-testid="button-save-prices"
                  >
                    {updateLeadPrices.isPending ? "Сохраняем..." : "Сохранить цены"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {leadPricesLoading ? <Skeleton className="h-48 rounded" /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Тип услуги</TableHead>
                          <TableHead className="w-40">Цена лида (₽)</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Обновлено</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leadPrices?.map((lp) => (
                          <TableRow key={lp.id} data-testid={`row-price-${lp.serviceType}`}>
                            <TableCell className="font-medium">{lp.serviceType}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="h-8 w-28"
                                defaultValue={lp.price}
                                onChange={(e) => setEditingPrices(prev => ({
                                  ...prev,
                                  [lp.serviceType]: parseInt(e.target.value) || lp.price,
                                }))}
                                data-testid={`input-price-${lp.serviceType}`}
                              />
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {new Date(lp.updatedAt).toLocaleDateString("ru-RU")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── PRO & Boost ─────────────────────────────────────────────────── */}
        <TabsContent value="engineers-pro">
          <Card>
            <CardHeader><CardTitle className="text-base">Управление PRO-статусом и бустом</CardTitle></CardHeader>
            <CardContent>
              {engineersLoading ? <Skeleton className="h-64 rounded" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Инженер</TableHead>
                        <TableHead>Регион</TableHead>
                        <TableHead>Рейтинг</TableHead>
                        <TableHead>PRO</TableHead>
                        <TableHead>Буст</TableHead>
                        <TableHead>Долг</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminEngineers?.items.map((eng) => (
                        <TableRow key={eng.id} data-testid={`row-engineer-pro-${eng.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{eng.name}</p>
                              <p className="text-xs text-muted-foreground">{eng.email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{eng.region}</TableCell>
                          <TableCell className="text-sm">{eng.rating.toFixed(1)}</TableCell>
                          <TableCell>
                            {eng.isPro ? (
                              <div>
                                <Badge className="bg-amber-50 text-amber-700 border-amber-300 text-xs gap-1">
                                  <Sparkles className="w-3 h-3" /> PRO
                                </Badge>
                                {eng.proExpiresAt && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    до {new Date(eng.proExpiresAt).toLocaleDateString("ru-RU")}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {eng.activeBoost ? (
                              <div>
                                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                                  Буст {eng.activeBoost.period}д
                                </Badge>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  до {new Date(eng.activeBoost.expiresAt).toLocaleDateString("ru-RU")}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`text-sm font-semibold ${eng.debtAmount >= debtLimit ? "text-red-600" : eng.debtAmount >= debtLimit * 0.8 ? "text-amber-600" : "text-foreground"}`}>
                              {eng.debtAmount.toLocaleString("ru-RU")} ₽
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className={eng.isPro ? "text-gray-600" : "text-amber-600 border-amber-300 hover:bg-amber-50"}
                                onClick={() => updateEngineer.mutate({
                                  engineerId: eng.id,
                                  data: {
                                    isPro: !eng.isPro,
                                    proExpiresAt: !eng.isPro
                                      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                                      : null,
                                  },
                                })}
                                disabled={updateEngineer.isPending}
                                data-testid={`button-toggle-pro-${eng.id}`}
                              >
                                {eng.isPro ? "Снять PRO" : "Назначить PRO"}
                              </Button>
                              <BoostSelector engineId={eng.id} onBoost={(period) =>
                                updateEngineer.mutate({ engineerId: eng.id, data: { boostPeriod: period } })
                              } />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Verification Logs ────────────────────────────────────────────── */}
        <TabsContent value="verification">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" /> Логи проверок Росреестра
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logsLoading ? <Skeleton className="h-64 rounded" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Инженер</TableHead>
                        <TableHead>Номер аттестата</TableHead>
                        <TableHead>Результат</TableHead>
                        <TableHead>Причина отказа</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {verificationLogs?.items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Логов проверок пока нет
                          </TableCell>
                        </TableRow>
                      )}
                      {verificationLogs?.items.map((log) => (
                        <TableRow key={log.id} data-testid={`row-vlog-${log.id}`}>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {new Date(log.checkedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{log.engineerName ?? "—"}</p>
                              {log.engineerEmail && <p className="text-xs text-muted-foreground">{log.engineerEmail}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{log.attestatNumber}</TableCell>
                          <TableCell>
                            <Badge
                              variant={log.result === "pass" ? "default" : "destructive"}
                              className={log.result === "pass" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : ""}
                              data-testid={`badge-vlog-result-${log.id}`}
                            >
                              {log.result === "pass" ? "Пройдена" : "Не пройдена"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-xs">
                            <span className="line-clamp-2">{log.failureReason ?? "—"}</span>
                          </TableCell>
                          <TableCell>
                            {log.engineerId != null && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                                onClick={() => reverify.mutate({ id: log.engineerId! })}
                                disabled={reverify.isPending}
                                data-testid={`button-reverify-${log.engineerId}`}
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Перепроверить
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Complaints ────────────────────────────────────────────────────── */}
        <TabsContent value="complaints">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" /> Жалобы пользователей
              </CardTitle>
            </CardHeader>
            <CardContent>
              {complaintsLoading ? <Skeleton className="h-64 rounded" /> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Жалобщик / Чат</TableHead>
                        <TableHead>Описание</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!complaintsData || complaintsData.items.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Жалоб пока нет
                          </TableCell>
                        </TableRow>
                      )}
                      {complaintsData?.items.map((c) => (
                        <TableRow key={c.id} data-testid={`row-complaint-${c.id}`}>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {new Date(c.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{(c as unknown as { reporterName?: string }).reporterName ?? `#${c.reporterId}`}</p>
                              <p className="text-xs text-muted-foreground">ID {c.reporterId}</p>
                              <a
                                href={`/chat/${c.roomId}`}
                                className="text-primary text-xs flex items-center gap-1 hover:underline mt-0.5"
                              >
                                <MessageSquare className="w-3 h-3" /> Чат #{c.roomId}
                              </a>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm line-clamp-2">{c.description}</p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={c.status === "open" ? "destructive" : "secondary"}
                              data-testid={`badge-complaint-status-${c.id}`}
                            >
                              {c.status === "open" ? "Открыта" : "Закрыта"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              {c.status === "open" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 text-xs"
                                  onClick={() => resolveComplaint.mutate({ complaintId: c.id })}
                                  disabled={resolveComplaint.isPending}
                                  data-testid={`button-resolve-complaint-${c.id}`}
                                >
                                  Закрыть
                                </Button>
                              )}
                              <ComplaintTranscript complaint={c} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Geography ─────────────────────────────────────────────────────── */}
        {isAdmin && (
          <TabsContent value="geography">
            <GeographyTab readOnly={!isSuperAdmin} />
          </TabsContent>
        )}

        {/* ── Requisites ─────────────────────────────────────────────────────── */}
        {isSuperAdmin && (
          <TabsContent value="requisites">
            <RequisitesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  active: "Активен",
  limited: "Ограничен",
  paused: "Приостановлен",
  closed: "Закрыт",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  limited: "bg-amber-100 text-amber-800",
  paused: "bg-orange-100 text-orange-800",
  closed: "bg-red-100 text-red-800",
};

const MONETIZATION_LABELS: Record<string, string> = {
  global: "Глобальная",
  fixed: "Фиксированная",
  percent: "Процент",
  hybrid: "Гибридная",
  disabled: "Отключена",
};

function GeographyTab({ readOnly = false }: { readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: regions, isLoading } = useListAdminRegions();
  const updateRegion = useUpdateAdminRegion();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editComment, setEditComment] = useState("");
  const [editMonetizationModel, setEditMonetizationModel] = useState("global");
  const [editFixedLeadFee, setEditFixedLeadFee] = useState("0");
  const [editPercentFee, setEditPercentFee] = useState("0");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const districts = regions
    ? Array.from(new Set(regions.map((r) => r.federalDistrict)))
    : [];

  const filtered = (regions ?? []).filter((r) => {
    if (filterDistrict !== "all" && r.federalDistrict !== filterDistrict) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (searchTerm && !r.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  function startEdit(r: { id: number; status: string; comment?: string | null; monetizationModel: string; fixedLeadFee: number; percentFee: number }) {
    setEditingId(r.id);
    setEditStatus(r.status);
    setEditComment(r.comment ?? "");
    setEditMonetizationModel(r.monetizationModel ?? "global");
    setEditFixedLeadFee(String(r.fixedLeadFee ?? 0));
    setEditPercentFee(String(r.percentFee ?? 0));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    try {
      await updateRegion.mutateAsync({
        regionId: id,
        data: {
          status: editStatus as "active" | "limited" | "paused" | "closed",
          comment: editComment || null,
          monetizationModel: editMonetizationModel as "global" | "fixed" | "percent" | "hybrid" | "disabled",
          fixedLeadFee: Number(editFixedLeadFee) || 0,
          percentFee: Number(editPercentFee) || 0,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListAdminRegionsQueryKey() });
      toast({ title: "Сохранено" });
      setEditingId(null);
    } catch {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    }
  }

  const summary = regions
    ? { active: regions.filter(r => r.status === "active").length, limited: regions.filter(r => r.status === "limited").length, paused: regions.filter(r => r.status === "paused").length, closed: regions.filter(r => r.status === "closed").length }
    : null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["active", "limited", "paused", "closed"] as const).map((s) => (
            <Card key={s} className="p-4">
              <p className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</p>
              <p className="text-2xl font-bold mt-1">{summary[s]}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="Поиск по названию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 text-sm w-48"
              data-testid="geography-search"
            />
            <Select value={filterDistrict} onValueChange={setFilterDistrict}>
              <SelectTrigger className="h-8 text-xs w-48" data-testid="geography-filter-district">
                <SelectValue placeholder="Федеральный округ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все округа</SelectItem>
                {districts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs w-36" data-testid="geography-filter-status">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">Показано: {filtered.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Regions table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 text-xs">№</TableHead>
                    <TableHead className="text-xs">Субъект РФ</TableHead>
                    <TableHead className="text-xs">Федеральный округ</TableHead>
                    <TableHead className="text-xs">Статус</TableHead>
                    <TableHead className="text-xs">Монетизация</TableHead>
                    <TableHead className="text-xs text-right">Инженеры</TableHead>
                    <TableHead className="text-xs text-right">Заявки</TableHead>
                    <TableHead className="text-xs text-right">В работе</TableHead>
                    <TableHead className="text-xs text-right">Выручка ₽</TableHead>
                    <TableHead className="text-xs">Комментарий</TableHead>
                    {!readOnly && <TableHead className="text-xs">Действие</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} data-testid={`region-row-${r.id}`}>
                      <TableCell className="text-xs text-muted-foreground">{r.code}</TableCell>
                      <TableCell className="text-xs font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.federalDistrict}</TableCell>
                      <TableCell>
                        {editingId === r.id ? (
                          <Select value={editStatus} onValueChange={setEditStatus}>
                            <SelectTrigger className="h-7 text-xs w-36" data-testid={`select-region-status-${r.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={`text-xs ${STATUS_COLORS[r.status] ?? ""}`}>
                            {STATUS_LABELS[r.status] ?? r.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === r.id ? (
                          <div className="space-y-1 min-w-[180px]">
                            <Select value={editMonetizationModel} onValueChange={setEditMonetizationModel}>
                              <SelectTrigger className="h-7 text-xs w-full" data-testid={`select-region-monetization-${r.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(MONETIZATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {(editMonetizationModel === "fixed" || editMonetizationModel === "hybrid") && (
                              <Input
                                value={editFixedLeadFee}
                                onChange={(e) => setEditFixedLeadFee(e.target.value)}
                                placeholder="Фикс. плата, ₽"
                                className="h-7 text-xs"
                                type="number"
                                min="0"
                                data-testid={`input-region-fixed-fee-${r.id}`}
                              />
                            )}
                            {(editMonetizationModel === "percent" || editMonetizationModel === "hybrid") && (
                              <Input
                                value={editPercentFee}
                                onChange={(e) => setEditPercentFee(e.target.value)}
                                placeholder="Процент, %"
                                className="h-7 text-xs"
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                data-testid={`input-region-percent-fee-${r.id}`}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{MONETIZATION_LABELS[r.monetizationModel] ?? r.monetizationModel}</span>
                            {r.monetizationModel === "fixed" && r.fixedLeadFee > 0 && (
                              <span className="block">{r.fixedLeadFee} ₽/лид</span>
                            )}
                            {r.monetizationModel === "percent" && r.percentFee > 0 && (
                              <span className="block">{r.percentFee}%</span>
                            )}
                            {r.monetizationModel === "hybrid" && (
                              <span className="block">{r.fixedLeadFee} ₽ + {r.percentFee}%</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right">{r.engineerCount}</TableCell>
                      <TableCell className="text-xs text-right">{r.orderCount}</TableCell>
                      <TableCell className="text-xs text-right">{r.activeOrderCount}</TableCell>
                      <TableCell className="text-xs text-right">{r.revenue.toLocaleString("ru-RU")}</TableCell>
                      <TableCell className="text-xs max-w-[140px]">
                        {editingId === r.id ? (
                          <Input
                            value={editComment}
                            onChange={(e) => setEditComment(e.target.value)}
                            placeholder="Комментарий..."
                            className="h-7 text-xs"
                            data-testid={`input-region-comment-${r.id}`}
                          />
                        ) : (
                          <span className="text-muted-foreground truncate block">{r.comment ?? "—"}</span>
                        )}
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          {editingId === r.id ? (
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7 text-xs" onClick={() => saveEdit(r.id)} data-testid={`button-region-save-${r.id}`}>
                                Сохранить
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit}>
                                Отмена
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => startEdit(r)}
                              data-testid={`button-region-edit-${r.id}`}
                            >
                              Изменить
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ComplaintItem = {
  id: number;
  roomId: number;
  reporterId: number;
  description: string;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
  reporterName?: string | null;
  recentMessages?: Array<{
    id: number;
    senderId: number;
    senderName: string;
    text: string;
    createdAt: string;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    attachmentType?: string | null;
  }>;
};

function ComplaintTranscript({ complaint }: { complaint: ComplaintItem }) {
  const [open, setOpen] = useState(false);
  const msgs = complaint.recentMessages ?? [];

  return (
    <div>
      <button
        className="text-xs text-primary hover:underline flex items-center gap-1"
        onClick={() => setOpen(!open)}
        data-testid={`button-transcript-${complaint.id}`}
      >
        <MessageSquare className="w-3 h-3" />
        {open ? "Скрыть переписку" : `Переписка (${msgs.length})`}
      </button>
      {open && (
        <div className="mt-2 border rounded-lg bg-muted/30 p-2 space-y-1.5 max-h-60 overflow-y-auto" data-testid={`transcript-${complaint.id}`}>
          {msgs.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Нет сообщений</p>
          )}
          {msgs.map((m) => (
            <div key={m.id} className="text-xs">
              <span className="font-medium text-foreground">{m.senderName}</span>
              <span className="text-muted-foreground ml-1">
                {new Date(m.createdAt).toLocaleString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
              </span>
              {m.text && <p className="mt-0.5 text-muted-foreground">{m.text}</p>}
              {m.attachmentUrl && (
                <a
                  href={m.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline text-xs"
                >
                  📎 {m.attachmentName ?? "Файл"}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const RECIPIENT_TYPE_LABELS: Record<string, string> = {
  individual: "Физлицо",
  self_employed: "Самозанятый",
  ip: "ИП",
  company: "ООО",
};

const emptyReqForm = (): PaymentRequisiteCreate => ({
  fullName: "",
  recipientType: "individual",
  bank: "",
  cardNumber: "",
  phone: "",
  email: "",
  paymentComment: "",
});

function ReqFormFields({
  form,
  onChange,
}: {
  form: PaymentRequisiteCreate | PaymentRequisiteUpdate;
  onChange: (f: PaymentRequisiteCreate | PaymentRequisiteUpdate) => void;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Тип получателя</label>
        <Select value={form.recipientType ?? "individual"} onValueChange={(v) => onChange({ ...form, recipientType: v as PaymentRequisiteCreate["recipientType"] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(RECIPIENT_TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">ФИО / Название</label>
        <Input className="h-8 text-sm" value={form.fullName ?? ""} onChange={(e) => onChange({ ...form, fullName: e.target.value })} placeholder="Иванов Иван Иванович" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Банк</label>
        <Input className="h-8 text-sm" value={form.bank ?? ""} onChange={(e) => onChange({ ...form, bank: e.target.value })} placeholder="Сбербанк" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Номер карты</label>
        <Input className="h-8 text-sm" value={form.cardNumber ?? ""} onChange={(e) => onChange({ ...form, cardNumber: e.target.value })} placeholder="4276 **** **** 1234" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Телефон СБП</label>
        <Input className="h-8 text-sm" value={form.phone ?? ""} onChange={(e) => onChange({ ...form, phone: e.target.value })} placeholder="+7 999 123-45-67" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Email</label>
        <Input className="h-8 text-sm" value={form.email ?? ""} onChange={(e) => onChange({ ...form, email: e.target.value })} placeholder="payment@example.com" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <label className="text-xs font-medium text-muted-foreground">Назначение платежа</label>
        <Textarea className="text-sm resize-none" rows={2} value={form.paymentComment ?? ""} onChange={(e) => onChange({ ...form, paymentComment: e.target.value })} placeholder="Оплата задолженности за лиды КадастрПро" />
      </div>
    </div>
  );
}

function RequisitesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requisites, isLoading } = useListAdminPaymentRequisites();
  const createMutation = useCreateAdminPaymentRequisite();
  const updateMutation = useUpdateAdminPaymentRequisite();
  const activateMutation = useActivateAdminPaymentRequisite();
  const archiveMutation = useArchiveAdminPaymentRequisite();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [logId, setLogId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<PaymentRequisiteCreate>(emptyReqForm());
  const [editForm, setEditForm] = useState<PaymentRequisiteUpdate>({});

  const activeRequisite = requisites?.find((r) => r.status === "active");

  function startEdit(r: PaymentRequisiteAdmin) {
    setEditingId(r.id);
    setEditForm({
      fullName: r.fullName,
      recipientType: r.recipientType as PaymentRequisiteUpdate["recipientType"],
      bank: r.bank ?? "",
      cardNumber: r.cardNumber ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      paymentComment: r.paymentComment ?? "",
    });
    setLogId(null);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListAdminPaymentRequisitesQueryKey() });
  }

  async function handleCreate() {
    if (!createForm.fullName.trim()) {
      toast({ title: "ФИО обязательно", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({ data: createForm });
      invalidate();
      toast({ title: "Реквизиты созданы" });
      setShowCreate(false);
      setCreateForm(emptyReqForm());
    } catch {
      toast({ title: "Ошибка при создании", variant: "destructive" });
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    try {
      await updateMutation.mutateAsync({ id: editingId, data: editForm });
      invalidate();
      toast({ title: "Реквизиты обновлены" });
      setEditingId(null);
    } catch {
      toast({ title: "Ошибка при обновлении", variant: "destructive" });
    }
  }

  async function handleActivate(id: number) {
    try {
      await activateMutation.mutateAsync({ id });
      invalidate();
      toast({ title: "Реквизиты активированы" });
    } catch {
      toast({ title: "Ошибка при активации", variant: "destructive" });
    }
  }

  async function handleArchive(id: number) {
    try {
      await archiveMutation.mutateAsync({ id });
      invalidate();
      toast({ title: "Реквизиты архивированы" });
    } catch {
      toast({ title: "Ошибка при архивации", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Реквизиты для оплаты</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Только активные реквизиты видят инженеры в личном кабинете</p>
        </div>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}>
          <Plus className="w-4 h-4 mr-1" />Создать
        </Button>
      </div>

      {/* No active warning */}
      {!isLoading && !activeRequisite && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Нет активных реквизитов. Инженеры не видят, куда перечислять оплату.
        </div>
      )}

      {/* Active preview */}
      {activeRequisite && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Активные реквизиты
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">Получатель</span>
              <span className="sm:col-span-2 font-medium">{activeRequisite.fullName} ({RECIPIENT_TYPE_LABELS[activeRequisite.recipientType] ?? activeRequisite.recipientType})</span>
              {activeRequisite.bank && <><span className="text-muted-foreground">Банк</span><span className="sm:col-span-2">{activeRequisite.bank}</span></>}
              {activeRequisite.cardNumber && <><span className="text-muted-foreground">Карта</span><span className="sm:col-span-2 font-mono">{activeRequisite.cardNumber}</span></>}
              {activeRequisite.phone && <><span className="text-muted-foreground">СБП / Тел.</span><span className="sm:col-span-2">{activeRequisite.phone}</span></>}
              {activeRequisite.email && <><span className="text-muted-foreground">Email</span><span className="sm:col-span-2">{activeRequisite.email}</span></>}
              {activeRequisite.paymentComment && <><span className="text-muted-foreground">Назначение</span><span className="sm:col-span-2 italic">{activeRequisite.paymentComment}</span></>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Новые реквизиты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReqFormFields form={createForm} onChange={(f) => setCreateForm(f as PaymentRequisiteCreate)} />
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>Создать</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>Отмена</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="h-40 m-4 rounded" />
          ) : !requisites?.length ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Реквизиты ещё не созданы</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Статус</TableHead>
                    <TableHead>ФИО / Название</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Банк</TableHead>
                    <TableHead>Карта</TableHead>
                    <TableHead>СБП</TableHead>
                    <TableHead className="w-8">Создан</TableHead>
                    <TableHead className="w-36 text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requisites.map((r) => (
                    <>
                      <TableRow key={r.id} className={editingId === r.id ? "bg-muted/40" : ""}>
                        <TableCell>
                          <Badge className={r.status === "active" ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}>
                            {r.status === "active" ? "Активен" : "Архив"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{r.fullName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{RECIPIENT_TYPE_LABELS[r.recipientType] ?? r.recipientType}</TableCell>
                        <TableCell className="text-sm">{r.bank ?? "—"}</TableCell>
                        <TableCell className="text-sm font-mono">{r.cardNumber ?? "—"}</TableCell>
                        <TableCell className="text-sm">{r.phone ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString("ru-RU")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.status !== "active" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-green-700 hover:bg-green-50" onClick={() => handleActivate(r.id)} title="Активировать">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {r.status === "active" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-500 hover:bg-gray-100" onClick={() => handleArchive(r.id)} title="Архивировать">
                                <Archive className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600 hover:bg-blue-50" onClick={() => (editingId === r.id ? setEditingId(null) : startEdit(r))} title="Изменить">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:bg-muted" onClick={() => setLogId(logId === r.id ? null : r.id)} title="Журнал изменений">
                              <History className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Inline edit form */}
                      {editingId === r.id && (
                        <TableRow key={`${r.id}-edit`}>
                          <TableCell colSpan={8} className="bg-muted/30 px-5 py-4">
                            <p className="text-xs font-medium text-muted-foreground mb-3">Редактирование реквизита #{r.id}</p>
                            <ReqFormFields form={editForm} onChange={(f) => setEditForm(f as PaymentRequisiteUpdate)} />
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" onClick={handleUpdate} disabled={updateMutation.isPending}>Сохранить</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Отмена</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Audit log */}
                      {logId === r.id && (
                        <TableRow key={`${r.id}-log`}>
                          <TableCell colSpan={8} className="bg-muted/20 px-5 py-4">
                            <RequisiteLogPanel id={r.id} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RequisiteLogPanel({ id }: { id: number }) {
  const { data: log, isLoading } = useGetAdminPaymentRequisiteLog(id);

  const ACTION_LABELS: Record<string, string> = {
    create: "Создание",
    update: "Изменение",
    status_change: "Смена статуса",
  };

  if (isLoading) return <Skeleton className="h-20 rounded" />;
  if (!log?.length) return <p className="text-xs text-muted-foreground py-2">История изменений пуста</p>;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" />
        Журнал изменений реквизита #{id}
      </p>
      <div className="space-y-1">
        {log.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 text-xs py-1.5 border-b last:border-0">
            <span className="text-muted-foreground whitespace-nowrap">
              {new Date(entry.changedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
            <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
              {ACTION_LABELS[entry.action] ?? entry.action}
            </Badge>
            {entry.fieldName && (
              <span className="text-muted-foreground">
                <span className="font-mono bg-muted px-1 rounded">{entry.fieldName}</span>
                {entry.oldValue !== null && <> : <span className="line-through opacity-60">{entry.oldValue}</span></>}
                {entry.newValue !== null && <> → <span className="text-foreground font-medium">{entry.newValue}</span></>}
              </span>
            )}
            {entry.changedByName && (
              <span className="ml-auto text-muted-foreground shrink-0">{entry.changedByName}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BoostSelector({ engineId, onBoost }: { engineId: number; onBoost: (period: number) => void }) {
  const [period, setPeriod] = useState("7");
  return (
    <div className="flex items-center gap-1.5">
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="h-8 w-20 text-xs" data-testid={`select-boost-period-${engineId}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">7 дней</SelectItem>
          <SelectItem value="30">30 дней</SelectItem>
          <SelectItem value="90">90 дней</SelectItem>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs text-violet-600 border-violet-300 hover:bg-violet-50"
        onClick={() => onBoost(parseInt(period))}
        data-testid={`button-boost-${engineId}`}
      >
        Буст
      </Button>
    </div>
  );
}
