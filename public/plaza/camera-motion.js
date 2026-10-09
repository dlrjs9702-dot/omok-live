// The existing 60 Hz camera response, expressed in elapsed seconds.
export function cameraEase(weight, dt) {
  return 1 - Math.pow(1 - weight, Math.max(0, dt) * 60);
}

export function cameraDistance(normal, minimum, inside) {
  let distance = normal;
  while (distance > minimum && inside(distance)) distance = Math.max(minimum, distance - 0.5);
  return distance;
}
