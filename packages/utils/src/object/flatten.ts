export function flattenObject(obj: any, parentKey = "", result: any = {}): any {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === "object" && obj[key] !== null) {
        flattenObject(obj[key], newKey, result);
      } else {
        result[newKey] = obj[key];
      }
    }
  }
  return result;
}

export async function* flattenObjectStream(
  obj: any
): AsyncGenerator<{ key: string; value: any }> {
  async function* helper(
    currentObj: any,
    parentKey = ""
  ): AsyncGenerator<{ key: string; value: any }> {
    for (const key in currentObj) {
      if (currentObj.hasOwnProperty(key)) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        if (typeof currentObj[key] === "object" && currentObj[key] !== null) {
          yield* helper(currentObj[key], newKey);
        } else {
          yield { key: newKey, value: currentObj[key] };
        }
      }
    }
  }
  yield* helper(obj);
}

export function unflattenObject(flatObj: any): any {
  const result: any = {};
  for (const key in flatObj) {
    if (flatObj.hasOwnProperty(key)) {
      const keys = key.split(".");
      keys.reduce((acc, curr, index) => {
        if (index === keys.length - 1) {
          acc[curr] = flatObj[key];
        } else {
          acc[curr] = acc[curr] || {};
        }
        return acc[curr];
      }, result);
    }
  }
  return result;
}

export function* unflattenObjectStream(
  flatObj: any
): Generator<{ path: string; value: any; isComplete: boolean }> {
  const result: any = {};
  const keys = Object.keys(flatObj);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key && flatObj.hasOwnProperty(key)) {
      const pathKeys = key.split(".");
      pathKeys.reduce((acc, curr, index) => {
        if (index === pathKeys.length - 1) {
          acc[curr] = flatObj[key];
        } else {
          acc[curr] = acc[curr] || {};
        }
        return acc[curr];
      }, result);

      yield {
        path: key,
        value: flatObj[key],
        isComplete: i === keys.length - 1,
      };
    }
  }

  return result;
}
