export const PROJECT_STATUS_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "qualifying", label: "Qualifying" },
  { value: "survey", label: "Survey" },
  { value: "estimating", label: "Estimating" },
  { value: "quoted", label: "Quoted" },
  { value: "won", label: "Won" },
  { value: "prestart", label: "Pre-start" },
  { value: "live", label: "Live" },
  { value: "handover", label: "Handover" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Closed" },
  { value: "lost", label: "Lost" },
] as const;

export const NEXT_ACTION_BY_STATUS: Record<string, string> = {
  lead: "Review enquiry",
  qualifying: "Qualify opportunity",
  survey: "Arrange site survey",
  estimating: "Prepare quotation",
  quoted: "Follow up quotation",
  won: "Confirm booking",
  prestart: "Prepare job / order materials",
  live: "Complete works",
  handover: "Complete handover",
  invoiced: "Chase payment",
  paid: "Close project",
  closed: "No action",
  lost: "No action",
};

export const NEXT_ACTION_OPTIONS = [
  "Review enquiry",
  "Qualify opportunity",
  "Call customer",
  "Email customer",
  "Await customer",
  "Await supplier",
  "Await drawings / specification",
  "Arrange samples",
  "Arrange site survey",
  "Prepare quotation",
  "Send quotation",
  "Follow up quotation",
  "Take deposit / confirm booking",
  "Confirm booking",
  "Schedule works",
  "Prepare job / order materials",
  "Complete works",
  "Complete handover",
  "Final invoice",
  "Chase payment",
  "Close project",
  "No action",
  "On hold",
] as const;

export function suggestedNextAction(status: string) {
  return NEXT_ACTION_BY_STATUS[status] ?? "Review project";
}
