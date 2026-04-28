import type { Command } from '../chat/ChatInput';

export const PROPOSAL_COMMANDS: Command[] = [
  // --- Refine ---
  {
    id: 'refine-plan',
    label: 'Refine Plan',
    desc: 'Review and revise the remediation plan',
    category: 'Refine',
    action: '',
    prompt:
      'Refine the remediation plan: {input}. Review the current approach, apply my feedback, and emit a revised_proposal with your changes so I can review and apply it.',
  },
  {
    id: 'refine-rbac',
    label: 'Refine RBAC',
    desc: 'Review and tighten RBAC permissions',
    category: 'Refine',
    action: '',
    prompt:
      'Refine the RBAC permissions: {input}. Review the current permissions, apply my feedback, and emit a revised_rbac with your changes so I can review and apply it.',
  },
  {
    id: 'refine-verification',
    label: 'Refine Verification',
    desc: 'Improve the verification and rollback plan',
    category: 'Refine',
    action: '',
    prompt:
      'Refine the verification plan: {input}. Review the current steps, apply my feedback, and emit a revised_verification with your changes so I can review and apply it.',
  },
  // --- Analyze ---
  {
    id: 'explain-diagnosis',
    label: 'Explain Diagnosis',
    desc: 'Walk through the root cause analysis',
    category: 'Analyze',
    action:
      'Walk me through the diagnosis step by step. What evidence supports the identified root cause? Are there alternative explanations we should consider?',
  },
  {
    id: 'assess-risk',
    label: 'Assess Risk',
    desc: 'Analyze what could go wrong',
    category: 'Analyze',
    action:
      'Analyze the risk of executing this proposal. What could go wrong? What is the blast radius? Are there dependencies or side effects we should be aware of?',
  },
  {
    id: 'check-impact',
    label: 'Check Impact',
    desc: 'Identify affected resources and workloads',
    category: 'Analyze',
    action:
      'What resources and workloads will be affected by this proposal? Check the cluster for dependent services, ingress routes, or other resources that might be impacted.',
  },
  // --- Investigate ---
  {
    id: 'investigate',
    label: 'Investigate',
    desc: 'Check cluster state related to this alert',
    category: 'Investigate',
    action:
      'Investigate the current cluster state related to this proposal. Check the relevant pods, events, logs, and resource status. Report what you find.',
  },
  {
    id: 'check-metrics',
    label: 'Check Metrics',
    desc: 'Query Prometheus metrics for this alert',
    category: 'Investigate',
    action:
      'Query Prometheus for metrics related to this alert to validate the diagnosis. Show relevant graphs and data trends.',
  },
];
