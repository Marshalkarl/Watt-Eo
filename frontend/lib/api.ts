const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

type ApiOptions = Omit<RequestInit, "body"> & {
  token?: string | null;
  body?: unknown;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, body, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Une erreur est survenue.", res.status, data?.errors);
  }

  return data as T;
}

/** Transforme n'importe quelle erreur en message lisible pour l'utilisateur. */
export function messageFromError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.errors) {
      return Object.values(err.errors).map((m) => m[0]).join(" ");
    }
    return err.message;
  }
  return "Impossible de joindre le serveur.";
}