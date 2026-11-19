export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("kitchen-token");
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = "Unable to connect. Please try again.";
    try {
      const body = await response.json();
      message =
        typeof body.detail === "string"
          ? body.detail
          : "Please check the form fields.";
    } catch {}
    throw new Error(message);
  }
  return response.json();
}
export const money = (n: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n));
