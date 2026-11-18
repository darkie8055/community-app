// These collections belong to the local UI preview. Each screen shares the
// same in-memory records until the resident leaves or resets the demo.
export const householdTools = {
  family: {
    title: "My family",
    icon: "account-group-outline",
    label: "Member name",
    action: "Add family member",
    empty: "Add someone who lives with you.",
  },
  vehicles: {
    title: "My vehicles",
    icon: "car-outline",
    label: "Vehicle registration",
    action: "Add vehicle",
    empty: "Keep your household vehicles together.",
  },
  pets: {
    title: "My pets",
    icon: "paw-outline",
    label: "Pet name",
    action: "Add pet",
    empty: "Add the pets who share your home.",
  },
  planner: {
    title: "Home planner",
    icon: "calendar-check-outline",
    label: "Reminder",
    action: "Add reminder",
    empty: "Keep track of tasks around the house.",
  },
  devices: {
    title: "My devices",
    icon: "devices",
    label: "Device name",
    action: "Add demo device",
    empty: "Organise your sample household devices here.",
  },
  helpdesk: {
    title: "Helpdesk",
    icon: "lifebuoy",
    label: "Describe your issue",
    action: "Create request",
    empty: "Your society maintenance requests appear here.",
  },
  amenities: {
    title: "Amenities",
    icon: "tennis",
    label: "Facility",
    action: "Reserve slot",
    empty: "Choose a facility, day and time to reserve a sample slot.",
  },
  bills: {
    title: "Society bills",
    icon: "receipt-text-outline",
    label: "",
    action: "",
    empty: "",
  },
} as const;

export type HouseholdTool = keyof typeof householdTools;
export type HouseholdRecord = { title: string; detail: string };
export type HouseholdRecords = Record<HouseholdTool, HouseholdRecord[]>;

export const initialRecords: HouseholdRecords = {
  family: [],
  vehicles: [],
  pets: [],
  planner: [],
  devices: [],
  helpdesk: [],
  amenities: [],
  bills: [],
};
