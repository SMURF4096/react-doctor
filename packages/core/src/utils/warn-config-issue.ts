export const warnConfigIssue = (message: string): void => {
  process.stderr.write(`[react-doctor] ${message}\n`);
};
