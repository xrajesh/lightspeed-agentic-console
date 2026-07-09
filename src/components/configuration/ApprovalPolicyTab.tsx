import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { k8sCreate, k8sPatch, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  NumberInput,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';

import {
  ApprovalPolicyK8s,
  ApprovalMode,
  ApprovalPolicyStage,
  LightspeedApprovalPolicyGVK,
  LightspeedApprovalPolicyModel,
  SandboxStepName,
} from '../../models/agenticrun';

const STAGES: SandboxStepName[] = ['Analysis', 'Execution', 'Verification', 'Escalation'];

const getStageApproval = (
  stages: ApprovalPolicyStage[] | undefined,
  name: SandboxStepName,
): ApprovalMode => {
  const found = stages?.find((s) => s.name === name);
  return found?.approval ?? 'Manual';
};

const ApprovalPolicyTab: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const [policy, loaded, loadError] = useK8sWatchResource<ApprovalPolicyK8s>({
    groupVersionKind: LightspeedApprovalPolicyGVK,
    name: 'cluster',
  });

  const policyExists = loaded && !loadError && !!policy?.metadata?.name;

  const [stageValues, setStageValues] = React.useState<Record<SandboxStepName, ApprovalMode>>({
    Analysis: 'Manual',
    Execution: 'Manual',
    Verification: 'Manual',
    Escalation: 'Manual',
  });
  const [maxAttempts, setMaxAttempts] = React.useState(1);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const policyResourceVersion = policy?.metadata?.resourceVersion;
  React.useEffect(() => {
    if (policyExists) {
      const stages = policy.spec?.stages;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStageValues({
        Analysis: getStageApproval(stages, 'Analysis'),
        Execution: getStageApproval(stages, 'Execution'),
        Verification: getStageApproval(stages, 'Verification'),
        Escalation: getStageApproval(stages, 'Escalation'),
      });
      setMaxAttempts(policy.spec?.maxAttempts ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyResourceVersion]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    const spec = {
      stages: STAGES.map((name) => ({ name, approval: stageValues[name] })),
      maxAttempts,
    };

    try {
      if (policyExists) {
        await k8sPatch({
          model: LightspeedApprovalPolicyModel,
          resource: policy,
          data: [
            { op: 'replace', path: '/spec/stages', value: spec.stages },
            { op: 'replace', path: '/spec/maxAttempts', value: spec.maxAttempts },
          ],
        });
      } else {
        await k8sCreate({
          model: LightspeedApprovalPolicyModel,
          data: {
            apiVersion: 'agentic.openshift.io/v1alpha1',
            kind: 'ApprovalPolicy',
            metadata: { name: 'cluster' },
            spec: {
              ...spec,
              maxConcurrentAgenticRuns: 5,
            },
          },
        });
      }
      setSuccess(t('Approval policy saved successfully.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <Spinner size="lg" />;
  }

  return (
    <>
      {error && (
        <Alert variant="danger" isInline title={t('Error saving approval policy')}>
          {error}
        </Alert>
      )}
      {success && <Alert variant="success" isInline title={success} />}

      {STAGES.map((stage) => (
        <div key={stage} className="ols-plugin__config-approval-row">
          <span className="ols-plugin__config-approval-label">{t(stage)}</span>
          <ToggleGroup>
            <ToggleGroupItem
              text={t('Manual')}
              isSelected={stageValues[stage] === 'Manual'}
              onChange={() => setStageValues((prev) => ({ ...prev, [stage]: 'Manual' }))}
            />
            <ToggleGroupItem
              text={t('Automatic')}
              isSelected={stageValues[stage] === 'Automatic'}
              onChange={() => setStageValues((prev) => ({ ...prev, [stage]: 'Automatic' }))}
            />
          </ToggleGroup>
        </div>
      ))}

      <div className="ols-plugin__config-max-attempts">
        <span className="ols-plugin__config-approval-label">{t('Max retry attempts')}</span>
        <NumberInput
          value={maxAttempts}
          min={1}
          max={3}
          onMinus={() => setMaxAttempts((v) => Math.max(1, v - 1))}
          onPlus={() => setMaxAttempts((v) => Math.min(3, v + 1))}
          onChange={(e) => {
            const val = Number((e.target as HTMLInputElement).value);
            if (val >= 1 && val <= 3) setMaxAttempts(val);
          }}
        />
      </div>

      <div className="ols-plugin__config-form-actions">
        <Button variant="primary" onClick={handleSave} isLoading={saving} isDisabled={saving}>
          {t('Save')}
        </Button>
      </div>
    </>
  );
};

export default ApprovalPolicyTab;
