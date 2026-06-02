import { useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useGetAdminStats, getGetAdminStatsQueryKey,
  useListAdminUsers, getListAdminUsersQueryKey,
  useListAdminOrders, getListAdminOrdersQueryKey,
  useUpdateAdminUser,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Users, ClipboardList, CheckCircle, TrendingUp, Shield } from "lucide-react";

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const updateUser = useUpdateAdminUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey({}) });
        toast({ title: "Пользователь обновлён" });
      },
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
            { label: "Выполнено", value: stats.completedOrders, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
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
        <TabsList className="mb-6">
          <TabsTrigger value="users" data-testid="tab-admin-users">Пользователи</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-admin-orders">Заявки</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
