import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { Routes } from "../context";
import type { IconName } from "./components";
import { householdTools, type HouseholdTool } from "./householdData";

type Feature = {
  label: string;
  icon: IconName;
  open: (nav: NativeStackNavigationProp<Routes>) => void;
  previewOnly?: boolean;
};
function household(tool: HouseholdTool): Feature {
  return {
    label: householdTools[tool].title,
    icon: householdTools[tool].icon,
    open: (nav) => nav.push("Household", { tool }),
    previewOnly: true,
  };
}
export const invite: Feature = {
  label: "Invite guest",
  icon: "account-plus-outline",
  open: (nav) => nav.push("VisitorForm", { type: "guest" }),
};
export const visitorLog: Feature = {
  label: "Visitor log",
  icon: "clipboard-text-clock-outline",
  open: (nav) => nav.navigate("Visitors"),
};
export const residents: Feature = {
  label: "Directory",
  icon: "book-account-outline",
  open: (nav) => nav.navigate("Directory", { group: "Residents" }),
};

export const featureGroups: { title: string; features: Feature[] }[] = [
  {
    title: "Community",
    features: [
      residents,
      household("amenities"),
      household("helpdesk"),
      household("bills"),
      {
        label: "Daily help",
        icon: "hand-heart-outline",
        open: (nav) => nav.navigate("Stores"),
      },
    ],
  },
  {
    title: "Visitors & security",
    features: [
      invite,
      {
        label: "Allow delivery",
        icon: "package-variant-closed",
        open: (nav) => nav.push("VisitorForm", { type: "delivery" }),
      },
      {
        label: "Cab or auto",
        icon: "taxi",
        open: (nav) => nav.push("VisitorForm", { type: "cab" }),
      },
      {
        label: "Visiting help",
        icon: "tools",
        open: (nav) => nav.push("VisitorForm", { type: "service" }),
      },
      visitorLog,
      {
        label: "Society team",
        icon: "shield-account-outline",
        open: (nav) => nav.navigate("Directory", { group: "Society team" }),
      },
    ],
  },
  {
    title: "Feed",
    features: [
      {
        label: "New post",
        icon: "pencil-box-outline",
        open: (nav) => nav.push("Editor", { kind: "post" }),
      },
      {
        label: "All posts",
        icon: "forum-outline",
        open: (nav) => nav.navigate("Posts"),
      },
      {
        label: "Notices",
        icon: "bullhorn-outline",
        open: (nav) => nav.navigate("Notices"),
      },
    ],
  },
  { title: "Smart devices", features: [household("devices")] },
  {
    title: "Marketplace",
    features: [
      {
        label: "Find homes",
        icon: "home-search-outline",
        open: (nav) => nav.navigate("Homes"),
      },
      {
        label: "Post property",
        icon: "home-plus-outline",
        open: (nav) => nav.push("Editor", { kind: "property" }),
      },
      {
        label: "Buy & Sell",
        icon: "tag-outline",
        open: (nav) => nav.navigate("Marketplace"),
      },
      {
        label: "New listing",
        icon: "tag-plus-outline",
        open: (nav) => nav.push("Editor", { kind: "listing" }),
      },
    ],
  },
  {
    title: "Household",
    features: [
      household("family"),
      household("vehicles"),
      household("pets"),
      household("planner"),
    ],
  },
  {
    title: "Settings & activity",
    features: [
      {
        label: "My flat",
        icon: "home-account",
        open: (nav) => nav.navigate("Profile"),
      },
      {
        label: "Notifications",
        icon: "bell-outline",
        open: (nav) => nav.navigate("Notifications"),
      },
      {
        label: "My requests",
        icon: "receipt-text-outline",
        open: (nav) => nav.navigate("Activity"),
      },
    ],
  },
];
