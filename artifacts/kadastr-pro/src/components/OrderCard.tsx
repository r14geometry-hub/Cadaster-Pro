import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, Banknote, Users } from "lucide-react";
import type { Order } from "@workspace/api-client-react";

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: "Новая", className: "bg-blue-50 text-blue-700 border-blue-200" },
  open: { label: "Открыта", className: "bg-blue-50 text-blue-700 border-blue-200" },
  collecting_responses: { label: "Сбор откликов", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  engineer_selected: { label: "Инженер выбран", className: "bg-purple-50 text-purple-700 border-purple-200" },
  in_progress: { label: "В работе", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  completed: { label: "Завершена", className: "bg-green-50 text-green-700 border-green-200" },
  cancelled: { label: "Отменена", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

interface OrderCardProps {
  order: Order;
  showLink?: boolean;
}

export default function OrderCard({ order, showLink = true }: OrderCardProps) {
  const status = statusConfig[order.status] ?? { label: order.status, className: "bg-gray-100 text-gray-600" };

  const inner = (
    <Card className="hover:shadow-sm transition-shadow" data-testid={`card-order-${order.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate" data-testid={`text-order-title-${order.id}`}>{order.title}</h3>
              <Badge variant="outline" className={`text-xs flex-shrink-0 ${status.className}`} data-testid={`status-order-${order.id}`}>
                {status.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{order.description}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span data-testid={`text-order-region-${order.id}`}>{order.region}</span>
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Badge variant="secondary" className="text-xs px-1.5 py-0">{order.serviceType}</Badge>
          </span>
          {order.budget && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Banknote className="w-3 h-3" />
              <span data-testid={`text-order-budget-${order.id}`}>{order.budget.toLocaleString("ru-RU")} ₽</span>
            </span>
          )}
          {order.deadline && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span data-testid={`text-order-deadline-${order.id}`}>{order.deadline}</span>
            </span>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span data-testid={`text-order-bids-${order.id}`}>{order.bidCount} откликов</span>
          </span>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            {order.customer.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("ru-RU")}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (showLink) {
    return <Link href={`/orders/${order.id}`}>{inner}</Link>;
  }
  return inner;
}
