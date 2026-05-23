import './config/load-env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { getEnv, validateEnv } from './config/load-env';

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('QR Menus API')
    .setDescription(
      'Multi-tenant menu SaaS API for platform/admin users, public menus, and table QR flows.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('qr_refresh_token')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Tenant-Id',
        in: 'header',
        description: 'Selected tenant id for tenant-scoped admin routes.',
      },
      'tenant-id',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const allowedOrigins = getEnv('FRONTEND_URL')
    .split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    credentials: true,
    origin: allowedOrigins,
  });
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
