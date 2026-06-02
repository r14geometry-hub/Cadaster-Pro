import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import EngineerCard from "@/components/EngineerCard";
import OrderCard from "@/components/OrderCard";
import StarRating from "@/components/StarRating";
import { useGetStatsSummary, useListTopEngineers, useListRecentOrders } from "@workspace/api-client-react";
import { MapPin, ClipboardList, Users, CheckCircle, ArrowRight, Search, FileText, UserCheck, Handshake } from "lucide-react";

const SERVICE_TYPES = [
  "Межевание", "Техплан", "Кадастровый паспорт",
  "Постановка на учёт", "Снятие с учёта", "Оценка",
];

export default function HomePage() {
  const { data: stats } = useGetStatsSummary();
  const { data: topEngineers, isLoading: engineersLoading } = useListTopEngineers();
  const { data: recentOrders, isLoading: ordersLoading } = useListRecentOrders();

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-50 via-white to-emerald-50 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4 bg-green-100 text-green-800 border-green-200" data-testid="badge-hero">
              Проверенные кадастровые инженеры России
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight mb-6" data-testid="heading-hero">
              Найдите кадастрового инженера для вашей задачи
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Разместите заявку — получите отклики от сертифицированных специалистов. Выберите лучшего по рейтингу и отзывам.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/orders/create" data-testid="button-create-order-hero">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  <ClipboardList className="w-5 h-5" /> Разместить заявку
                </Button>
              </Link>
              <Link href="/engineers" data-testid="button-find-engineer-hero">
                <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                  <Search className="w-5 h-5" /> Найти инженера
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-10 border-y bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: stats?.totalEngineers ?? "—", label: "Инженеров", icon: Users, testId: "stat-engineers" },
              { value: stats?.verifiedEngineers ?? "—", label: "Проверено реестром", icon: CheckCircle, testId: "stat-verified" },
              { value: stats?.totalOrders ?? "—", label: "Заявок размещено", icon: ClipboardList, testId: "stat-orders" },
              { value: stats?.completedOrders ?? "—", label: "Заказов выполнено", icon: Handshake, testId: "stat-completed" },
            ].map(({ value, label, icon: Icon, testId }) => (
              <div key={label} className="flex flex-col items-center gap-1" data-testid={testId}>
                <Icon className="w-6 h-6 text-primary mb-1" />
                <span className="text-2xl md:text-3xl font-bold text-foreground">{value}</span>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="heading-services">Виды услуг</h2>
          <p className="text-muted-foreground mb-8">Выберите нужный вид кадастровых работ</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {SERVICE_TYPES.map((service) => (
              <Link key={service} href={`/engineers?specialization=${encodeURIComponent(service)}`} data-testid={`card-service-${service}`}>
                <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer h-full">
                  <CardContent className="p-4 text-center">
                    <MapPin className="w-6 h-6 text-primary mx-auto mb-2" />
                    <span className="text-sm font-medium text-foreground">{service}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-foreground mb-2 text-center">Как это работает</h2>
          <p className="text-muted-foreground mb-10 text-center">Три шага до готового кадастрового документа</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: FileText, title: "Разместите заявку", desc: "Опишите задачу, укажите регион и желаемый бюджет. Это бесплатно и занимает 2 минуты.", num: "1" },
              { icon: UserCheck, title: "Выберите инженера", desc: "Получите отклики от проверенных специалистов. Изучите рейтинг, отзывы и опыт работы.", num: "2" },
              { icon: Handshake, title: "Получите документы", desc: "Общайтесь с инженером в чате, следите за ходом работы и оставьте отзыв по завершению.", num: "3" },
            ].map(({ icon: Icon, title, desc, num }) => (
              <div key={num} className="flex flex-col items-center text-center p-6">
                <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center text-lg font-bold mb-4">
                  {num}
                </div>
                <Icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top Engineers */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1" data-testid="heading-top-engineers">Лучшие инженеры</h2>
              <p className="text-muted-foreground">По рейтингу и числу выполненных заказов</p>
            </div>
            <Link href="/engineers" data-testid="link-all-engineers">
              <Button variant="outline" size="sm" className="gap-1">Все инженеры <ArrowRight className="w-4 h-4" /></Button>
            </Link>
          </div>
          {engineersLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
            </div>
          ) : topEngineers && topEngineers.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topEngineers.map((eng) => <EngineerCard key={eng.id} engineer={eng} />)}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Инженеры скоро появятся</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent Orders */}
      <section className="py-14 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1" data-testid="heading-recent-orders">Свежие заявки</h2>
              <p className="text-muted-foreground">Актуальные заявки, ожидающие откликов</p>
            </div>
            <Link href="/orders/create" data-testid="link-create-order">
              <Button size="sm" className="gap-1">Разместить заявку <ArrowRight className="w-4 h-4" /></Button>
            </Link>
          </div>
          {ordersLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
            </div>
          ) : recentOrders && recentOrders.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentOrders.map((order) => <OrderCard key={order.id} order={order} />)}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Заявок пока нет</p>
              <Link href="/orders/create" className="mt-3 inline-block">
                <Button size="sm">Разместить первую заявку</Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Готовы начать?</h2>
          <p className="text-green-100 mb-8 max-w-md mx-auto">
            Разместите заявку бесплатно и получите отклики от проверенных кадастровых инженеров вашего региона
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/register" data-testid="button-cta-register">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">Зарегистрироваться</Button>
            </Link>
            <Link href="/engineers" data-testid="button-cta-engineers">
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-white border-white hover:bg-white/10">Каталог инженеров</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
