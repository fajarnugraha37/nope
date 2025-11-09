import { describe, test, expect } from 'bun:test';
import {
  ok,
  err,
  safeAwait,
  safeFunc,
  isOk,
  isErr,
  unwrap,
  unwrapErr,
  unwrapOr,
  map,
  mapErr,
  ResultWrapper,
  type Result,
} from '../src/result';
import { AppError } from '../src/app-error';

describe('Result Type', () => {
  describe('ok()', () => {
    test('creates success result', () => {
      const result = ok(42);
      expect(result.isOk()).toBe(true);
      expect(result.unwrapResult().value).toBe(42);
      expect(result.unwrapResult().error).toBe(null);
    });

    test('creates success with complex value', () => {
      const value = { id: 1, name: 'test', nested: { deep: true } };
      const result = ok(value);
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toEqual(value);
    });
  });

  describe('err()', () => {
    test('creates error result with AppError', () => {
      const error = new AppError('TEST', 'test error');
      const result = err(error);
      expect(result.unwrapResult().ok).toBe(false);
      expect(result.unwrapResult().error).toBe(error);
      expect(result.unwrapResult().value).toBe(null);
    });

    test('creates error result with custom error', () => {
      const error = new Error('custom error');
      const result = err(error);
      expect(result.unwrapResult().ok).toBe(false);
      expect(result.unwrapResult().error).toBe(error);
    });
  });

  describe('ResultWrapper - map()', () => {
    test('transforms success value', () => {
      const result = ok(5).map(x => x * 2);
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(10);
    });

    test('chains multiple maps', () => {
      const result = ok(2)
        .map(x => x + 3)
        .map(x => x * 2)
        .map(x => x.toString());
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe('10');
    });

    test('preserves error through map', () => {
      const error = new AppError('TEST', 'error');
      const result = err(error).map(x => x * 2);
      expect(result.unwrapResult().ok).toBe(false);
      expect(result.unwrapResult().error).toBe(error);
    });
  });

  describe('ResultWrapper - mapAsync()', () => {
    test('transforms success value asynchronously', async () => {
      const result = await ok(5).mapAsync(async x => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return x * 2;
      });
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(10);
    });

    test('catches async errors', async () => {
      const result = await ok(5).mapAsync(async () => {
        throw new Error('async error');
      });
      expect(result.unwrapResult().ok).toBe(false);
      expect(result.unwrapResult().error).toBeInstanceOf(AppError);
    });

    test('preserves error through mapAsync', async () => {
      const error = new AppError('TEST', 'error');
      const result = await err(error).mapAsync(async x => x * 2);
      expect(result.unwrapResult().ok).toBe(false);
      expect(result.unwrapResult().error).toBe(error);
    });
  });

  describe('ResultWrapper - mapErr()', () => {
    test('transforms error value', () => {
      const error = new AppError('TEST', 'test error');
      const result = err(error).mapErr(e => new AppError('MAPPED', e.message));
      expect(result.unwrapResult().ok).toBe(false);
      expect(result.unwrapResult().error?.code).toBe('MAPPED');
    });

    test('preserves success through mapErr', () => {
      const result = ok(42).mapErr(e => new AppError('MAPPED', 'test'));
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(42);
    });
  });

  describe('ResultWrapper - flatMap()', () => {
    test('chains result-returning operations', () => {
      const divide = (a: number, b: number): ResultWrapper<number, AppError> => 
        b === 0 ? err(new AppError('DIV_ZERO', 'Division by zero')) : ok(a / b);

      const result: ResultWrapper<number, AppError> = ok<number>(10).flatMap(x => divide(x, 2));
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(5);
    });

    test('short-circuits on error', () => {
      const divide = (a: number, b: number): ResultWrapper<number, AppError> => 
        b === 0 ? err(new AppError('DIV_ZERO', 'Division by zero')) : ok(a / b);

      const result: ResultWrapper<number, AppError> = ok<number>(10).flatMap(x => divide(x, 0));
      expect(result.unwrapResult().ok).toBe(false);
      expect((result.unwrapResult().error as AppError)?.code).toBe('DIV_ZERO');
    });

    test('preserves original error', () => {
      const error = new AppError('ORIGINAL', 'original error');
      const result = err(error).flatMap(x => ok(x * 2));
      expect(result.unwrapResult().ok).toBe(false);
      expect(result.unwrapResult().error).toBe(error);
    });
  });

  describe('ResultWrapper - tap()', () => {
    test('executes side effect on success', () => {
      let sideEffect = 0;
      const result = ok(42).tap(x => { sideEffect = x; });
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(42);
      expect(sideEffect).toBe(42);
    });

    test('skips side effect on error', () => {
      let sideEffect = 0;
      const error = new AppError('TEST', 'error');
      const result = err(error).tap(x => { sideEffect = x; });
      expect(result.unwrapResult().ok).toBe(false);
      expect(sideEffect).toBe(0);
    });
  });

  describe('ResultWrapper - tapErr()', () => {
    test('executes side effect on error', () => {
      let sideEffectCode = '';
      const error = new AppError('TEST', 'error');
      const result = err(error).tapErr(e => { sideEffectCode = e.code; });
      expect(result.unwrapResult().ok).toBe(false);
      expect(sideEffectCode).toBe('TEST');
    });

    test('skips side effect on success', () => {
      let sideEffect = '';
      const result = ok(42).tapErr(e => { sideEffect = 'ran'; });
      expect(result.unwrapResult().ok).toBe(true);
      expect(sideEffect).toBe('');
    });
  });

  describe('ResultWrapper - unwrap()', () => {
    test('returns value on success', () => {
      const value = ok(42).unwrap();
      expect(value).toBe(42);
    });

    test('throws on error', () => {
      const error = new AppError('TEST', 'test error');
      expect(() => err(error).unwrap()).toThrow('test error');
    });
  });

  describe('ResultWrapper - unwrapOr()', () => {
    test('returns value on success', () => {
      const value = ok(42).unwrapOr(0);
      expect(value).toBe(42);
    });

    test('returns default on error', () => {
      const error = new AppError('TEST', 'error');
      const errResult: ResultWrapper<number, AppError> = err(error);
      const value = errResult.unwrapOr(99);
      expect(value).toBe(99);
    });
  });

  describe('ResultWrapper - unwrapOrElse()', () => {
    test('returns value on success', () => {
      const value = ok(42).unwrapOrElse(() => 0);
      expect(value).toBe(42);
    });

    test('calls fallback on error', () => {
      const error = new AppError('TEST', 'error');
      const errResult: ResultWrapper<number, AppError> = err(error);
      const value = errResult.unwrapOrElse(e => e.code === 'TEST' ? 99 : 0);
      expect(value).toBe(99);
    });
  });

  describe('ResultWrapper - match()', () => {
    test('calls ok handler on success', () => {
      const result = ok(42).match({
        ok: val => val * 2,
        err: () => 0,
      });
      expect(result).toBe(84);
    });

    test('calls err handler on error', () => {
      const error = new AppError('TEST', 'error');
      const result = err(error).match({
        ok: val => val,
        err: e => e.code,
      });
      expect(result).toBe('TEST');
    });
  });

  describe('ResultWrapper - toPromise()', () => {
    test('resolves with value on success', async () => {
      const value = await ok(42).toPromise();
      expect(value).toBe(42);
    });

    test('rejects with error on failure', async () => {
      const error = new AppError('TEST', 'test error');
      await expect(err(error).toPromise()).rejects.toThrow('test error');
    });
  });

  describe('ResultWrapper - and()', () => {
    test('combines two successes', () => {
      const result = ok(1).and(ok(2));
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toEqual([1, 2]);
    });

    test('returns first error', () => {
      const error1 = new AppError('ERR1', 'error 1');
      const result = err(error1).and(ok(2));
      expect(result.unwrapResult().ok).toBe(false);
      expect((result.unwrapResult().error as AppError)?.code).toBe('ERR1');
    });

    test('returns second error if first succeeds', () => {
      const error2 = new AppError('ERR2', 'error 2');
      const okResult: ResultWrapper<number, AppError> = ok(1);
      const errResult: ResultWrapper<number, AppError> = err(error2);
      const result = okResult.and(errResult);
      expect(result.unwrapResult().ok).toBe(false);
      expect((result.unwrapResult().error as AppError)?.code).toBe('ERR2');
    });
  });

  describe('ResultWrapper - or()', () => {
    test('returns first success', () => {
      const result = ok(1).or(ok(2));
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(1);
    });

    test('returns second success if first fails', () => {
      const error = new AppError('TEST', 'error');
      const errResult: ResultWrapper<number, AppError> = err(error);
      const okResult: ResultWrapper<number, AppError> = ok(2);
      const result = errResult.or(okResult);
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(2);
    });

    test('returns last error if both fail', () => {
      const error1 = new AppError('ERR1', 'error 1');
      const error2 = new AppError('ERR2', 'error 2');
      const result = err(error1).or(err(error2));
      expect(result.unwrapResult().ok).toBe(false);
      expect((result.unwrapResult().error as AppError)?.code).toBe('ERR2');
    });
  });

  describe('safeAwait()', () => {
    test('returns success wrapper', async () => {
      const promise = Promise.resolve(42);
      const result = await safeAwait(promise);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    test('returns error wrapper on rejection', async () => {
      const promise = Promise.reject(new Error('test error'));
      const result = await safeAwait(promise);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapResult().error).toBeInstanceOf(AppError);
    });

    test('handles async function', async () => {
      const asyncFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 42;
      };
      const result = await safeAwait(asyncFn());
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(42);
    });

    test('handles rejected async function', async () => {
      const asyncFn = async () => {
        throw new Error('async error');
      };
      const result = await safeAwait(asyncFn());
      expect(result.isErr()).toBe(true);
      const error = result.unwrapResult().error;
      expect(error).toBeInstanceOf(AppError);
      expect(error?.message).toBe('async error');
    });

    test('chains operations after safeAwait', async () => {
      const result = await safeAwait(Promise.resolve(5));
      const doubled = result.map(x => x * 2);
      expect(doubled.unwrap()).toBe(10);
    });
  });

  describe('safeFunc()', () => {
    test('returns success result', () => {
      const result = safeFunc(() => 42);
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(42);
    });

    test('returns error result on throw', () => {
      const result = safeFunc(() => {
        throw new Error('test error');
      });
      expect(result.unwrapResult().ok).toBe(false);
      expect(result.unwrapResult().error).toBeInstanceOf(AppError);
    });

    test('passes arguments', () => {
      const result = safeFunc((a: number, b: number) => a + b, 2, 3);
      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(5);
    });

    test('handles errors from args', () => {
      const result = safeFunc((arr: number[]) => arr[0].toFixed(), null as any);
      expect(result.unwrapResult().ok).toBe(false);
      expect(result.unwrapResult().error).toBeInstanceOf(AppError);
    });
  });

  describe('Standalone helpers', () => {
    test('isOk() checks success', () => {
      const success: Result<number, AppError> = { ok: true, value: 42, error: null };
      const failure: Result<number, AppError> = { ok: false, value: null, error: new AppError('TEST', 'error') };
      expect(isOk(success)).toBe(true);
      expect(isOk(failure)).toBe(false);
    });

    test('isErr() checks error', () => {
      const success: Result<number, AppError> = { ok: true, value: 42, error: null };
      const failure: Result<number, AppError> = { ok: false, value: null, error: new AppError('TEST', 'error') };
      expect(isErr(success)).toBe(false);
      expect(isErr(failure)).toBe(true);
    });

    test('unwrap() extracts value or throws', () => {
      const success: Result<number, AppError> = { ok: true, value: 42, error: null };
      const failure: Result<number, AppError> = { ok: false, value: null, error: new AppError('TEST', 'error') };
      expect(unwrap(success)).toBe(42);
      expect(() => unwrap(failure)).toThrow('error');
    });

    test('unwrapErr() extracts error or throws', () => {
      const success: Result<number, AppError> = { ok: true, value: 42, error: null };
      const error = new AppError('TEST', 'error');
      const failure: Result<number, AppError> = { ok: false, value: null, error };
      expect(() => unwrapErr(success)).toThrow('Called unwrapErr on an Ok result');
      expect(unwrapErr(failure)).toBe(error);
    });

    test('unwrapOr() provides default', () => {
      const success: Result<number, AppError> = { ok: true, value: 42, error: null };
      const failure: Result<number, AppError> = { ok: false, value: null, error: new AppError('TEST', 'error') };
      expect(unwrapOr(success, 0)).toBe(42);
      expect(unwrapOr(failure, 0)).toBe(0);
    });

    test('map() transforms success', () => {
      const success: Result<number, AppError> = { ok: true, value: 5, error: null };
      const mapped = map(success, x => x * 2);
      expect(mapped.ok).toBe(true);
      expect(mapped.value).toBe(10);
    });

    test('mapErr() transforms error', () => {
      const error = new AppError('TEST', 'error');
      const failure: Result<number, AppError> = { ok: false, value: null, error };
      const mapped = mapErr(failure, e => new AppError('MAPPED', e.message));
      expect(mapped.ok).toBe(false);
      expect(mapped.error?.code).toBe('MAPPED');
    });
  });

  describe('Complex scenarios', () => {
    test('chaining operations with mixed success/error', () => {
      const divide = (a: number, b: number): ResultWrapper<number, AppError> => 
        b === 0 ? err(new AppError('DIV_ZERO', 'Division by zero')) : ok(a / b);

      const result: ResultWrapper<number, AppError> = ok<number>(20)
        .flatMap(x => divide(x, 4))
        .map(x => x * 3)
        .tap(x => console.log('intermediate:', x))
        .flatMap(x => divide(x, 3))
        .map(x => Math.round(x));

      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(5);
    });

    test('error recovery with or()', () => {
      const failed: ResultWrapper<number, AppError> = err(new AppError('FAIL', 'failed'));
      const fallback: ResultWrapper<number, AppError> = ok(42);
      const result = failed.or(fallback).map(x => x * 2);

      expect(result.unwrapResult().ok).toBe(true);
      expect(result.unwrapResult().value).toBe(84);
    });

    test('combining multiple results', () => {
      const r1 = ok(1);
      const r2 = ok(2);
      const r3 = ok(3);

      const combined = r1
        .and(r2)
        .flatMap(([a, b]) => ok(a + b))
        .and(r3)
        .map(([sum, c]) => sum + c);

      expect(combined.unwrapResult().ok).toBe(true);
      expect(combined.unwrapResult().value).toBe(6);
    });
  });
});
