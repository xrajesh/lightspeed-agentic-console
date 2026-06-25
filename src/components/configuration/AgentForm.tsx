import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  ExpandableSection,
  FormGroup,
  FormSelect,
  FormSelectOption,
  NumberInput,
  TextInput,
  Title,
} from '@patternfly/react-core';

import { LLMProviderK8s } from '../../models/proposal';

type AgentFormProps = {
  providers: LLMProviderK8s[];
  onSubmit: (name: string, spec: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
};

const AgentForm: React.FC<AgentFormProps> = ({ providers, onSubmit, onCancel }) => {
  const { t } = useTranslation('plugin__lightspeed-agentic-console-plugin');

  const [name, setName] = React.useState('');
  const [providerName, setProviderName] = React.useState('');
  const [model, setModel] = React.useState('');

  React.useEffect(() => {
    if (!providerName && providers.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProviderName(providers[0].metadata.name);
    }
  }, [providers, providerName]);
  const [maxTurns, setMaxTurns] = React.useState(100);
  const [analysisSeconds, setAnalysisSeconds] = React.useState(300);
  const [executionSeconds, setExecutionSeconds] = React.useState(600);
  const [verificationSeconds, setVerificationSeconds] = React.useState(300);
  const [chatSeconds, setChatSeconds] = React.useState(120);
  const [showTimeouts, setShowTimeouts] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const buildSpec = (): Record<string, unknown> => {
    const spec: Record<string, unknown> = {
      llmProvider: { name: providerName },
      model,
      maxTurns,
    };
    if (showTimeouts) {
      spec.timeouts = {
        analysisSeconds,
        executionSeconds,
        verificationSeconds,
        chatSeconds,
      };
    }
    return spec;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(name, buildSpec());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  const isValid = (): boolean => {
    return !!name && !!providerName && !!model;
  };

  const clampedNumberInput = (
    value: number,
    min: number,
    max: number,
    setter: (v: number) => void,
  ) => (
    <NumberInput
      value={value}
      min={min}
      max={max}
      onMinus={() => setter(Math.max(min, value - 30))}
      onPlus={() => setter(Math.min(max, value + 30))}
      onChange={(e) => {
        const val = Number((e.target as HTMLInputElement).value);
        if (val >= min && val <= max) setter(val);
      }}
    />
  );

  return (
    <div className="ols-plugin__config-form-section">
      <Title headingLevel="h3">{t('Create Agent')}</Title>

      {error && <p className="ols-plugin__config-error-text">{error}</p>}

      <FormGroup label={t('Name')} isRequired fieldId="agent-name">
        <TextInput
          id="agent-name"
          value={name}
          onChange={(_e, v) => setName(v)}
          isRequired
          placeholder="default"
        />
      </FormGroup>

      <FormGroup label={t('LLM Provider')} isRequired fieldId="agent-provider">
        <FormSelect
          id="agent-provider"
          value={providerName}
          onChange={(_e, v) => setProviderName(v)}
        >
          {providers.length ? (
            providers.map((p) => (
              <FormSelectOption
                key={p.metadata.name}
                value={p.metadata.name}
                label={p.metadata.name}
              />
            ))
          ) : (
            <FormSelectOption value="" label={t('No providers available')} isDisabled />
          )}
        </FormSelect>
      </FormGroup>

      <FormGroup label={t('Model')} isRequired fieldId="agent-model">
        <TextInput
          id="agent-model"
          value={model}
          onChange={(_e, v) => setModel(v)}
          isRequired
          placeholder="claude-opus-4-6"
        />
      </FormGroup>

      <FormGroup label={t('Max Turns')} fieldId="agent-max-turns">
        {clampedNumberInput(maxTurns, 1, 500, setMaxTurns)}
      </FormGroup>

      <ExpandableSection
        toggleText={showTimeouts ? t('Hide Timeouts') : t('Show Timeouts')}
        isExpanded={showTimeouts}
        onToggle={(_e, expanded) => setShowTimeouts(expanded)}
      >
        <FormGroup label={t('Analysis (seconds)')} fieldId="agent-timeout-analysis">
          {clampedNumberInput(analysisSeconds, 1, 3600, setAnalysisSeconds)}
        </FormGroup>
        <FormGroup label={t('Execution (seconds)')} fieldId="agent-timeout-execution">
          {clampedNumberInput(executionSeconds, 1, 3600, setExecutionSeconds)}
        </FormGroup>
        <FormGroup label={t('Verification (seconds)')} fieldId="agent-timeout-verification">
          {clampedNumberInput(verificationSeconds, 1, 3600, setVerificationSeconds)}
        </FormGroup>
        <FormGroup label={t('Chat (seconds)')} fieldId="agent-timeout-chat">
          {clampedNumberInput(chatSeconds, 1, 600, setChatSeconds)}
        </FormGroup>
      </ExpandableSection>

      <div className="ols-plugin__config-form-actions">
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={submitting}
          isDisabled={!isValid() || submitting}
        >
          {t('Create')}
        </Button>
        <Button variant="link" onClick={onCancel} isDisabled={submitting}>
          {t('Cancel')}
        </Button>
      </div>
    </div>
  );
};

export default AgentForm;
