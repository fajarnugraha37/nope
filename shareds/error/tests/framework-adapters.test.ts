import { describe, test, expect, mock } from 'bun:test';
import { AppError } from '../src/app-error';
import { expressErrorHandler, asyncHandler } from '../src/adapters/express';
import { fastifyErrorHandler } from '../src/adapters/fastify';
import { koaErrorMiddleware } from '../src/adapters/koa';
import { honoErrorHandler } from '../src/adapters/hono';
import { h3ErrorHandler, createH3Error } from '../src/adapters/h3';
import { elysiaErrorHandler } from '../src/adapters/elysia';

describe('Express Adapter', () => {
  test('asyncHandler wraps async function', async () => {
    const handler = asyncHandler(async (req, res) => {
      res.status(200).json({ success: true });
    });

    const req = {} as any;
    const res = {
      status: mock((code: number) => res),
      json: mock((data: any) => res),
    } as any;
    const next = mock();

    await handler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(next).not.toHaveBeenCalled();
  });

  test('asyncHandler catches errors and passes to next', async () => {
    const error = new AppError('TEST', 'test error');
    const handler = asyncHandler(async () => {
      throw error;
    });

    const next = mock();
    await handler({} as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(error);
  });

  test('expressErrorHandler sets status and returns problem JSON', () => {
    const error = new AppError('TEST', 'test error', { status: 400 });
    const req = {} as any;
    const res = {
      status: mock((code: number) => res),
      json: mock((data: any) => res),
    } as any;
    const next = mock();

    const handler = expressErrorHandler();
    handler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.type).toBe('urn:error:TEST');
    expect(jsonCall.title).toBe('TEST');
    expect(jsonCall.detail).toBe('test error');
  });

  test('expressErrorHandler handles non-AppError', () => {
    const error = new Error('plain error');
    const res = {
      status: mock((code: number) => res),
      json: mock((data: any) => res),
    } as any;

    const handler = expressErrorHandler();
    handler(error, {} as any, res, mock());

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('Fastify Adapter', () => {
  test('fastifyErrorHandler registers error handler', () => {
    const mockSetErrorHandler = mock();
    const fastify = {
      setErrorHandler: mockSetErrorHandler,
    } as any;

    fastifyErrorHandler(fastify);

    expect(mockSetErrorHandler).toHaveBeenCalled();
    expect(typeof mockSetErrorHandler.mock.calls[0][0]).toBe('function');
  });

  test('fastifyErrorHandler throws on invalid instance', () => {
    expect(() => fastifyErrorHandler(null as any)).toThrow('Invalid Fastify instance');
    expect(() => fastifyErrorHandler({} as any)).toThrow('Invalid Fastify instance');
  });

  test('registered handler returns problem JSON', () => {
    let registeredHandler: any;
    const fastify = {
      setErrorHandler: (handler: any) => {
        registeredHandler = handler;
      },
    } as any;

    fastifyErrorHandler(fastify);

    const error = new AppError('TEST', 'test error', { status: 404 });
    const reply = {
      status: mock((code: number) => reply),
      type: mock((contentType: string) => reply),
      send: mock((data: any) => reply),
    } as any;

    registeredHandler(error, {} as any, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.type).toHaveBeenCalledWith('application/problem+json');
    expect(reply.send).toHaveBeenCalled();
    const sendCall = reply.send.mock.calls[0][0];
    expect(sendCall.title).toBe('TEST');
    expect(sendCall.detail).toBe('test error');
  });
});

describe('Koa Adapter', () => {
  test('koaErrorMiddleware catches and converts errors', async () => {
    const error = new AppError('TEST', 'test error', { status: 403 });
    const middleware = koaErrorMiddleware();

    const ctx = {
      status: 200,
      body: null,
      type: '',
      app: { emit: mock() },
    } as any;

    const next = async () => {
      throw error;
    };

    await middleware(ctx, next);

    expect(ctx.status).toBe(403);
    expect(ctx.body).toBeDefined();
    expect(ctx.body.title).toBe('TEST');
    expect(ctx.body.detail).toBe('test error');
    expect(ctx.app.emit).toHaveBeenCalledWith('error', error, ctx);
  });

  test('koaErrorMiddleware passes through success', async () => {
    const middleware = koaErrorMiddleware();
    const ctx = {
      status: 200,
      body: { success: true },
    } as any;
    const next = async () => {
      // success case
    };

    await middleware(ctx, next);

    expect(ctx.status).toBe(200);
    expect(ctx.body).toEqual({ success: true });
  });

  test('koaErrorMiddleware handles non-AppError', async () => {
    const middleware = koaErrorMiddleware();
    const ctx = {
      status: 200,
      body: null,
      type: '',
      app: { emit: mock() },
    } as any;
    const next = async () => {
      throw new Error('plain error');
    };

    await middleware(ctx, next);

    expect(ctx.status).toBe(500);
    expect(ctx.body).toBeDefined();
  });
});

describe('Hono Adapter', () => {
  test('honoErrorHandler returns problem JSON response', async () => {
    const error = new AppError('TEST', 'test error', { status: 401 });
    const handler = honoErrorHandler();

    const c = {
      json: mock((data: any, status: number) => ({ status, json: async () => data })),
    } as any;

    const result = await handler(error, c);

    expect(c.json).toHaveBeenCalled();
    const [data, status] = c.json.mock.calls[0];
    expect(status).toBe(401);
    expect(data.title).toBe('TEST');
    expect(data.detail).toBe('test error');
  });

  test('honoErrorHandler handles non-AppError', async () => {
    const handler = honoErrorHandler();
    const c = {
      json: mock((data: any, status: number) => ({ status, json: async () => data })),
    } as any;

    const result = await handler(new Error('plain error'), c);

    expect(c.json).toHaveBeenCalled();
    const [data, status] = c.json.mock.calls[0];
    expect(status).toBe(500);
    expect(data.title).toBeDefined();
  });
});

describe('H3 Adapter', () => {
  test('h3ErrorHandler returns undefined if no error', () => {
    const handler = h3ErrorHandler();
    const event = { node: { res: {} } } as any;

    const result = handler(event);
    expect(result).toBeUndefined();
  });

  test('h3ErrorHandler handles error from event', () => {
    const handler = h3ErrorHandler();
    const error = new AppError('TEST', 'test error', { status: 422 });
    const event = {
      node: {
        res: {
          __error: error,
          statusCode: 200,
          setHeader: mock(),
        },
      },
    } as any;

    const result = handler(event);

    expect(event.node.res.statusCode).toBe(422);
    expect(event.node.res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/problem+json');
    expect(result.title).toBe('TEST');
    expect(result.detail).toBe('test error');
  });

  test('h3ErrorHandler handles non-AppError', () => {
    const handler = h3ErrorHandler();
    const error = new Error('plain error');
    const event = {
      node: {
        res: {
          __error: error,
          statusCode: 200,
          setHeader: mock(),
        },
      },
    } as any;

    const result = handler(event);

    expect(event.node.res.statusCode).toBe(500);
    expect(result.title).toBeDefined();
  });

  test('createH3Error creates H3 error shape', () => {
    const appError = new AppError('TEST', 'test error', {
      status: 400,
      data: { field: 'email' },
    });

    const h3Error = createH3Error(appError);

    expect(h3Error.statusCode).toBe(400);
    expect(h3Error.statusMessage).toBe('test error');
    expect(h3Error.data).toBeDefined();
    expect(h3Error.data.code).toBeUndefined(); // toProblem doesn't include code in top level
  });
});

describe('Elysia Adapter', () => {
  test('elysiaErrorHandler returns problem object', () => {
    const error = new AppError('TEST', 'test error', { status: 418 });
    const handler = elysiaErrorHandler();

    const set: any = { status: 200, headers: {} };
    const result = handler({ error, code: 'TEST', set });

    expect(set.status).toBe(418);
    expect(set.headers['Content-Type']).toBe('application/problem+json');
    expect(result.title).toBe('TEST');
    expect(result.detail).toBe('test error');
  });

  test('elysiaErrorHandler handles non-AppError', () => {
    const handler = elysiaErrorHandler();
    const set: any = { status: 200, headers: {} };
    const result = handler({ error: new Error('plain error'), code: 'ERROR', set });

    expect(set.status).toBe(500);
    expect(result.title).toBeDefined();
  });

  test('elysiaErrorHandler includes error details', () => {
    const error = new AppError('VALIDATION', 'Invalid input', {
      status: 400,
      data: { fields: ['email', 'name'] },
    });
    const handler = elysiaErrorHandler();
    const set: any = { status: 200, headers: {} };

    const result = handler({ error, code: 'VALIDATION', set });

    expect(result.detail).toBeDefined();
    expect(result.instance).toBeDefined();
  });
});
