import { db } from "@workspace/db";
import { usersTable, engineersTable, ordersTable, bidsTable, reviewsTable } from "@workspace/db";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  const hash = (pw: string) => bcrypt.hash(pw, 10);

  // Create admin
  const [admin] = await db.insert(usersTable).values({
    name: "Администратор",
    email: "admin@kadastr.pro",
    passwordHash: await hash("admin123"),
    role: "admin",
    phone: "+7 (495) 000-00-00",
  }).onConflictDoNothing().returning();

  // Create customers
  const customers = await Promise.all([
    db.insert(usersTable).values({
      name: "Мария Иванова",
      email: "maria@example.com",
      passwordHash: await hash("password123"),
      role: "customer",
      phone: "+7 (916) 111-22-33",
    }).onConflictDoNothing().returning(),
    db.insert(usersTable).values({
      name: "Сергей Петров",
      email: "sergey@example.com",
      passwordHash: await hash("password123"),
      role: "customer",
      phone: "+7 (903) 444-55-66",
    }).onConflictDoNothing().returning(),
    db.insert(usersTable).values({
      name: "Елена Смирнова",
      email: "elena@example.com",
      passwordHash: await hash("password123"),
      role: "customer",
      phone: "+7 (926) 777-88-99",
    }).onConflictDoNothing().returning(),
  ]);

  // Create engineer users
  const engineerUsers = await Promise.all([
    db.insert(usersTable).values({
      name: "Дмитрий Козлов",
      email: "dmitry@kadastr.pro",
      passwordHash: await hash("engineer123"),
      role: "engineer",
      phone: "+7 (499) 123-45-67",
    }).onConflictDoNothing().returning(),
    db.insert(usersTable).values({
      name: "Анна Новикова",
      email: "anna@kadastr.pro",
      passwordHash: await hash("engineer123"),
      role: "engineer",
      phone: "+7 (495) 234-56-78",
    }).onConflictDoNothing().returning(),
    db.insert(usersTable).values({
      name: "Алексей Морозов",
      email: "alexey@kadastr.pro",
      passwordHash: await hash("engineer123"),
      role: "engineer",
      phone: "+7 (977) 345-67-89",
    }).onConflictDoNothing().returning(),
    db.insert(usersTable).values({
      name: "Ольга Волкова",
      email: "olga@kadastr.pro",
      passwordHash: await hash("engineer123"),
      role: "engineer",
      phone: "+7 (916) 456-78-90",
    }).onConflictDoNothing().returning(),
    db.insert(usersTable).values({
      name: "Игорь Зайцев",
      email: "igor@kadastr.pro",
      passwordHash: await hash("engineer123"),
      role: "engineer",
      phone: "+7 (903) 567-89-01",
    }).onConflictDoNothing().returning(),
    db.insert(usersTable).values({
      name: "Светлана Лебедева",
      email: "svetlana@kadastr.pro",
      passwordHash: await hash("engineer123"),
      role: "engineer",
      phone: "+7 (926) 678-90-12",
    }).onConflictDoNothing().returning(),
  ]);

  // Filter out empty results (on conflict do nothing)
  const validEngUsers = engineerUsers.map(r => r[0]).filter(Boolean);

  // Create engineer profiles
  const engineerData = [
    {
      registryNumber: "77-13-01-2019-001",
      specializations: JSON.stringify(["Межевание", "Техплан", "Кадастровый паспорт"]),
      region: "Москва",
      experience: 8,
      bio: "Кадастровый инженер с 8-летним опытом работы в Москве и Московской области. Специализируюсь на межевании земельных участков и подготовке технических планов для жилых и нежилых объектов.",
      rating: 4.9,
      reviewCount: 47,
      completedOrders: 124,
      isVerified: true,
    },
    {
      registryNumber: "78-25-02-2020-015",
      specializations: JSON.stringify(["Постановка на учёт", "Снятие с учёта", "Оценка"]),
      region: "Санкт-Петербург",
      experience: 6,
      bio: "Специализируюсь на постановке и снятии объектов с кадастрового учёта. Более 6 лет практики в Санкт-Петербурге. Все документы оформляю строго в установленные сроки.",
      rating: 4.7,
      reviewCount: 32,
      completedOrders: 89,
      isVerified: true,
    },
    {
      registryNumber: "50-14-03-2018-007",
      specializations: JSON.stringify(["Межевание", "Оценка"]),
      region: "Московская область",
      experience: 11,
      bio: "Опытный кадастровый инженер с 11-летней практикой. Работаю в Московской области: Балашиха, Химки, Пушкино, Мытищи. Гарантирую точность и юридическую чистоту документов.",
      rating: 4.8,
      reviewCount: 61,
      completedOrders: 187,
      isVerified: true,
    },
    {
      registryNumber: "23-08-04-2021-003",
      specializations: JSON.stringify(["Техплан", "Кадастровый паспорт", "Постановка на учёт"]),
      region: "Краснодарский край",
      experience: 4,
      bio: "Молодой специалист с активной практикой в Краснодарском крае. Работаю быстро и качественно, на связи 24/7. Выезжаю в Краснодар, Сочи, Новороссийск.",
      rating: 4.5,
      reviewCount: 18,
      completedOrders: 43,
      isVerified: true,
    },
    {
      registryNumber: "16-07-05-2017-022",
      specializations: JSON.stringify(["Межевание", "Техплан", "Снятие с учёта"]),
      region: "Татарстан",
      experience: 14,
      bio: "Главный кадастровый инженер проектного бюро. 14 лет опыта, более 500 успешных проектов. Веду сложные случаи: споры о границах, разделение участков, объединение.",
      rating: 4.6,
      reviewCount: 89,
      completedOrders: 312,
      isVerified: true,
    },
    {
      registryNumber: "66-19-06-2022-011",
      specializations: JSON.stringify(["Оценка", "Кадастровый паспорт"]),
      region: "Свердловская область",
      experience: 3,
      bio: "Специалист по оценке недвижимости и кадастровым услугам в Екатеринбурге. Помогу получить кадастровый паспорт в кратчайшие сроки.",
      rating: 4.4,
      reviewCount: 12,
      completedOrders: 28,
      isVerified: false,
    },
  ];

  const engineers: (typeof engineersTable.$inferSelect)[] = [];
  for (let i = 0; i < Math.min(validEngUsers.length, engineerData.length); i++) {
    const user = validEngUsers[i];
    if (!user) continue;
    const data = engineerData[i];
    const [eng] = await db.insert(engineersTable).values({
      userId: user.id,
      ...data,
    }).onConflictDoNothing().returning();
    if (eng) engineers.push(eng);
  }

  // Create orders
  const validCustomers = customers.map(r => r[0]).filter(Boolean);
  if (validCustomers.length === 0) {
    console.log("No customers created, skipping orders");
    console.log("✅ Seed complete!");
    process.exit(0);
  }

  const orderData = [
    {
      customerId: validCustomers[0]?.id ?? 1,
      title: "Межевание земельного участка в Подмосковье",
      description: "Нужно провести межевание земельного участка 15 соток в Серпуховском районе МО. Есть старый план, нужно уточнить границы и подготовить документы для Росреестра.",
      serviceType: "Межевание",
      region: "Московская область",
      budget: 25000,
      deadline: "30 июля 2024",
      status: "open",
      bidCount: 3,
    },
    {
      customerId: validCustomers[1]?.id ?? 2,
      title: "Технический план для квартиры после перепланировки",
      description: "Сделали перепланировку квартиры 68 кв.м. в новостройке. Нужен технический план для согласования перепланировки и внесения изменений в ЕГРН.",
      serviceType: "Техплан",
      region: "Москва",
      budget: 15000,
      deadline: "15 августа 2024",
      status: "open",
      bidCount: 5,
    },
    {
      customerId: validCustomers[2]?.id ?? 3,
      title: "Постановка на кадастровый учёт жилого дома",
      description: "Построили жилой дом 150 кв.м. на участке ИЖС. Нужна постановка на кадастровый учёт и регистрация права собственности. Дом двухэтажный, есть проект.",
      serviceType: "Постановка на учёт",
      region: "Краснодарский край",
      budget: 35000,
      deadline: "1 сентября 2024",
      status: "in_progress",
      bidCount: 2,
    },
    {
      customerId: validCustomers[0]?.id ?? 1,
      title: "Кадастровый паспорт на гараж",
      description: "Нужен кадастровый паспорт на гараж в гаражном кооперативе. Гараж 24 кв.м., документов нет, нужно всё сделать с нуля.",
      serviceType: "Кадастровый паспорт",
      region: "Санкт-Петербург",
      budget: 8000,
      status: "open",
      bidCount: 1,
    },
    {
      customerId: validCustomers[1]?.id ?? 2,
      title: "Оценка коммерческой недвижимости для банка",
      description: "Требуется независимая оценка офисного помещения 240 кв.м. для получения кредита в банке. Нужен отчёт об оценке по стандартам ФСО.",
      serviceType: "Оценка",
      region: "Москва",
      budget: 45000,
      deadline: "20 июля 2024",
      status: "open",
      bidCount: 4,
    },
    {
      customerId: validCustomers[2]?.id ?? 3,
      title: "Снятие с учёта снесённого строения",
      description: "Снесли старый сарай на участке. Нужно снять его с кадастрового учёта. Есть документы на строение.",
      serviceType: "Снятие с учёта",
      region: "Татарстан",
      budget: 10000,
      status: "completed",
      bidCount: 3,
    },
  ];

  const orders: (typeof ordersTable.$inferSelect)[] = [];
  for (const od of orderData) {
    const [order] = await db.insert(ordersTable).values(od as typeof ordersTable.$inferInsert).onConflictDoNothing().returning();
    if (order) orders.push(order);
  }

  // Create some bids and reviews
  if (engineers.length > 0 && orders.length > 0) {
    // Bid on first order
    await db.insert(bidsTable).values({
      orderId: orders[0]?.id ?? 1,
      engineerId: engineers[0]?.id ?? 1,
      message: "Готов выполнить межевание в кратчайшие сроки. Работаю в Серпуховском районе, выезд возможен уже на следующей неделе.",
      price: 22000,
      status: "pending",
    }).onConflictDoNothing();

    if (engineers.length > 1) {
      await db.insert(bidsTable).values({
        orderId: orders[0]?.id ?? 1,
        engineerId: engineers[1]?.id ?? 2,
        message: "Опыт работы в Подмосковье — более 5 лет. Могу выехать в любой день. Стоимость включает оформление всех документов.",
        price: 24000,
        status: "pending",
      }).onConflictDoNothing();
    }

    // Reviews for first engineer
    if (validCustomers[0] && engineers[0]) {
      await db.insert(reviewsTable).values({
        orderId: orders[5]?.id ?? 1,
        engineerId: engineers[0].id,
        authorId: validCustomers[0].id,
        rating: 5,
        comment: "Отличная работа! Всё сделано быстро и профессионально. Рекомендую!",
      }).onConflictDoNothing();
    }

    if (validCustomers[1] && engineers[0]) {
      await db.insert(reviewsTable).values({
        orderId: orders[1]?.id ?? 2,
        engineerId: engineers[0].id,
        authorId: validCustomers[1].id,
        rating: 5,
        comment: "Дмитрий — настоящий профессионал. Всё объяснил, помог с документами. Спасибо!",
      }).onConflictDoNothing();
    }
  }

  console.log(`✅ Seeded: ${validEngUsers.length} engineers, ${validCustomers.length} customers, ${orders.length} orders`);
  console.log("");
  console.log("Test accounts:");
  console.log("  Admin:    admin@kadastr.pro / admin123");
  console.log("  Customer: maria@example.com / password123");
  console.log("  Engineer: dmitry@kadastr.pro / engineer123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
