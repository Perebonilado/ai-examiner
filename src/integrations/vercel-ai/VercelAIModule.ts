import { Module } from '@nestjs/common';
import { GEMINI_CONN, GeminiConn } from './services/GeminiConn';
import { OPENAI_CONN, OpenAIConn } from './services/OpenAIConn';
import { CLAUDE_CONN, ClaudeConn } from './services/ClaudeConn';

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
    {
      provide: CLAUDE_CONN,
      useClass: ClaudeConn,
    },
  ],
  exports: [GEMINI_CONN, OPENAI_CONN, CLAUDE_CONN],
})
export class VercelAIModule {}
