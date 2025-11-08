const PATH_TOKEN_REGEX = /([^.[\]]+)|\[(\d+)\]/g;

export const getPath = <TValue = unknown, TResult = unknown>(
  value: TValue,
  path: string,
): TResult | undefined => {
  if (!path) return value as unknown as TResult;
  const tokens = tokenize(path);
  let cursor: any = value;
  for (const token of tokens) {
    if (cursor == null) {
      return undefined;
    }
    cursor = cursor[token];
  }
  return cursor as TResult;
};

const tokenize = (path: string): (string | number)[] => {
  const tokens: (string | number)[] = [];
  let match: RegExpExecArray | null;
  while ((match = PATH_TOKEN_REGEX.exec(path)) !== null) {
    const [, dot, bracket] = match;
    if (dot) {
      tokens.push(dot);
    } else if (bracket) {
      tokens.push(Number(bracket));
    }
  }
  return tokens;
};
