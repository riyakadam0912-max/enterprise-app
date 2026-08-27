import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { createNestApp } from './create-nest-app';

async function bootstrap() {
  const PORT = Number(process.env.PORT ?? 3000);

  const app = await createNestApp();

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Enterprise API')
      .setDescription('ERP CRM API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      jsonDocumentUrl: 'api-json',
      useGlobalPrefix: false,
      swaggerOptions: { persistAuthorization: true },
    });
  }

  let isClosing = false;
  const closeApp = async (signal: string) => {
    if (isClosing) {
      return;
    }

    isClosing = true;
    console.log(`Received ${signal}. Closing application gracefully...`);

    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGINT', () => {
    void closeApp('SIGINT');
  });

  process.once('SIGTERM', () => {
    void closeApp('SIGTERM');
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    void app.close().finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    void app.close().finally(() => process.exit(1));
  });

  await app.listen(PORT);

  console.log(`[API] Running on port ${PORT}`);
  console.log('[EVENTS] Event bus initialized');

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[API] Swagger docs: http://localhost:${PORT}/api`);
  }
}

bootstrap().catch((error) => {
  console.error('[API] Startup failed:', error);
  process.exit(1);
});
