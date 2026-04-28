import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { consoleFetch } from '@openshift-console/dynamic-plugin-sdk';

import { LightspeedProposal, LightspeedProposalModel, RemediationOption } from '../models/proposal';

export { buildProposalChatConfig } from './proposalChatContext';

function patchAnalysisOption(
  proposal: LightspeedProposal,
  optionIndex: number,
  patch: Partial<RemediationOption>,
): Promise<Response> {
  const { name, namespace } = proposal.metadata;
  const statusUrl = `/api/kubernetes/apis/${LightspeedProposalModel.apiGroup}/${LightspeedProposalModel.apiVersion}/namespaces/${namespace}/${LightspeedProposalModel.plural}/${name}/status`;

  const options = [...(proposal.status?.steps?.analysis?.options || [])];
  if (optionIndex >= 0 && optionIndex < options.length) {
    options[optionIndex] = { ...options[optionIndex], ...patch };
  }

  return consoleFetch(statusUrl, {
    body: JSON.stringify({
      status: {
        steps: {
          analysis: { options },
        },
      },
    }),
    headers: { 'Content-Type': 'application/merge-patch+json' },
    method: 'PATCH',
  }) as Promise<Response>;
}

export function useProposalActions(
  proposal: LightspeedProposal,
  sendMessage: (_text: string) => void,
) {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');
  const [actionError, setActionError] = React.useState<string | null>(null);

  const handleAction = React.useCallback(
    async (action: string, data: Record<string, unknown>) => {
      if (action === 'action_selected') {
        sendMessage(data.message as string);
        return;
      }

      try {
        setActionError(null);

        const optionIndex =
          typeof data.optionIndex === 'number'
            ? data.optionIndex
            : (proposal.status?.steps?.analysis?.selectedOption ?? 0);

        if (action === 'apply_proposal') {
          const optionData = data.proposal as RemediationOption;
          await patchAnalysisOption(proposal, optionIndex, optionData);
          sendMessage(t('I applied the revised proposal. Review it in the Proposal tab.'));
        } else if (action === 'apply_verification') {
          await patchAnalysisOption(proposal, optionIndex, {
            verification: data.verification as RemediationOption['verification'],
          });
          sendMessage(t('I applied the revised verification plan. Review it in the Proposal tab.'));
        } else if (action === 'apply_rbac') {
          await patchAnalysisOption(proposal, optionIndex, {
            rbac: data.rbac as RemediationOption['rbac'],
          });
          sendMessage(t('I applied the revised RBAC permissions. Review it in the Proposal tab.'));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setActionError(`${t('Failed to apply update')}: ${msg}`);
      }
    },
    [proposal, sendMessage, t],
  );

  const clearActionError = React.useCallback(() => setActionError(null), []);

  return { actionError, clearActionError, handleAction };
}
