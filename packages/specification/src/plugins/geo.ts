import { createPlugin } from "./create-plugin.js";
import { createFieldOperator } from "../ops/factory.js";

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversine = (a: [number, number], b: [number, number]) => {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const r = 6371;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return r * c;
};

const withinRadius = createFieldOperator({
  kind: "withinRadius",
  reason: (input) => `{${input.path}} must be within ${input.km}km of provided center`,
  predicate: ({ actual, input }) => {
    if (!Array.isArray(actual) || actual.length !== 2) return false;
    const center = input.center as [number, number];
    if (!center) return false;
    const distance = haversine([actual[0] as number, actual[1] as number], center);
    return distance <= Number(input.km ?? 0);
  },
});

export const geoPlugin = createPlugin({
  name: "geo",
  version: "1.0.0",
  register(registry) {
    registry.addOperator(withinRadius);
  },
});
