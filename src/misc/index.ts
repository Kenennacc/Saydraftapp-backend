export const filteredObject = (object: Record<string, unknown>) =>
  Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(object).filter(([_, value]) => value !== undefined),
  );
