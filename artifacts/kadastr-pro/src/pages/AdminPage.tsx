import { useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  useGetAdminSettings, getGetAdminSettingsQueryKey,
  useUpdateAdminSettings,
  useListAdminVerificationLogs, getListAdminVerificationLogsQueryKey,
  useReverifyEngineer,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Users, ClipboardList, Shield, Sparkles, Wallet, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";

const DEBT_LIMIT = 3000;

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingPrices, setEditingPrices] = useState<Record<string, number>>({});
  const [editingSettings, setEditingSettings] = useState<Record<string, string>>({});

  const { data: stats, isLoading: statsLoading } = useGetAdminStats({
    query: { enabled: user?.role === "admin", queryKey: getGetAdminStatsQueryKey() },
  });

  const { data: users, isLoading: usersLoading } = useListAdminUsers(
    {},
    { query: { enabled: user?.role === "admin", queryKey: getListAdminUsersQueryKey({}) } }
  );

  const { data: orders, isLoading: ordersLoading } = useListAdminOrders(
    {},
    { query: { enabled: user?.role === "admin", queryKey: getListAdminOrdersQueryKey({}) } }
  );

  const { data: leadPrices, isLoading: leadPricesLoading } = useGetAdminLeadPrices({
    query: { enabled: user?.role === "admin", queryKey: getGetAdminLeadPricesQueryKey() },
  });

  const { data: leadsData, isLoading: leadsLoading } = useListAdminLeads(
    {},
    { query: { enabled: user?.role === "admin", queryKey: getListAdminLeadsQueryKey({}) } }
  );

  const { data: debtSummary, isLoading: debtSummaryLoading } = useGetAdminLeadsSummary({
    query: { enabled: user?.role === "admin", queryKey: getGetAdminLeadsSummaryQueryKey() },
  });

  const { data: adminEngineers, isLoading: engineersLoading } = useListAdminEngineers(
    {},
    { query: { enabled: user?.role === "admin", queryKey: getListAdminEngineersQueryKey({}) } }
  );

  const { data: verificationLogs, isLoading: logsLoading } = useListAdminVerificationLogs(
    {},
    { query: { enabled: user?.role === "admin", queryKey: getListAdminVerificationLogsQueryKey({}) } }
  );

  const updateUser = useUpdateAdminUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey({}) });
        toast({ title: "Пользователь обновлён" });
      },
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

  if (!user || user.role !== "admin") {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold mb-2">Доступ запрещён</h2>
        <p className="text-muted-foreground mb-4">Эта страница доступна только администраторам</p>
        <Button onClick={() => setLocation("/")} variant="outline">На главную</Button>
      </div>
    );
  }

  const ROLE_LABELS: Record<string, string> = { customer: "Заказчик", engineer: "Инженер", admin: "Администратор" };
  const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    open: { label: "Открыта", className: "bg-blue-50 text-blue-700" },
    in_progress: { label: "В работе", className: "bg-yellow-50 text-yellow-700" },
    completed: { label: "Завершена", className: "bg-green-50 text-green-700" },
    cancelled: { label: "Отменена", className: "bg-gray-100 text-gray-600" },
  };

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
        <p className="text-muted-foreground">КадастрПро Administration</p>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : stats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Всего пользователей", value: stats.totalUsers, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Инженеров", value: stats.totalEngineers, icon: Shield, color: "text-green-600", bg: "bg-green-50" },
            { label: "Всего заявок", value: stats.totalOrders, icon: ClipboardList, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Долг (неоплачено)", value: `${stats.totalRevenue.toLocaleString("ru-RU")} ₽`, icon: Wallet, color: "text-orange-600", bg: "bg-orange-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} data-testid={`stat-card-${label}`}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-6 h-6 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
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
          <TabsTrigger value="leads" data-testid="tab-admin-leads">Учёт лидов</TabsTrigger>
          <TabsTrigger value="engineers-pro" data-testid="tab-admin-engineers-pro">PRO и Буст</TabsTrigger>
          <TabsTrigger value="verification" data-testid="tab-admin-verification">Логи проверок</TabsTrigger>
        </TabsList>

        {/* Users */}
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
                      {users?.items.map((u) => (
                        <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{ROLE_LABELS[u.role] ?? u.role}</Badge>
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
                            {u.id !== user.id && (
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

        {/* Orders */}
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

        {/* Lead Billing */}
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
                              {s.debtAmount >= DEBT_LIMIT ? (
                                <Badge variant="destructive" className="text-xs gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Заблокирован
                                </Badge>
                              ) : s.debtAmount >= DEBT_LIMIT * 0.8 ? (
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

        {/* PRO & Boost */}
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
                            <span className={`text-sm font-semibold ${eng.debtAmount >= DEBT_LIMIT ? "text-red-600" : eng.debtAmount >= DEBT_LIMIT * 0.8 ? "text-amber-600" : "text-foreground"}`}>
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

        {/* Rosreestr Verification Logs */}
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
      </Tabs>
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
