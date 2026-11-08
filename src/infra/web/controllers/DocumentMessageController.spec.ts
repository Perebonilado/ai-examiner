import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as request from 'supertest';
import { AuthGuard } from 'src/infra/auth/guards/AuthGuard';
import { DocumentMessageQueryService } from 'src/query/services/DocumentMessageQueryService';
import { DocumentChatService } from '../services/document-chat/DocumentChatService';
import { DocumentMessageController } from './DocumentMessageController';

const parseEvents = (body: string) =>
  body
    .split('\n\n')
    .filter((block) => block.startsWith('event:'))
    .map((block) => {
      const [eventLine, dataLine] = block.split('\n');
      return {
        event: eventLine.replace('event: ', ''),
        data: JSON.parse(dataLine.replace('data: ', '')),
      };
    });

describe('DocumentMessageController', () => {
  let app: INestApplication;
  const chat = {
    findDocument: jest.fn(),
    reply: jest.fn(),
  };
  const messages = { findDocumentMessagesByCourseDocumentId: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DocumentMessageController],
      providers: [
        { provide: DocumentChatService, useValue: chat },
        { provide: DocumentMessageQueryService, useValue: messages },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().user = { sub: 'user-1' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    chat.findDocument.mockResolvedValue({ id: 'doc-1', title: 'Doc' });
  });

  it('streams the reply as server-sent events', async () => {
    chat.reply.mockImplementation(async ({ sink }) => {
      sink.meta({ mode: 'passages', pages: [3, 12] });
      sink.thinking();
      sink.text('Hello ');
      sink.text('**world**\n\nNext');
      return {
        status: 'done',
        text: 'Hello **world**\n\nNext',
        messageId: 'm-1',
      };
    });

    const res = await request(app.getHttpServer())
      .post('/document-message/stream')
      .send({
        message: 'What is ATP?',
        courseDocumentId: 'doc-1',
        language: 'es',
      })
      .buffer(true)
      .parse((response, done) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => done(null, body));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-transform');
    expect(res.headers['x-accel-buffering']).toBe('no');
    expect(parseEvents(res.body)).toEqual([
      { event: 'meta', data: { mode: 'passages', pages: [3, 12] } },
      { event: 'thinking', data: {} },
      { event: 'delta', data: { text: 'Hello ' } },
      { event: 'delta', data: { text: '**world**\n\nNext' } },
      { event: 'done', data: { status: 'done', messageId: 'm-1' } },
    ]);

    expect(chat.findDocument).toHaveBeenCalledWith('doc-1', 'user-1');
    const call = chat.reply.mock.calls[0][0];
    expect(call.userId).toBe('user-1');
    expect(call.retry).toBe(false);
    expect(call.request).toEqual({ message: 'What is ATP?', language: 'es' });
  });

  it('sends the notice to show when a reply is refused', async () => {
    chat.reply.mockResolvedValue({
      status: 'refused',
      text: 'Sorry',
      messageId: 'm-2',
    });
    const res = await request(app.getHttpServer())
      .post('/document-message/stream')
      .send({ message: 'x', courseDocumentId: 'doc-1', retry: true })
      .buffer(true)
      .parse((response, done) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => done(null, body));
      });
    expect(parseEvents(res.body)).toEqual([
      {
        event: 'done',
        data: { status: 'refused', messageId: 'm-2', text: 'Sorry' },
      },
    ]);
    expect(chat.reply.mock.calls[0][0].retry).toBe(true);
  });

  it('ends with an error event when the reply fails mid-way', async () => {
    chat.reply.mockImplementation(async ({ sink }) => {
      sink.text('Partial');
      throw new Error('overloaded');
    });
    const res = await request(app.getHttpServer())
      .post('/document-message/stream')
      .send({ message: 'x', courseDocumentId: 'doc-1' })
      .buffer(true)
      .parse((response, done) => {
        let body = '';
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => done(null, body));
      });
    const events = parseEvents(res.body);
    expect(events[0]).toEqual({ event: 'delta', data: { text: 'Partial' } });
    expect(events[1].event).toBe('error');
    expect(events[1].data.message).toContain('try again');
  });

  it('answers a bad request with JSON, before streaming', async () => {
    const res = await request(app.getHttpServer())
      .post('/document-message/stream')
      .send({ message: '   ', courseDocumentId: 'doc-1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBeTruthy();
    expect(chat.reply).not.toHaveBeenCalled();
  });

  it("answers someone else's document with a 404", async () => {
    chat.findDocument.mockRejectedValue(
      new NotFoundException('Document not found'),
    );
    const res = await request(app.getHttpServer())
      .post('/document-message/stream')
      .send({ message: 'hi', courseDocumentId: 'not-mine' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Document not found' });
    expect(chat.reply).not.toHaveBeenCalled();
  });

  it('stops generating when the app disconnects', async () => {
    let signal: AbortSignal | undefined;
    let finished: () => void = () => {};
    const replyDone = new Promise<void>((resolve) => (finished = resolve));
    chat.reply.mockImplementation(async (args) => {
      signal = args.signal;
      args.sink.text('Started');
      await new Promise<void>((resolve) =>
        args.signal.addEventListener('abort', () => resolve()),
      );
      finished();
      return { status: 'stopped', text: 'Started' };
    });

    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          port,
          method: 'POST',
          path: '/document-message/stream',
          headers: { 'content-type': 'application/json' },
        },
        (res) => {
          res.once('data', () => {
            // First piece arrived: hang up, like pressing Stop.
            req.destroy();
            resolve();
          });
        },
      );
      req.on('error', () => {});
      req.end(
        JSON.stringify({ message: 'Explain', courseDocumentId: 'doc-1' }),
      );
      setTimeout(() => reject(new Error('no data')), 3000);
    });

    await replyDone;
    expect(signal?.aborted).toBe(true);
  });

  it('keeps the JSON endpoint for apps that do not stream', async () => {
    chat.reply.mockResolvedValue({
      status: 'done',
      text: 'Answer',
      messageId: 'm',
    });
    const res = await request(app.getHttpServer())
      .post('/document-message')
      .send({ message: 'Q', courseDocumentId: 'doc-1' });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ systemResponse: 'Answer' });
  });

  it('only lets the owner read a chat', async () => {
    chat.findDocument.mockRejectedValue(
      new NotFoundException('Document not found'),
    );
    const res = await request(app.getHttpServer()).get(
      '/document-message/someone-elses-doc?limit=4',
    );
    expect(res.status).toBe(404);
    expect(
      messages.findDocumentMessagesByCourseDocumentId,
    ).not.toHaveBeenCalled();
  });

  it('returns the owner their chat, with a sensible page size', async () => {
    messages.findDocumentMessagesByCourseDocumentId.mockResolvedValue({
      data: [],
      totalCount: 0,
    });
    const res = await request(app.getHttpServer()).get(
      '/document-message/doc-1?limit=5000',
    );
    expect(res.status).toBe(200);
    expect(chat.findDocument).toHaveBeenCalledWith('doc-1', 'user-1');
    expect(
      messages.findDocumentMessagesByCourseDocumentId.mock.calls[0][0].limit,
    ).toBe(50);
  });
});
