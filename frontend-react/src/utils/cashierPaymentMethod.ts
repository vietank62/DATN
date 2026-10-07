export function cashierPaymentMethod(
  choice: { context: string; value: string } | null,
  context: string,
  allowed: readonly string[],
  defaultMethod: string,
): string {
  if (choice?.context === context && allowed.includes(choice.value)) return choice.value;
  return allowed.includes(defaultMethod) ? defaultMethod : allowed[0] ?? "";
}
