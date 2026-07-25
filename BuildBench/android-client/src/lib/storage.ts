import { Preferences } from "@capacitor/preferences";
import type { ConnectionConfig } from "../types";

const CONNECTION_KEY = "buildbench.connection.v1";

export const EMPTY_CONNECTION_CONFIG: ConnectionConfig = {
  serviceUrl: "",
  token: "",
};

export async function loadConnectionConfig(): Promise<ConnectionConfig> {
  const { value } = await Preferences.get({ key: CONNECTION_KEY });
  if (!value) {
    return EMPTY_CONNECTION_CONFIG;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ConnectionConfig>;
    return {
      serviceUrl: typeof parsed.serviceUrl === "string" ? parsed.serviceUrl : "",
      token: typeof parsed.token === "string" ? parsed.token : "",
    };
  } catch {
    return EMPTY_CONNECTION_CONFIG;
  }
}

export async function saveConnectionConfig(config: ConnectionConfig): Promise<void> {
  await Preferences.set({
    key: CONNECTION_KEY,
    value: JSON.stringify(config),
  });
}

export async function clearConnectionConfig(): Promise<void> {
  await Preferences.remove({ key: CONNECTION_KEY });
}

