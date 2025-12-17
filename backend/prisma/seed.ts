import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

  const passwordHash = await argon2.hash(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Administrator',
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`Admin user created: ${admin.email}`);

  const webDevService = await prisma.service.upsert({
    where: { id: 'web-development-service' },
    update: {},
    create: {
      id: 'web-development-service',
      name: 'Web Development',
      description: 'Professional web development services including custom websites, web applications, and e-commerce solutions. Our team delivers responsive, modern, and SEO-friendly websites tailored to your business needs.',
      shortDescription: 'Custom websites and web applications',
      displayOrder: 1,
      isActive: true,
    },
  });

  await prisma.package.upsert({
    where: { id: 'web-basic-package' },
    update: {},
    create: {
      id: 'web-basic-package',
      serviceId: webDevService.id,
      name: 'Basic Website',
      description: 'Perfect for small businesses and personal portfolios. Includes up to 5 pages with responsive design.',
      price: 25000,
      currency: 'PKR',
      duration: '7-10 days',
      features: [
        'Up to 5 pages',
        'Responsive design',
        'Contact form',
        'Basic SEO',
        'Social media integration',
        '1 month support',
      ],
      displayOrder: 1,
      isActive: true,
    },
  });

  await prisma.package.upsert({
    where: { id: 'web-business-package' },
    update: {},
    create: {
      id: 'web-business-package',
      serviceId: webDevService.id,
      name: 'Business Website',
      description: 'Comprehensive solution for growing businesses. Includes CMS, blog, and advanced features.',
      price: 50000,
      currency: 'PKR',
      duration: '14-21 days',
      features: [
        'Up to 15 pages',
        'Custom CMS',
        'Blog integration',
        'Advanced SEO',
        'Analytics setup',
        'Email integration',
        '3 months support',
      ],
      isPopular: true,
      displayOrder: 2,
      isActive: true,
    },
  });

  await prisma.package.upsert({
    where: { id: 'web-ecommerce-package' },
    update: {},
    create: {
      id: 'web-ecommerce-package',
      serviceId: webDevService.id,
      name: 'E-Commerce Store',
      description: 'Full-featured online store with payment integration and inventory management.',
      price: 100000,
      currency: 'PKR',
      duration: '30-45 days',
      features: [
        'Unlimited products',
        'Payment gateway integration',
        'Inventory management',
        'Order tracking',
        'Customer accounts',
        'Advanced analytics',
        '6 months support',
      ],
      displayOrder: 3,
      isActive: true,
    },
  });

  const mobileService = await prisma.service.upsert({
    where: { id: 'mobile-app-service' },
    update: {},
    create: {
      id: 'mobile-app-service',
      name: 'Mobile App Development',
      description: 'Cross-platform mobile application development for iOS and Android. We build user-friendly apps that engage your customers and drive business growth.',
      shortDescription: 'iOS and Android app development',
      displayOrder: 2,
      isActive: true,
    },
  });

  await prisma.package.upsert({
    where: { id: 'mobile-starter-package' },
    update: {},
    create: {
      id: 'mobile-starter-package',
      serviceId: mobileService.id,
      name: 'Starter App',
      description: 'Simple mobile app with basic features for startups and MVPs.',
      price: 75000,
      currency: 'PKR',
      duration: '30-45 days',
      features: [
        'Cross-platform (iOS & Android)',
        'Up to 5 screens',
        'Basic authentication',
        'Push notifications',
        'App store submission',
        '2 months support',
      ],
      displayOrder: 1,
      isActive: true,
    },
  });

  await prisma.package.upsert({
    where: { id: 'mobile-pro-package' },
    update: {},
    create: {
      id: 'mobile-pro-package',
      serviceId: mobileService.id,
      name: 'Professional App',
      description: 'Feature-rich mobile app with backend integration and advanced functionality.',
      price: 200000,
      currency: 'PKR',
      duration: '60-90 days',
      features: [
        'Cross-platform (iOS & Android)',
        'Unlimited screens',
        'Custom backend API',
        'Real-time features',
        'Payment integration',
        'Analytics dashboard',
        'Admin panel',
        '6 months support',
      ],
      isPopular: true,
      displayOrder: 2,
      isActive: true,
    },
  });

  const designService = await prisma.service.upsert({
    where: { id: 'graphic-design-service' },
    update: {},
    create: {
      id: 'graphic-design-service',
      name: 'Graphic Design',
      description: 'Creative graphic design services including logo design, branding, marketing materials, and social media graphics.',
      shortDescription: 'Logo, branding, and marketing design',
      displayOrder: 3,
      isActive: true,
    },
  });

  await prisma.package.upsert({
    where: { id: 'design-logo-package' },
    update: {},
    create: {
      id: 'design-logo-package',
      serviceId: designService.id,
      name: 'Logo Design',
      description: 'Professional logo design with multiple concepts and revisions.',
      price: 10000,
      currency: 'PKR',
      duration: '5-7 days',
      features: [
        '3 initial concepts',
        'Unlimited revisions',
        'All file formats',
        'Brand color palette',
        'Business card design',
      ],
      displayOrder: 1,
      isActive: true,
    },
  });

  await prisma.package.upsert({
    where: { id: 'design-branding-package' },
    update: {},
    create: {
      id: 'design-branding-package',
      serviceId: designService.id,
      name: 'Complete Branding',
      description: 'Full brand identity package including logo, guidelines, and marketing materials.',
      price: 35000,
      currency: 'PKR',
      duration: '14-21 days',
      features: [
        'Logo design',
        'Brand guidelines',
        'Business cards',
        'Letterhead & envelope',
        'Social media kit',
        'Email signature',
        'Presentation template',
      ],
      isPopular: true,
      displayOrder: 2,
      isActive: true,
    },
  });

  console.log('Services and packages created');

  await prisma.paymentConfig.upsert({
    where: { method: 'EASYPAISA' },
    update: {},
    create: {
      method: 'EASYPAISA',
      accountTitle: 'Your Business Name',
      accountNumber: '03001234567',
      instructions: 'Send payment to this EasyPaisa account and share the screenshot.',
      isActive: true,
    },
  });

  await prisma.paymentConfig.upsert({
    where: { method: 'JAZZCASH' },
    update: {},
    create: {
      method: 'JAZZCASH',
      accountTitle: 'Your Business Name',
      accountNumber: '03001234567',
      instructions: 'Send payment to this JazzCash account and share the screenshot.',
      isActive: true,
    },
  });

  await prisma.paymentConfig.upsert({
    where: { method: 'BANK_TRANSFER' },
    update: {},
    create: {
      method: 'BANK_TRANSFER',
      accountTitle: 'Your Business Name',
      accountNumber: '1234567890123',
      bankName: 'HBL - Habib Bank Limited',
      instructions: 'Transfer to this bank account and share the receipt.',
      isActive: true,
    },
  });

  console.log('Payment configurations created');

  await prisma.systemPrompt.upsert({
    where: { name: 'default' },
    update: {},
    create: {
      name: 'default',
      content: `You are a friendly and professional sales assistant for a digital services company on WhatsApp.

Your primary responsibilities:
1. Greet customers warmly and make them feel welcome
2. Understand their requirements by asking relevant questions
3. Recommend the most suitable services and packages based on their needs
4. Explain features and benefits clearly
5. Guide them through the ordering and payment process
6. Provide helpful support and answer questions

IMPORTANT GUIDELINES:
- ONLY recommend services and packages that are explicitly listed in the system
- NEVER invent, suggest, or imply services that don't exist
- NEVER modify prices or offer unauthorized discounts
- If a customer asks for something we don't offer, politely explain our available services
- Always be honest about delivery timelines and what's included
- Use simple, clear language that's easy to understand
- Be patient and helpful, even with repetitive questions
- Confirm all order details before processing

CONVERSATION STYLE:
- Be friendly but professional
- Use appropriate emojis sparingly to add warmth
- Keep messages concise and easy to read
- Break long information into multiple messages if needed
- Always end with a clear next step or question`,
      description: 'Default system prompt for AI conversations',
      isActive: true,
    },
  });

  console.log('System prompt created');

  await prisma.messageTemplate.upsert({
    where: { name: 'welcome' },
    update: {},
    create: {
      name: 'welcome',
      content: `Hello! 👋 Welcome to our services!

I'm here to help you find the perfect solution for your needs.

We offer:
🌐 Web Development
📱 Mobile App Development
🎨 Graphic Design

What are you looking for today?`,
      variables: [],
      description: 'Welcome message for new customers',
      category: 'greeting',
      isActive: true,
    },
  });

  await prisma.messageTemplate.upsert({
    where: { name: 'payment_received' },
    update: {},
    create: {
      name: 'payment_received',
      content: `Thank you! 🙏 We've received your payment screenshot for Order #{orderNumber}.

Our team will verify it shortly (usually within 30 minutes during business hours).

You'll receive a confirmation once the payment is verified. ✅`,
      variables: ['orderNumber'],
      description: 'Message sent when payment proof is received',
      category: 'payment',
      isActive: true,
    },
  });

  await prisma.messageTemplate.upsert({
    where: { name: 'payment_confirmed' },
    update: {},
    create: {
      name: 'payment_confirmed',
      content: `✅ Payment Confirmed!

Your payment for Order #{orderNumber} has been verified successfully.

Package: {packageName}
Amount: {currency} {amount}

Our team will start working on your project and keep you updated on progress.

Thank you for choosing us! 🎉`,
      variables: ['orderNumber', 'packageName', 'currency', 'amount'],
      description: 'Message sent when payment is confirmed',
      category: 'payment',
      isActive: true,
    },
  });

  await prisma.messageTemplate.upsert({
    where: { name: 'order_completed' },
    update: {},
    create: {
      name: 'order_completed',
      content: `🎉 Your Order is Complete!

Order #{orderNumber} for {packageName} has been completed successfully.

We hope you're satisfied with our work! If you have any questions or need any changes, please let us know.

Thank you for your business! We'd love to work with you again. ⭐`,
      variables: ['orderNumber', 'packageName'],
      description: 'Message sent when order is completed',
      category: 'order',
      isActive: true,
    },
  });

  console.log('Message templates created');

  const whatsappAccount = await prisma.whatsAppAccount.upsert({
    where: { id: 'default-whatsapp-account' },
    update: {},
    create: {
      id: 'default-whatsapp-account',
      name: 'Main Business Account',
      isDefault: true,
      status: 'DISCONNECTED',
    },
  });

  console.log(`WhatsApp account created: ${whatsappAccount.name}`);

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📝 Important Information:');
  console.log(`   Admin Email: ${adminEmail}`);
  console.log(`   Admin Password: ${adminPassword}`);
  console.log('\n⚠️  Please change the admin password after first login!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
