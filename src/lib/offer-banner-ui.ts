export async function saveBannerWithFeedback<T>(
  save: () => Promise<T>,
  onSaved: (value: T) => void,
  onFailed: (error: unknown) => void,
): Promise<T | null> {
  try {
    const value = await save();
    onSaved(value);
    return value;
  } catch (error) {
    onFailed(error);
    return null;
  }
}