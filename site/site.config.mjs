const owner = "moneytosms";
const repoName = "termwise";

export default {
  name: "Termwise",
  tagline: "One college record, from admission to graduation.",
  description:
    "A college ERP built for classrooms with no signal: attendance taken offline and synced later, marks with a moderation lock, fees with verifiable receipts, and an assistant that can only read. Runs on synthetic demo data.",
  owner,
  repoName,
  branch: "main",
  repoUrl: `https://github.com/${owner}/${repoName}`,
  site: `https://${owner}.github.io`,
  base: `/${repoName}`,
  footnote: "Synthetic demo data. Messages are logged, not sent; payments are test mode.",
  // Only the documents meant for readers. The assignment brief stays internal.
  guide: ["README.md", "docs/deployment.md", "docs/tdd.md"],
  guideRoot: "README.md",
};
