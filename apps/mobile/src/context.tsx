import { createContext, useContext, useSyncExternalStore } from "react";
import type { Session } from "./api";
import type { VisitType } from "./domain";
import type { HouseholdTool } from "./resident/householdData";
export const SessionContext = createContext<Session | null>(null);
export const useSession = () => {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Missing session");
  return session;
};
export const useSnapshot = () => {
  const session = useSession();
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
};
export type Routes = {
  Home: undefined;
  Visitors: undefined;
  Visitor: { id: string };
  VisitorForm: { type: VisitType } | undefined;
  Pass: { id: string };
  Verify: { code?: string } | undefined;
  Homes: undefined;
  Marketplace: undefined;
  Stores: undefined;
  Notices: undefined;
  Community: undefined;
  Features: undefined;
  Directory: { group: "Residents" | "Society team" } | undefined;
  Household: { tool: HouseholdTool };
  Posts: undefined;
  Item: { id: string };
  Editor: { kind: "listing" | "property" | "post" };
  Activity: undefined;
  Notifications: undefined;
  Profile: undefined;
  Membership: undefined;
};
