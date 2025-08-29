import { Module } from '@nestjs/common';
import { GEMINI_CONN, GeminiConn } from './services/GeminiConn';
import { OPENAI_CONN, OpenAIConn } from './services/OpenAIConn';

@Module({
  providers: [
    {
      provide: GEMINI_CONN,
      useClass: GeminiConn,
    },
    {
      provide: OPENAI_CONN,
      useClass: OpenAIConn,
    },
  ],
  exports: [GEMINI_CONN, OPENAI_CONN],
})
export class VercelAIModule {}
