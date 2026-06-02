import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MapPin, User, HardHat } from "lucide-react";

const schema = z.object({
  name: z.string().min(2, "Минимум 2 символа"),
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Минимум 6 символов"),
  role: z.enum(["customer", "engineer"]),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", role: "customer", phone: "" },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        if (data.user.role === "engineer") setLocation("/dashboard/engineer");
        else setLocation("/dashboard/customer");
      },
      onError: (error: unknown) => {
        const message = (error as { data?: { error?: string } })?.data?.error ?? "Ошибка при регистрации";
        toast({ title: "Ошибка", description: message, variant: "destructive" });
      },
    },
  });

  const onSubmit = (values: FormValues) => {
    registerMutation.mutate({ data: { ...values, phone: values.phone || undefined } });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold">КадастрПро</span>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Регистрация</CardTitle>
            <CardDescription>Создайте аккаунт, чтобы начать работу</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Я регистрируюсь как</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-2 gap-3"
                          data-testid="radio-role"
                        >
                          <label className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer transition-colors ${field.value === "customer" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                            <RadioGroupItem value="customer" className="sr-only" />
                            <User className="w-4 h-4 text-primary" />
                            <div>
                              <div className="font-medium text-sm">Заказчик</div>
                              <div className="text-xs text-muted-foreground">Размещаю заявки</div>
                            </div>
                          </label>
                          <label className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer transition-colors ${field.value === "engineer" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                            <RadioGroupItem value="engineer" className="sr-only" />
                            <HardHat className="w-4 h-4 text-primary" />
                            <div>
                              <div className="font-medium text-sm">Инженер</div>
                              <div className="text-xs text-muted-foreground">Выполняю заказы</div>
                            </div>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Полное имя</FormLabel>
                      <FormControl>
                        <Input placeholder="Иван Петров" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="ivan@example.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон (необязательно)</FormLabel>
                      <FormControl>
                        <Input placeholder="+7 (999) 123-45-67" {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пароль</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Минимум 6 символов" {...field} data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={registerMutation.isPending} data-testid="button-register">
                  {registerMutation.isPending ? "Регистрация..." : "Зарегистрироваться"}
                </Button>
              </form>
            </Form>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Уже есть аккаунт?{" "}
              <Link href="/auth/login" className="text-primary hover:underline" data-testid="link-login">
                Войти
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
