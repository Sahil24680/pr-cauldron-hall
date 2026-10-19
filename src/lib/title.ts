const TICKET_PREFIXES = /^(?:\[[A-Z]+(?:-\d+)?\]\s*)+/;

export function stripTicketPrefix(title: string) {
  return title.replace(TICKET_PREFIXES, "");
}
