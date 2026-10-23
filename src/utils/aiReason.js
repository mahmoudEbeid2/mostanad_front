// P8 — the API already says an AI failure in a sentence ("AI is switched off
// on this server … You can do it by hand."). A screen adds its own next step
// only when the reason doesn't already say it.
export const withNextStep = (reason, nextStep) => {
  if (!reason) return nextStep;
  return /by hand|manually/i.test(reason) ? reason : `${reason.replace(/\.$/, "")} — ${nextStep.charAt(0).toLowerCase()}${nextStep.slice(1)}`;
};
