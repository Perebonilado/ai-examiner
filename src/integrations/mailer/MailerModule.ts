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
          secure: true,
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
