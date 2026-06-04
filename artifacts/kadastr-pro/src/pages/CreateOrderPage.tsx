import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, FileText, Send } from "lucide-react";

const SERVICE_TYPES = ["Межевание", "Техплан", "Кадастровый паспорт", "Постановка на учёт", "Снятие с учёта", "Оценка", "Другое"];
const REGIONS = ["Москва", "Санкт-Петербург", "Московская область", "Краснодарский край", "Татарстан", "Свердловская область", "Новосибирская область", "Другой"];

const schema = z.object({
  title: z.string().min(5, "Минимум 5 символов"),
  description: z.string().min(20, "Минимум 20 символов"),
  serviceType: z.string().min(1, "Выберите тип услуги"),
  region: z.string().min(1, "Выберите регион"),
  budget: z.string().optional(),
  deadline: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CreateOrderPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitType, setSubmitType] = useState<"publish" | "draft">("publish");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", serviceType: "", region: "", budget: "", deadline: "" },
  });

  const createOrder = useCreateOrder({
    mutation: {
      onSuccess: (order) => {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        if (order.status === "draft") {
          toast({ title: "Черновик сохранён", description: "Опубликуйте заявку, когда будете готовы" });
        } else {
          toast({ title: "Заявка размещена", description: "Ожидайте откликов от инженеров" });
        }
        setLocation("/dashboard/customer");
      },
      onError: () => toast({ title: "Ошибка", description: "Не удалось разместить заявку", variant: "destructive" }),
    },
  });

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold mb-2">Войдите, чтобы разместить заявку</h2>
        <Button onClick={() => setLocation("/auth/login")} data-testid="button-login-redirect">Войти</Button>
      </div>
    );
  }

  const onSubmit = (values: FormValues) => {
    createOrder.mutate({
      data: {
        title: values.title,
        description: values.description,
        serviceType: values.serviceType,
        region: values.region,
        budget: values.budget ? parseFloat(values.budget) : undefined,
        deadline: values.deadline || undefined,
        asDraft: submitType === "draft",
      },
    });
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-create-order">Разместить заявку</h1>
        <p className="text-muted-foreground">Опишите задачу и получите отклики от проверенных инженеров</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название заявки</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: Межевание земельного участка в СНТ" {...field} data-testid="input-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Подробно опишите задачу: площадь участка, наличие документов, особые требования..."
                        rows={5}
                        {...field}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип услуги</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-service-type">
                            <SelectValue placeholder="Выберите услугу" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SERVICE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Регион</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-region">
                            <SelectValue placeholder="Выберите регион" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Бюджет (₽, необязательно)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="15000" {...field} data-testid="input-budget" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Срок (необязательно)</FormLabel>
                      <FormControl>
                        <Input placeholder="до 30 июня" {...field} data-testid="input-deadline" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  className="flex-1 gap-1.5"
                  disabled={createOrder.isPending}
                  onClick={() => setSubmitType("publish")}
                  data-testid="button-submit-order"
                >
                  <Send className="w-4 h-4" />
                  {createOrder.isPending && submitType === "publish" ? "Размещаем..." : "Разместить заявку"}
                </Button>
                <Button
                  type="submit"
                  variant="outline"
                  className="gap-1.5"
                  disabled={createOrder.isPending}
                  onClick={() => setSubmitType("draft")}
                  data-testid="button-save-draft"
                >
                  <FileText className="w-4 h-4" />
                  {createOrder.isPending && submitType === "draft" ? "Сохраняем..." : "Черновик"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
