import {
  isClaimable,
  isFinallyFailed,
  orderPagesForWork,
  parsePageList,
} from './pageWork';

describe('orderPagesForWork', () => {
  it('starts at the page being read, then goes forward, then back', () => {
    expect(orderPagesForWork([1, 2, 3, 4, 5, 6], 4)).toEqual([
      4, 5, 6, 3, 2, 1,
    ]);
  });
  it('is plain page order when reading from the start', () => {
    expect(orderPagesForWork([3, 1, 2], 1)).toEqual([1, 2, 3]);
  });
});

describe('parsePageList', () => {
  it('reads single pages and ranges', () => {
    expect([...parsePageList('1,2,5-7', 10)]).toEqual([1, 2, 5, 6, 7]);
  });
  it('ignores junk and pages out of range', () => {
    expect([...parsePageList('x,0,9-12,,3', 10)]).toEqual([9, 10, 3]);
  });
  it('is empty for nothing', () => {
    expect(parsePageList(undefined, 10).size).toBe(0);
  });
});

describe('isClaimable / isFinallyFailed', () => {
  const now = new Date('2026-11-08T12:00:00Z');
  const staleBefore = new Date(now.getTime() - 3 * 60_000);
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('takes pending pages', () => {
    expect(
      isClaimable({ status: 'pending', attempts: 0 }, staleBefore, 3),
    ).toBe(true);
  });
  it('retries failed pages until attempts run out', () => {
    expect(isClaimable({ status: 'failed', attempts: 2 }, staleBefore, 3)).toBe(
      true,
    );
    expect(isClaimable({ status: 'failed', attempts: 3 }, staleBefore, 3)).toBe(
      false,
    );
    expect(isFinallyFailed({ status: 'failed', attempts: 3 }, 3)).toBe(true);
  });
  it('leaves pages being worked on, unless the worker went quiet', () => {
    expect(
      isClaimable(
        { status: 'running', attempts: 1, updatedOn: ago(30_000) },
        staleBefore,
        3,
      ),
    ).toBe(false);
    expect(
      isClaimable(
        { status: 'running', attempts: 1, updatedOn: ago(5 * 60_000) },
        staleBefore,
        3,
      ),
    ).toBe(true);
  });
  it('never takes done pages', () => {
    expect(isClaimable({ status: 'done', attempts: 1 }, staleBefore, 3)).toBe(
      false,
    );
  });
});
