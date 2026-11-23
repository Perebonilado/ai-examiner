import { Module } from '@nestjs/common';
import { MailerModule as NodeMailerModule } from '@nestjs-modules/mailer';
import { MailerService } from './services/MailerService';
import { EnvironmentVariables } from 'src/EnvironmentVariables';;

@Module({
  imports: [
    NodeMailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: EnvironmentVariables.config.emailHost,
          // Defaults keep production as it was (implicit TLS); a local mail catcher can turn it off.
          secure: process.env.Email_secure !== 'false',
          ...(process.env.Email_port ? { port: Number(process.env.Email_port) } : {}),
          auth: {
            user: EnvironmentVariables.config.emailUser,
            pass: EnvironmentVariables.config.emailPass,
          },
        },
      }),
    }),
  ],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
