export const filteredObject = (object: Record<string, unknown>) =>
  Object.fromEntries(

    Object.entries(object).filter(([_, value]) => value !== undefined),
  );
